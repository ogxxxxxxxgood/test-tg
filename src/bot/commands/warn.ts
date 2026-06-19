import { Telegraf, Context } from "telegraf";
import { requireModerator } from "../middlewares/adminCheck";
import {
  addWarn,
  removeLastWarn,
  clearWarns,
  getWarnCount,
  getWarnList,
  logAction,
} from "../services/moderationService";
import { getChatSettings } from "../services/chatService";
import { mention, escapeHtml } from "../utils/userMention";
import { formatDate } from "../utils/parseTime";

/**
 * /warn — issues a warning to a user
 * /unwarn — removes the last warning
 * /warns — shows warn count for a user
 * /clearwarns — clears all warnings for a user
 *
 * When a user reaches maxWarns threshold, the configured action (kick/ban/mute) is executed.
 */
export function registerWarnCommands(bot: Telegraf<Context>): void {
  // /warn
  bot.command("warn", requireModerator(), async (ctx) => {
    if (!ctx.chat || !ctx.from || !ctx.message) return;

    const chatId = ctx.chat.id;
    const executor = ctx.from;
    let targetId: number | null = null;
    let targetUser: { id: number; username?: string; first_name?: string } | null = null;
    let reason: string | null = null;

    const replyTo = ctx.message.reply_to_message;
    const text = ctx.message.text ?? "";
    const args = text.split(/\s+/).slice(1);

    if (replyTo && replyTo.from) {
      targetUser = replyTo.from;
      targetId = replyTo.from.id;
      reason = args.join(" ").trim() || null;
    } else {
      if (args.length === 0) {
        await ctx.reply(
          "❌ <b>Использование:</b>\n" +
          "• Ответом на сообщение: <code>/warn [причина]</code>\n" +
          "• Напрямую: <code>/warn @username|ID [причина]</code>",
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
            targetUser = { id: chat.id, username: "username" in chat ? chat.username : undefined, first_name: "first_name" in chat ? (chat as { first_name?: string }).first_name : undefined };
          }
        } catch {
          await ctx.reply("❌ Пользователь не найден.", { parse_mode: "HTML" });
          return;
        }
      } else {
        targetId = parseInt(target, 10);
        if (isNaN(targetId)) {
          await ctx.reply("❌ Неверный формат ID.", { parse_mode: "HTML" });
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
      const member = await ctx.telegram.getChatMember(chatId, targetId);
      if (member.status === "creator" || member.status === "administrator") {
        await ctx.reply("🚫 Нельзя выдать предупреждение администратору.", { parse_mode: "HTML" });
        return;
      }
    } catch { /* ignore */ }

    const settings = await getChatSettings(chatId);
    const maxWarns = settings?.maxWarns ?? 3;

    const warnCount = await addWarn({
      chatId,
      userId: targetId,
      username: targetUser?.username ?? null,
      firstName: targetUser?.first_name ?? null,
      warnedBy: executor.id,
      warnedByUsername: executor.username ?? null,
      reason,
    });

    await logAction({
      chatId,
      chatTitle: ctx.chat.type !== "private" ? ctx.chat.title : null,
      action: "warn",
      targetUserId: targetId,
      targetUsername: targetUser?.username ?? null,
      targetFirstName: targetUser?.first_name ?? null,
      executorUserId: executor.id,
      executorUsername: executor.username ?? null,
      reason,
      meta: { warnCount, maxWarns },
    });

    const targetMention = mention(
      targetId,
      targetUser?.first_name ?? String(targetId),
      targetUser?.username
    );

    let msg = `⚠️ <b>Предупреждение выдано</b>\n\n`;
    msg += `👤 Пользователь: ${targetMention}\n`;
    msg += `👮 Администратор: ${mention(executor.id, executor.first_name, executor.username)}\n`;
    msg += `📊 Предупреждений: <b>${warnCount}/${maxWarns}</b>\n`;
    if (reason) msg += `📝 Причина: <i>${escapeHtml(reason)}</i>\n`;

    if (warnCount >= maxWarns) {
      const action = settings?.warnAction ?? "kick";
      msg += `\n🚨 <b>Достигнут лимит предупреждений!</b>`;

      await ctx.reply(msg, { parse_mode: "HTML" });

      // Execute punishment
      try {
        if (action === "ban") {
          await ctx.telegram.banChatMember(chatId, targetId);
          await ctx.reply(
            `🔨 ${targetMention} <b>заблокирован</b> за превышение лимита предупреждений.`,
            { parse_mode: "HTML" }
          );
        } else if (action === "mute") {
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
            },
          });
          await ctx.reply(
            `🔇 ${targetMention} <b>замучен навсегда</b> за превышение лимита предупреждений.`,
            { parse_mode: "HTML" }
          );
        } else {
          // default: kick
          await ctx.telegram.banChatMember(chatId, targetId);
          await ctx.telegram.unbanChatMember(chatId, targetId);
          await ctx.reply(
            `👢 ${targetMention} <b>исключён</b> за превышение лимита предупреждений.`,
            { parse_mode: "HTML" }
          );
        }

        await clearWarns(chatId, targetId);
      } catch (err) {
        console.error("[warn] Auto-action error:", err);
      }
    } else {
      await ctx.reply(msg, { parse_mode: "HTML" });
    }
  });

  // /unwarn
  bot.command("unwarn", requireModerator(), async (ctx) => {
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
      if (!args[0]) {
        await ctx.reply("❌ Укажите пользователя: <code>/unwarn @username|ID</code>", { parse_mode: "HTML" });
        return;
      }
      const target = args[0];
      if (target.startsWith("@")) {
        try {
          const chat = await ctx.telegram.getChat(target);
          if ("id" in chat) { targetId = chat.id; targetUser = { id: chat.id, username: "username" in chat ? chat.username : undefined }; }
        } catch {
          await ctx.reply("❌ Пользователь не найден.", { parse_mode: "HTML" });
          return;
        }
      } else {
        targetId = parseInt(target, 10);
        if (isNaN(targetId)) { await ctx.reply("❌ Неверный ID.", { parse_mode: "HTML" }); return; }
        try { const m = await ctx.telegram.getChatMember(chatId, targetId); targetUser = m.user; } catch { targetUser = { id: targetId }; }
      }
    }

    if (!targetId) return;

    const removed = await removeLastWarn(chatId, targetId);
    const remaining = await getWarnCount(chatId, targetId);
    const targetMention = mention(targetId, targetUser?.first_name ?? String(targetId), targetUser?.username);

    if (!removed) {
      await ctx.reply(`ℹ️ У ${targetMention} нет активных предупреждений.`, { parse_mode: "HTML" });
      return;
    }

    await ctx.reply(
      `✅ <b>Предупреждение снято</b>\n\n` +
      `👤 Пользователь: ${targetMention}\n` +
      `📊 Осталось предупреждений: <b>${remaining}</b>`,
      { parse_mode: "HTML" }
    );
  });

  // /warns
  bot.command("warns", requireModerator(), async (ctx) => {
    if (!ctx.chat || !ctx.from || !ctx.message) return;

    const chatId = ctx.chat.id;
    let targetId: number | null = null;
    let targetUser: { id: number; username?: string; first_name?: string } | null = null;

    const replyTo = ctx.message.reply_to_message;
    if (replyTo && replyTo.from) {
      targetUser = replyTo.from;
      targetId = replyTo.from.id;
    } else {
      const text = ctx.message.text ?? "";
      const args = text.split(/\s+/).slice(1);
      if (!args[0]) {
        await ctx.reply("❌ Укажите пользователя: <code>/warns @username|ID</code>", { parse_mode: "HTML" });
        return;
      }
      const target = args[0];
      if (target.startsWith("@")) {
        try { const chat = await ctx.telegram.getChat(target); if ("id" in chat) { targetId = chat.id; targetUser = { id: chat.id, username: "username" in chat ? chat.username : undefined }; } } catch { await ctx.reply("❌ Не найден.", { parse_mode: "HTML" }); return; }
      } else {
        targetId = parseInt(target, 10);
        if (isNaN(targetId)) { await ctx.reply("❌ Неверный ID.", { parse_mode: "HTML" }); return; }
        try { const m = await ctx.telegram.getChatMember(chatId, targetId); targetUser = m.user; } catch { targetUser = { id: targetId }; }
      }
    }

    if (!targetId) return;

    const settings = await getChatSettings(chatId);
    const maxWarns = settings?.maxWarns ?? 3;
    const warnList = await getWarnList(chatId, targetId);
    const targetMention = mention(targetId, targetUser?.first_name ?? String(targetId), targetUser?.username);

    if (warnList.length === 0) {
      await ctx.reply(`ℹ️ У ${targetMention} нет активных предупреждений.`, { parse_mode: "HTML" });
      return;
    }

    let msg = `⚠️ <b>Предупреждения пользователя</b> ${targetMention}\n`;
    msg += `📊 <b>${warnList.length}/${maxWarns}</b>\n\n`;

    for (let i = 0; i < warnList.length; i++) {
      const w = warnList[i];
      msg += `${i + 1}. 📅 ${formatDate(new Date(w.createdAt))}`;
      if (w.reason) msg += ` — <i>${escapeHtml(w.reason)}</i>`;
      msg += "\n";
    }

    await ctx.reply(msg, { parse_mode: "HTML" });
  });

  // /clearwarns
  bot.command("clearwarns", requireModerator(), async (ctx) => {
    if (!ctx.chat || !ctx.from || !ctx.message) return;

    const chatId = ctx.chat.id;
    let targetId: number | null = null;
    let targetUser: { id: number; username?: string; first_name?: string } | null = null;

    const replyTo = ctx.message.reply_to_message;
    if (replyTo && replyTo.from) {
      targetUser = replyTo.from;
      targetId = replyTo.from.id;
    } else {
      const text = ctx.message.text ?? "";
      const args = text.split(/\s+/).slice(1);
      if (!args[0]) { await ctx.reply("❌ Укажите пользователя: <code>/clearwarns @username|ID</code>", { parse_mode: "HTML" }); return; }
      const target = args[0];
      if (target.startsWith("@")) {
        try { const chat = await ctx.telegram.getChat(target); if ("id" in chat) { targetId = chat.id; targetUser = { id: chat.id, username: "username" in chat ? chat.username : undefined }; } } catch { await ctx.reply("❌ Не найден.", { parse_mode: "HTML" }); return; }
      } else {
        targetId = parseInt(target, 10);
        if (isNaN(targetId)) { await ctx.reply("❌ Неверный ID.", { parse_mode: "HTML" }); return; }
        try { const m = await ctx.telegram.getChatMember(chatId, targetId); targetUser = m.user; } catch { targetUser = { id: targetId }; }
      }
    }

    if (!targetId) return;

    await clearWarns(chatId, targetId);
    const targetMention = mention(targetId, targetUser?.first_name ?? String(targetId), targetUser?.username);

    await ctx.reply(
      `🧹 <b>Предупреждения сброшены</b>\n\n👤 Пользователь: ${targetMention}`,
      { parse_mode: "HTML" }
    );
  });
}
