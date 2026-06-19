import { Telegraf, Context } from "telegraf";
import { requireModerator } from "../middlewares/adminCheck";
import { removeMute, logAction } from "../services/moderationService";
import { mention } from "../utils/userMention";

/**
 * /unmute — removes mute restrictions from a user
 *
 * Usage:
 *   Reply to a message: /unmute
 *   Direct:            /unmute @username|ID
 */
export function registerUnmuteCommand(bot: Telegraf<Context>): void {
  bot.command("unmute", requireModerator(), async (ctx) => {
    if (!ctx.chat || !ctx.from || !ctx.message) return;

    const chatId = ctx.chat.id;
    const executor = ctx.from;
    let targetId: number | null = null;
    let targetUser: { id: number; username?: string; first_name?: string } | null = null;

    const replyTo = ctx.message.reply_to_message;
    if (replyTo && replyTo.from) {
      targetUser = replyTo.from;
      targetId = replyTo.from.id;
    } else {
      const text = ctx.message.text ?? "";
      const args = text.split(/\s+/).slice(1);
      if (args.length === 0) {
        await ctx.reply(
          "❌ <b>Использование:</b>\n" +
          "• Ответом на сообщение: <code>/unmute</code>\n" +
          "• Напрямую: <code>/unmute @username|ID</code>",
          { parse_mode: "HTML" }
        );
        return;
      }

      const target = args[0];
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

    try {
      // Restore default member permissions
      await ctx.telegram.restrictChatMember(chatId, targetId, {
        permissions: {
          can_send_messages: true,
          can_send_audios: true,
          can_send_documents: true,
          can_send_photos: true,
          can_send_videos: true,
          can_send_video_notes: true,
          can_send_voice_notes: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
          can_change_info: false,
          can_invite_users: true,
          can_pin_messages: false,
        },
      });

      await removeMute(chatId, targetId);

      await logAction({
        chatId,
        chatTitle: ctx.chat.type !== "private" ? ctx.chat.title : null,
        action: "unmute",
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
        `🔊 <b>Мут снят</b>\n\n` +
        `👤 Пользователь: ${targetMention}\n` +
        `👮 Администратор: ${mention(executor.id, executor.first_name, executor.username)}`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      console.error("[unmute] Error:", err);
      await ctx.reply("❌ Не удалось снять мут. Проверьте права бота.", { parse_mode: "HTML" });
    }
  });
}
