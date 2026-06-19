import { Telegraf, Context } from "telegraf";
import { ChatMemberUpdated } from "telegraf/types";
import {
  upsertChat,
  registerFounder,
  createPendingAdminCheck,
  resolvePendingAdminCheck,
  getChatSettings,
} from "../services/chatService";
import { isBanned } from "../services/moderationService";
import { escapeHtml } from "../utils/userMention";
import { getRequiredBotPermissions } from "../utils/permissions";

// In-memory map for pending admin checks (chatId -> timeout handle)
const pendingChecks = new Map<number, ReturnType<typeof setTimeout>>();

/**
 * Handles bot being added to a group
 */
export function registerNewMemberHandler(bot: Telegraf<Context>): void {
  // ─── Bot added to a group ───────────────────────────────────────────────────
  bot.on("my_chat_member", async (ctx) => {
    const update = ctx.myChatMember;
    if (!update) return;

    const { chat, new_chat_member, from } = update as ChatMemberUpdated;

    if (chat.type === "private") return;
    if (!("title" in chat)) return;

    const me = await ctx.telegram.getMe();
    if (new_chat_member.user.id !== me.id) return;

    const wasAdded =
      new_chat_member.status === "member" ||
      new_chat_member.status === "administrator";

    const wasRemoved =
      new_chat_member.status === "left" || new_chat_member.status === "kicked";

    if (wasRemoved) {
      // Bot left/kicked — mark chat inactive
      const { setChatActive } = await import("../services/chatService");
      await setChatActive(chat.id, false);
      return;
    }

    if (!wasAdded) return;

    // Bot was added — upsert chat record
    let memberCount = 0;
    try {
      memberCount = await ctx.telegram.getChatMembersCount(chat.id);
    } catch { /* ignore */ }

    await upsertChat(chat as Parameters<typeof upsertChat>[0], memberCount);

    // Try to find and register the creator
    try {
      const admins = await ctx.telegram.getChatAdministrators(chat.id);
      const creator = admins.find((a) => a.status === "creator");
      if (creator) {
        await registerFounder(
          chat.id,
          creator.user.id,
          creator.user.first_name,
          creator.user.username
        );
      }
    } catch { /* ignore */ }

    // Check if already admin
    const isAlreadyAdmin = new_chat_member.status === "administrator";

    if (isAlreadyAdmin) {
      await resolvePendingAdminCheck(chat.id);
      try {
        await ctx.telegram.sendMessage(
          chat.id,
          `🛡️ <b>Guard Bot активирован!</b>\n\n` +
          `Я готов защищать этот чат.\n` +
          `Используйте /help для просмотра доступных команд.\n` +
          `Создатель чата может назначать модераторов командой /addadmin`,
          { parse_mode: "HTML" }
        );
      } catch { /* ignore */ }
    } else {
      // Not admin yet — schedule 5-minute check
      await createPendingAdminCheck(chat.id);

      try {
        await ctx.telegram.sendMessage(
          chat.id,
          `👋 <b>Привет! Я Guard Bot — бот для модерации.</b>\n\n` +
          `⚠️ <b>ВАЖНО:</b> Для корректной работы мне необходимы права администратора.\n` +
          `Пожалуйста, выдайте мне права администратора в течение <b>5 минут</b>, иначе я автоматически покину чат.`,
          { parse_mode: "HTML" }
        );
      } catch { /* ignore */ }

      // Cancel existing timeout if any
      if (pendingChecks.has(chat.id)) {
        clearTimeout(pendingChecks.get(chat.id)!);
      }

      // Schedule auto-leave after 5 minutes
      const timeoutHandle = setTimeout(async () => {
        pendingChecks.delete(chat.id);
        try {
          const member = await ctx.telegram.getChatMember(chat.id, me.id);
          if (member.status !== "administrator") {
            await ctx.telegram.sendMessage(
              chat.id,
              `⏰ <b>Время истекло!</b>\n\nМне не были выданы права администратора. Покидаю чат.\n` +
              `Добавьте меня снова и сразу выдайте права администратора.`,
              { parse_mode: "HTML" }
            );
            await ctx.telegram.leaveChat(chat.id);
            const { setChatActive } = await import("../services/chatService");
            await setChatActive(chat.id, false);
          }
        } catch { /* ignore */ }
      }, 5 * 60 * 1000);

      pendingChecks.set(chat.id, timeoutHandle);
    }
  });

  // ─── Bot promoted to admin — cancel pending check ───────────────────────────
  bot.on("chat_member", async (ctx) => {
    const update = ctx.chatMember;
    if (!update) return;

    const me = await ctx.telegram.getMe();
    const { new_chat_member, chat } = update;

    // Check if bot was promoted
    if (
      new_chat_member.user.id === me.id &&
      new_chat_member.status === "administrator"
    ) {
      if (pendingChecks.has(chat.id)) {
        clearTimeout(pendingChecks.get(chat.id)!);
        pendingChecks.delete(chat.id);
      }
      await resolvePendingAdminCheck(chat.id);

      // Update invite link for private chats
      try {
        const chatInfo = await ctx.telegram.getChat(chat.id);
        if (!("username" in chatInfo) || !chatInfo.username) {
          const link = await ctx.telegram.exportChatInviteLink(chat.id);
          const { setChatInviteLink } = await import("../services/chatService");
          await setChatInviteLink(chat.id, link);
        }
      } catch { /* ignore */ }

      try {
        await ctx.telegram.sendMessage(
          chat.id,
          `✅ <b>Отлично! Права администратора получены.</b>\n\nGuard Bot готов к работе! Используйте /help`,
          { parse_mode: "HTML" }
        );
      } catch { /* ignore */ }
      return;
    }

    // ─── New member joined — check banlist ────────────────────────────────────
    if (
      new_chat_member.status === "member" &&
      new_chat_member.user.id !== me.id
    ) {
      const userId = new_chat_member.user.id;
      const chatId = chat.id;

      // Check if the user is in the chat's banlist
      const banned = await isBanned(chatId, userId);
      if (banned) {
        try {
          await ctx.telegram.banChatMember(chatId, userId);
          await ctx.telegram.sendMessage(
            chatId,
            `🚫 Пользователь <a href="tg://user?id=${userId}">${escapeHtml(
              new_chat_member.user.first_name ?? String(userId)
            )}</a> находится в чёрном списке и был автоматически заблокирован.`,
            { parse_mode: "HTML" }
          );
        } catch { /* ignore */ }
        return;
      }

      // Send welcome message if configured
      try {
        const settings = await getChatSettings(chatId);
        if (settings?.welcomeEnabled && settings.welcomeMessage) {
          const userName = escapeHtml(
            [new_chat_member.user.first_name, new_chat_member.user.last_name]
              .filter(Boolean)
              .join(" ") || String(userId)
          );
          const welcomeText = settings.welcomeMessage
            .replace("{name}", `<a href="tg://user?id=${userId}">${userName}</a>`)
            .replace("{username}", new_chat_member.user.username ? `@${new_chat_member.user.username}` : userName)
            .replace("{chat}", "title" in chat ? escapeHtml(chat.title) : "чат");

          await ctx.telegram.sendMessage(chatId, welcomeText, { parse_mode: "HTML" });
        }
      } catch { /* ignore */ }

      // Update member count
      try {
        const count = await ctx.telegram.getChatMembersCount(chatId);
        const { updateMemberCount } = await import("../services/chatService");
        await updateMemberCount(chatId, count);
      } catch { /* ignore */ }
    }

    // ─── Member left ──────────────────────────────────────────────────────────
    if (
      (new_chat_member.status === "left" || new_chat_member.status === "kicked") &&
      new_chat_member.user.id !== me.id
    ) {
      try {
        const count = await ctx.telegram.getChatMembersCount(chat.id);
        const { updateMemberCount } = await import("../services/chatService");
        await updateMemberCount(chat.id, count);
      } catch { /* ignore */ }
    }
  });
}
