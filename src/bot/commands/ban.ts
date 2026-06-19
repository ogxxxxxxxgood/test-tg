import { Telegraf, Context } from "telegraf";
import { requireModerator } from "../middlewares/adminCheck";
import { addBan, logAction } from "../services/moderationService";
import { mention, escapeHtml } from "../utils/userMention";

/**
 * /ban — permanently bans a user from the chat
 *
 * Usage:
 *   Reply to a message: /ban [reason]
 *   Direct:            /ban @username [reason]
 *   Direct:            /ban 123456789 [reason]
 */
export function registerBanCommand(bot: Telegraf<Context>): void {
  bot.command("ban", requireModerator(), async (ctx) => {
    if (!ctx.chat || !ctx.from || !ctx.message) return;

    const chatId = ctx.chat.id;
    const executor = ctx.from;
    let targetId: number | null = null;
    let targetUser: { id: number; username?: string; first_name?: string; last_name?: string } | null = null;
    let reason: string | null = null;

    // Check if reply
    const replyTo = ctx.message.reply_to_message;
    if (replyTo && replyTo.from) {
      targetUser = replyTo.from;
      targetId = replyTo.from.id;
      // Everything after /ban is the reason
      const text = ctx.message.text ?? "";
      const args = text.split(/\s+/).slice(1);
      reason = args.join(" ").trim() || null;
    } else {
      // Parse args: /ban @username|ID [reason...]
      const text = ctx.message.text ?? "";
      const args = text.split(/\s+/).slice(1);
      if (args.length === 0) {
        await ctx.reply(
          "❌ <b>Использование:</b>\n" +
          "• Ответом на сообщение: <code>/ban [причина]</code>\n" +
          "• Напрямую: <code>/ban @username|ID [причина]</code>",
          { parse_mode: "HTML" }
        );
        return;
      }

      const target = args[0];
      reason = args.slice(1).join(" ").trim() || null;

      // Resolve user
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
          await ctx.reply("❌ Пользователь не найден. Убедитесь, что он есть в чате.", { parse_mode: "HTML" });
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

    // Cannot ban admins/owner
    try {
      const member = await ctx.telegram.getChatMember(chatId, targetId);
      if (member.status === "creator") {
        await ctx.reply("🚫 Невозможно заблокировать создателя чата.", { parse_mode: "HTML" });
        return;
      }
      if (member.status === "administrator") {
        await ctx.reply("🚫 Невозможно заблокировать администратора чата.", { parse_mode: "HTML" });
        return;
      }
    } catch {
      // User may not be in chat — proceed with ban anyway
    }

    // Cannot ban the bot itself
    const me = await ctx.telegram.getMe();
    if (targetId === me.id) {
      await ctx.reply("😅 Я не могу заблокировать самого себя.", { parse_mode: "HTML" });
      return;
    }

    // Cannot ban the executor themselves
    if (targetId === executor.id) {
      await ctx.reply("😅 Вы не можете заблокировать самого себя.", { parse_mode: "HTML" });
      return;
    }

    try {
      await ctx.telegram.banChatMember(chatId, targetId);

      // Save to DB
      await addBan({
        chatId,
        userId: targetId,
        username: targetUser?.username ?? null,
        firstName: targetUser?.first_name ?? null,
        lastName: targetUser?.last_name ?? null,
        bannedBy: executor.id,
        bannedByUsername: executor.username ?? null,
        reason,
      });

      // Log action
      await logAction({
        chatId,
        chatTitle: ctx.chat.type !== "private" ? ctx.chat.title : null,
        action: "ban",
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

      let msg = `🔨 <b>Пользователь заблокирован</b>\n\n`;
      msg += `👤 Пользователь: ${targetMention}\n`;
      msg += `👮 Администратор: ${mention(executor.id, executor.first_name, executor.username)}\n`;
      if (reason) msg += `📝 Причина: <i>${escapeHtml(reason)}</i>\n`;
      msg += `\n<i>Пользователь занесён в чёрный список.</i>`;

      await ctx.reply(msg, { parse_mode: "HTML" });
    } catch (err) {
      console.error("[ban] Error:", err);
      await ctx.reply("❌ Не удалось заблокировать пользователя. Проверьте права бота.", { parse_mode: "HTML" });
    }
  });
}
