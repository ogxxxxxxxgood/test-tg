import { Telegraf, Context } from "telegraf";
import { requireModerator } from "../middlewares/adminCheck";
import { removeBan, logAction } from "../services/moderationService";
import { mention } from "../utils/userMention";

/**
 * /unban — removes a user from the chat blacklist and allows them to rejoin
 *
 * Usage:
 *   /unban @username
 *   /unban 123456789
 */
export function registerUnbanCommand(bot: Telegraf<Context>): void {
  bot.command("unban", requireModerator(), async (ctx) => {
    if (!ctx.chat || !ctx.from || !ctx.message) return;

    const chatId = ctx.chat.id;
    const executor = ctx.from;

    const text = ctx.message.text ?? "";
    const args = text.split(/\s+/).slice(1);

    if (args.length === 0) {
      await ctx.reply(
        "❌ <b>Использование:</b> <code>/unban @username|ID</code>",
        { parse_mode: "HTML" }
      );
      return;
    }

    const target = args[0];
    let targetId: number;
    let targetUser: { id: number; username?: string; first_name?: string } | null = null;

    if (target.startsWith("@")) {
      try {
        const chat = await ctx.telegram.getChat(target);
        if ("id" in chat) {
          targetId = chat.id;
          targetUser = {
            id: chat.id,
            username: "username" in chat ? chat.username : undefined,
            first_name: "first_name" in chat ? (chat as { first_name?: string }).first_name : undefined,
          };
        } else {
          await ctx.reply("❌ Пользователь не найден.", { parse_mode: "HTML" });
          return;
        }
      } catch {
        await ctx.reply("❌ Пользователь не найден.", { parse_mode: "HTML" });
        return;
      }
    } else {
      targetId = parseInt(target, 10);
      if (isNaN(targetId)) {
        await ctx.reply("❌ Неверный формат ID пользователя.", { parse_mode: "HTML" });
        return;
      }
      targetUser = { id: targetId };
    }

    try {
      await ctx.telegram.unbanChatMember(chatId, targetId);
      await removeBan(chatId, targetId);

      await logAction({
        chatId,
        chatTitle: ctx.chat.type !== "private" ? ctx.chat.title : null,
        action: "unban",
        targetUserId: targetId,
        targetUsername: targetUser?.username ?? null,
        targetFirstName: targetUser?.first_name ?? null,
        executorUserId: executor.id,
        executorUsername: executor.username ?? null,
      });

      const targetMention = mention(
        targetId,
        targetUser?.first_name ?? targetUser?.username ?? String(targetId),
        targetUser?.username
      );

      await ctx.reply(
        `✅ <b>Пользователь разблокирован</b>\n\n` +
        `👤 Пользователь: ${targetMention}\n` +
        `👮 Администратор: ${mention(executor.id, executor.first_name, executor.username)}\n` +
        `\n<i>Пользователь может снова вступить в чат.</i>`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      console.error("[unban] Error:", err);
      await ctx.reply("❌ Не удалось разблокировать пользователя.", { parse_mode: "HTML" });
    }
  });
}
