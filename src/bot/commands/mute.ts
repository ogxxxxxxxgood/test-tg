import { Telegraf, Context } from "telegraf";
import { requireModerator } from "../middlewares/adminCheck";
import { addMute, logAction } from "../services/moderationService";
import { mention, escapeHtml } from "../utils/userMention";
import { parseTime, secondsFromNow } from "../utils/parseTime";

/**
 * /mute — restricts a user from sending any messages or media
 *
 * Usage:
 *   Reply to a message: /mute <time> [reason]   e.g. /mute 1h spam
 *   Direct:            /mute @username|ID <time> [reason]
 *
 * Time format: 30s | 5m | 2h | 1d | 1w | permanent (0 or no time)
 */
export function registerMuteCommand(bot: Telegraf<Context>): void {
  bot.command("mute", requireModerator(), async (ctx) => {
    if (!ctx.chat || !ctx.from || !ctx.message) return;

    const chatId = ctx.chat.id;
    const executor = ctx.from;
    let targetId: number | null = null;
    let targetUser: { id: number; username?: string; first_name?: string } | null = null;
    let reason: string | null = null;
    let durationSeconds: number | null = null;
    let durationLabel = "навсегда";

    const text = ctx.message.text ?? "";
    const args = text.split(/\s+/).slice(1);

    const replyTo = ctx.message.reply_to_message;
    if (replyTo && replyTo.from) {
      // Reply mode: /mute <time> [reason]
      targetUser = replyTo.from;
      targetId = replyTo.from.id;

      if (args.length === 0) {
        await ctx.reply(
          "❌ При использовании ответом на сообщение необходимо указать время.\n" +
          "Пример: <code>/mute 1h спам</code>",
          { parse_mode: "HTML" }
        );
        return;
      }

      const timeParsed = parseTime(args[0]);
      if (timeParsed) {
        durationSeconds = timeParsed.seconds;
        durationLabel = timeParsed.label;
        reason = args.slice(1).join(" ").trim() || null;
      } else {
        // No time parsed — treat all as reason, mute permanently
        reason = args.join(" ").trim() || null;
      }
    } else {
      // Direct mode: /mute @username|ID <time> [reason]
      if (args.length === 0) {
        await ctx.reply(
          "❌ <b>Использование:</b>\n" +
          "• Ответом на сообщение: <code>/mute &lt;время&gt; [причина]</code>\n" +
          "• Напрямую: <code>/mute @username|ID &lt;время&gt; [причина]</code>\n\n" +
          "<b>Форматы времени:</b> <code>30s</code>, <code>5m</code>, <code>2h</code>, <code>1d</code>, <code>1w</code>",
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

      // Parse optional time (2nd arg)
      if (args.length > 1) {
        const timeParsed = parseTime(args[1]);
        if (timeParsed) {
          durationSeconds = timeParsed.seconds;
          durationLabel = timeParsed.label;
          reason = args.slice(2).join(" ").trim() || null;
        } else {
          reason = args.slice(1).join(" ").trim() || null;
        }
      }
    }

    if (!targetId) return;

    // Protect creator and admins
    try {
      const member = await ctx.telegram.getChatMember(chatId, targetId);
      if (member.status === "creator") {
        await ctx.reply("🚫 Невозможно замутить создателя чата.", { parse_mode: "HTML" });
        return;
      }
      if (member.status === "administrator") {
        await ctx.reply("🚫 Невозможно замутить администратора чата.", { parse_mode: "HTML" });
        return;
      }
    } catch {
      // not in chat
    }

    const me = await ctx.telegram.getMe();
    if (targetId === me.id || targetId === executor.id) {
      await ctx.reply("😅 Невозможная операция.", { parse_mode: "HTML" });
      return;
    }

    try {
      const muteUntil = durationSeconds ? secondsFromNow(durationSeconds) : undefined;

      // Restrict ALL message types
      await ctx.telegram.restrictChatMember(chatId, targetId, {
        permissions: {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
        },
        until_date: muteUntil ? Math.floor(muteUntil.getTime() / 1000) : undefined,
      });

      await addMute({
        chatId,
        userId: targetId,
        username: targetUser?.username ?? null,
        firstName: targetUser?.first_name ?? null,
        mutedBy: executor.id,
        mutedByUsername: executor.username ?? null,
        reason,
        durationSeconds,
      });

      await logAction({
        chatId,
        chatTitle: ctx.chat.type !== "private" ? ctx.chat.title : null,
        action: "mute",
        targetUserId: targetId,
        targetUsername: targetUser?.username ?? null,
        targetFirstName: targetUser?.first_name ?? null,
        executorUserId: executor.id,
        executorUsername: executor.username ?? null,
        reason,
        meta: { durationSeconds, durationLabel },
      });

      const targetMention = mention(
        targetId,
        targetUser?.first_name ?? targetUser?.username ?? String(targetId),
        targetUser?.username
      );

      let msg = `🔇 <b>Пользователь замучен</b>\n\n`;
      msg += `👤 Пользователь: ${targetMention}\n`;
      msg += `👮 Администратор: ${mention(executor.id, executor.first_name, executor.username)}\n`;
      msg += `⏱ Длительность: <b>${durationLabel}</b>\n`;
      if (reason) msg += `📝 Причина: <i>${escapeHtml(reason)}</i>\n`;

      await ctx.reply(msg, { parse_mode: "HTML" });
    } catch (err) {
      console.error("[mute] Error:", err);
      await ctx.reply("❌ Не удалось замутить пользователя. Проверьте права бота.", { parse_mode: "HTML" });
    }
  });
}
