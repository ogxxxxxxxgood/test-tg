import { Telegraf, Context } from "telegraf";
import { isTelegramOwner, canModerate } from "../utils/permissions";
import { addBotAdmin, removeBotAdmin, getChatAdmins } from "../services/moderationService";
import { mention, escapeHtml } from "../utils/userMention";
import { formatDate } from "../utils/parseTime";

/**
 * /addadmin — grants bot-admin moderation rights to a user
 *   If user is not a Telegram admin yet, the bot will try to promote them.
 *
 * /removeadmin — revokes bot-admin rights
 * /admins — lists all bot-registered admins in the chat
 *
 * Only the Telegram chat CREATOR can use these commands.
 */
export function registerAdminCommands(bot: Telegraf<Context>): void {
  // /addadmin
  bot.command("addadmin", async (ctx) => {
    if (!ctx.chat || !ctx.from || !ctx.message) return;
    if (ctx.chat.type === "private") {
      await ctx.reply("⚠️ Эта команда работает только в групповых чатах.", { parse_mode: "HTML" });
      return;
    }

    const chatId = ctx.chat.id;
    const executor = ctx.from;

    // Only Telegram owner or developer can use this
    const isOwner = await isTelegramOwner(ctx, chatId, executor.id);
    const isDev = executor.id === Number(process.env.DEVELOPER_ID ?? "0");
    if (!isOwner && !isDev) {
      await ctx.reply("🚫 Только создатель чата может назначать администраторов.", { parse_mode: "HTML" });
      return;
    }

    const text = ctx.message.text ?? "";
    const args = text.split(/\s+/).slice(1);

    let targetId: number | null = null;
    let targetUser: { id: number; username?: string; first_name?: string } | null = null;

    const replyTo = ctx.message.reply_to_message;
    if (replyTo && replyTo.from) {
      targetUser = replyTo.from;
      targetId = replyTo.from.id;
    } else {
      if (!args[0]) {
        await ctx.reply(
          "❌ <b>Использование:</b>\n" +
          "• Ответом: <code>/addadmin</code>\n" +
          "• Напрямую: <code>/addadmin @username|ID</code>",
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

    // Check if user is currently a Telegram admin
    let isAlreadyAdmin = false;
    try {
      const member = await ctx.telegram.getChatMember(chatId, targetId);
      isAlreadyAdmin = member.status === "administrator" || member.status === "creator";
    } catch { /* ignore */ }

    const targetMention = mention(
      targetId,
      targetUser?.first_name ?? String(targetId),
      targetUser?.username
    );

    // If not admin, promote them in Telegram
    if (!isAlreadyAdmin) {
      try {
        await ctx.telegram.promoteChatMember(chatId, targetId, {
          can_delete_messages: true,
          can_restrict_members: true,
          can_invite_users: true,
          can_pin_messages: true,
          can_manage_chat: true,
          is_anonymous: false,
        });
        await ctx.reply(
          `✅ ${targetMention} получил права администратора в Telegram.`,
          { parse_mode: "HTML" }
        );
      } catch {
        await ctx.reply(
          `⚠️ Не удалось выдать права администратора ${targetMention} в Telegram.\n` +
          `Всё равно регистрирую его как бот-администратора.`,
          { parse_mode: "HTML" }
        );
      }
    }

    // Register in bot DB
    await addBotAdmin({
      chatId,
      userId: targetId,
      username: targetUser?.username ?? null,
      firstName: targetUser?.first_name ?? null,
      addedBy: executor.id,
    });

    await ctx.reply(
      `👑 <b>Администратор назначен</b>\n\n` +
      `👤 Пользователь: ${targetMention}\n` +
      `👮 Назначил: ${mention(executor.id, executor.first_name, executor.username)}\n\n` +
      `<i>Теперь пользователь может использовать все команды модерации.</i>`,
      { parse_mode: "HTML" }
    );
  });

  // /removeadmin
  bot.command("removeadmin", async (ctx) => {
    if (!ctx.chat || !ctx.from || !ctx.message) return;
    if (ctx.chat.type === "private") return;

    const chatId = ctx.chat.id;
    const executor = ctx.from;

    const isOwner = await isTelegramOwner(ctx, chatId, executor.id);
    const isDev = executor.id === Number(process.env.DEVELOPER_ID ?? "0");
    if (!isOwner && !isDev) {
      await ctx.reply("🚫 Только создатель чата может снимать администраторов.", { parse_mode: "HTML" });
      return;
    }

    const text = ctx.message.text ?? "";
    const args = text.split(/\s+/).slice(1);
    let targetId: number | null = null;
    let targetUser: { id: number; username?: string; first_name?: string } | null = null;

    const replyTo = ctx.message.reply_to_message;
    if (replyTo && replyTo.from) {
      targetUser = replyTo.from;
      targetId = replyTo.from.id;
    } else if (args[0]) {
      const target = args[0];
      if (target.startsWith("@")) {
        try { const chat = await ctx.telegram.getChat(target); if ("id" in chat) { targetId = chat.id; targetUser = { id: chat.id, username: "username" in chat ? chat.username : undefined }; } } catch { await ctx.reply("❌ Не найден.", { parse_mode: "HTML" }); return; }
      } else {
        targetId = parseInt(target, 10);
        if (isNaN(targetId)) { await ctx.reply("❌ Неверный ID.", { parse_mode: "HTML" }); return; }
        try { const m = await ctx.telegram.getChatMember(chatId, targetId); targetUser = m.user; } catch { targetUser = { id: targetId }; }
      }
    } else {
      await ctx.reply("❌ Укажите пользователя: <code>/removeadmin @username|ID</code>", { parse_mode: "HTML" });
      return;
    }

    if (!targetId) return;

    await removeBotAdmin(chatId, targetId);
    const targetMention = mention(targetId, targetUser?.first_name ?? String(targetId), targetUser?.username);

    await ctx.reply(
      `🔻 <b>Права администратора сняты</b>\n\n👤 ${targetMention}`,
      { parse_mode: "HTML" }
    );
  });

  // /admins
  bot.command("admins", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;

    const canMod = await canModerate(ctx, ctx.chat.id, ctx.from.id);
    if (!canMod) return;

    const admins = await getChatAdmins(ctx.chat.id);

    if (admins.length === 0) {
      await ctx.reply(
        "ℹ️ <b>Список администраторов бота пуст.</b>\n\nИспользуйте /addadmin для назначения администраторов.",
        { parse_mode: "HTML" }
      );
      return;
    }

    let msg = `👑 <b>Администраторы бота</b>\n\n`;
    for (const admin of admins) {
      const name = admin.firstName ?? admin.username ?? String(admin.userId);
      const userTag = admin.username ? ` (@${escapeHtml(admin.username)})` : "";
      msg += admin.isFounder
        ? `⭐ <a href="tg://user?id=${admin.userId}">${escapeHtml(name)}</a>${userTag} — <b>Создатель</b>\n`
        : `👮 <a href="tg://user?id=${admin.userId}">${escapeHtml(name)}</a>${userTag}\n`;
      msg += `   📅 ${formatDate(new Date(admin.addedAt))}\n\n`;
    }

    await ctx.reply(msg, { parse_mode: "HTML" });
  });
}
