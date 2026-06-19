import { Telegraf, Context } from "telegraf";
import { requireModerator } from "../middlewares/adminCheck";
import { logAction } from "../services/moderationService";
import { mention, escapeHtml } from "../utils/userMention";

/**
 * /kick — removes a user from the chat (they can rejoin via link)
 *
 * Usage:
 *   Reply to a message: /kick [reason]
 *   Direct:            /kick @username|ID [reason]
 */
export function registerKickCommand(bot: Telegraf<Context>): void {
  bot.command("kick", requireModerator(), async (ctx) => {
    if (!ctx.chat || !ctx.from || !ctx.message) return;

    const chatId = ctx.chat.id;
    const executor = ctx.from;
    let targetId: number | null = null;
    let targetUser: { id: number; username?: string; first_name?: string; last_name?: string } | null = null;
    let reason: string | null = null;

    const replyTo = ctx.message.reply_to_message;
    if (replyTo && replyTo.from) {
      targetUser = replyTo.from;
      targetId = replyTo.from.id;
      const text = ctx.message.text ?? "";
      const args = text.split(/\s+/).slice(1);
      reason = args.join(" ").trim() || null;
    } else {
      const text = ctx.message.text ?? "";
      const args = text.split(/\s+/).slice(1);
      if (args.length === 0) {
        await ctx.reply(
          "❌ <b>Использование:</b>\n" +
          "• Ответом на сообщение: <code>/kick [причина]</code>\n" +
          "• Напрямую: <code>/kick @username|ID [причина]</code>",
          { parse_mode: "HTML" }
        );
        return;
      }

      const target = args[0];
      reason = args.slice(1).join(" ").trim() || null;

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
        try {
          const member = await ctx.telegram.getChatMember(chatId, targetId);
          targetUser = member.user;
        } catch {
          targetUser = { id: targetId };
        }
      }
    }

    if (!targetId) return;

    // Protect creator and admins
    try {
      const member = await ctx.telegram.getChatMember(chatId, targetId);
      if (member.status === "creator") {
        await ctx.reply("🚫 Невозможно исключить создателя чата.", { parse_mode: "HTML" });
        return;
      }
      if (member.status === "administrator") {
        await ctx.reply("🚫 Невозможно исключить администратора чата.", { parse_mode: "HTML" });
        return;
      }
    } catch {
      // not in chat
    }

    const me = await ctx.telegram.getMe();
    if (targetId === me.id) {
      await ctx.reply("😅 Я не могу исключить самого себя.", { parse_mode: "HTML" });
      return;
    }
    if (targetId === executor.id) {
      await ctx.reply("😅 Вы не можете исключить самого себя.", { parse_mode: "HTML" });
      return;
    }

    try {
      // Kick = ban then immediately unban (user can rejoin)
      await ctx.telegram.banChatMember(chatId, targetId);
      await ctx.telegram.unbanChatMember(chatId, targetId);

      await logAction({
        chatId,
        chatTitle: ctx.chat.type !== "private" ? ctx.chat.title : null,
        action: "kick",
        targetUserId: targetId,
        targetUsername: targetUser?.username ?? null,
        targetFirstName: targetUser?.first_name ?? null,
        executorUserId: executor.id,
        executorUsername: executor.username ?? null,
        reason,
      });

      const targetMention = mention(
        targetId,
        targetUser?.first_name ?? targetUser?.username ?? String(targetId),
        targetUser?.username
      );

      let msg = `👢 <b>Пользователь исключён</b>\n\n`;
      msg += `👤 Пользователь: ${targetMention}\n`;
      msg += `👮 Администратор: ${mention(executor.id, executor.first_name, executor.username)}\n`;
      if (reason) msg += `📝 Причина: <i>${escapeHtml(reason)}</i>\n`;
      msg += `\n<i>Пользователь может вернуться по ссылке-приглашению.</i>`;

      await ctx.reply(msg, { parse_mode: "HTML" });
    } catch (err) {
      console.error("[kick] Error:", err);
      await ctx.reply("❌ Не удалось исключить пользователя. Проверьте права бота.", { parse_mode: "HTML" });
    }
  });
}
