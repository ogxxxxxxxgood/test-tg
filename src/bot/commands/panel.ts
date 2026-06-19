import { Telegraf, Context } from "telegraf";
import { requireDeveloperPM } from "../middlewares/adminCheck";
import {
  getAllChats,
  setChatActive,
  ensureInviteLink,
} from "../services/chatService";
import { escapeHtml } from "../utils/userMention";
import { formatDate, timeAgo } from "../utils/parseTime";
import { Markup } from "telegraf";

/**
 * /panel — developer control panel (PM only)
 * Shows all chats with management options
 */
export function registerPanelCommands(bot: Telegraf<Context>): void {
  // /panel — main developer menu
  bot.command("panel", requireDeveloperPM(), async (ctx) => {
    await sendMainPanel(ctx);
  });

  // Handle inline keyboard callbacks for the developer panel
  bot.action(/^panel_chats$/, requireDeveloperPM(), async (ctx) => {
    await ctx.answerCbQuery();
    await sendChatList(ctx);
  });

  bot.action(/^panel_main$/, requireDeveloperPM(), async (ctx) => {
    await ctx.answerCbQuery();
    await sendMainPanel(ctx);
  });

  bot.action(/^chat_info_(-?\d+)$/, requireDeveloperPM(), async (ctx) => {
    await ctx.answerCbQuery();
    const chatId = parseInt(ctx.match[1], 10);
    await sendChatInfo(ctx, chatId);
  });

  bot.action(/^chat_pause_(-?\d+)$/, requireDeveloperPM(), async (ctx) => {
    await ctx.answerCbQuery("⏸ Обрабатываю...");
    const chatId = parseInt(ctx.match[1], 10);
    await setChatActive(chatId, false);
    await ctx.editMessageText(
      "⏸ <b>Работа бота в чате приостановлена.</b>\n\nДля возобновления используйте /panel",
      { parse_mode: "HTML" }
    );
  });

  bot.action(/^chat_resume_(-?\d+)$/, requireDeveloperPM(), async (ctx) => {
    await ctx.answerCbQuery("▶️ Обрабатываю...");
    const chatId = parseInt(ctx.match[1], 10);
    await setChatActive(chatId, true);
    await ctx.editMessageText(
      "▶️ <b>Работа бота в чате возобновлена.</b>\n\nДля управления используйте /panel",
      { parse_mode: "HTML" }
    );
  });

  bot.action(/^chat_leave_(-?\d+)$/, requireDeveloperPM(), async (ctx) => {
    await ctx.answerCbQuery();
    const chatId = parseInt(ctx.match[1], 10);
    await ctx.editMessageText(
      "⚠️ <b>Подтвердите выход из чата</b>\n\nБот покинет группу. Это действие нельзя отменить.",
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("✅ Да, выйти", `chat_leave_confirm_${chatId}`)],
          [Markup.button.callback("❌ Отмена", `chat_info_${chatId}`)],
        ]),
      }
    );
  });

  bot.action(/^chat_leave_confirm_(-?\d+)$/, requireDeveloperPM(), async (ctx) => {
    await ctx.answerCbQuery("🚪 Выхожу...");
    const chatId = parseInt(ctx.match[1], 10);
    try {
      await ctx.telegram.leaveChat(chatId);
      await setChatActive(chatId, false);
      await ctx.editMessageText(
        "✅ Бот успешно покинул чат.",
        { parse_mode: "HTML" }
      );
    } catch {
      await ctx.editMessageText(
        "❌ Не удалось покинуть чат. Возможно, бот уже не является участником.",
        { parse_mode: "HTML" }
      );
    }
  });

  bot.action(/^chat_link_(-?\d+)$/, requireDeveloperPM(), async (ctx) => {
    await ctx.answerCbQuery("🔗 Получаю ссылку...");
    const chatId = parseInt(ctx.match[1], 10);
    const link = await ensureInviteLink(ctx, chatId);
    if (link) {
      await ctx.reply(`🔗 Ссылка-приглашение:\n${link}`);
    } else {
      await ctx.reply("❌ Не удалось получить ссылку. Проверьте права бота.");
    }
  });

  bot.action(/^chats_page_(\d+)$/, requireDeveloperPM(), async (ctx) => {
    await ctx.answerCbQuery();
    const page = parseInt(ctx.match[1], 10);
    await sendChatList(ctx, page);
  });
}

async function sendMainPanel(ctx: Context): Promise<void> {
  const allChats = await getAllChats();
  const activeCount = allChats.filter((c) => c.isActive).length;
  const totalCount = allChats.length;

  const devId = Number(process.env.DEVELOPER_ID ?? "0");

  const msg =
    `🔧 <b>Панель управления Guard Bot</b>\n\n` +
    `👤 Разработчик: <code>${devId}</code>\n` +
    `📊 Всего чатов: <b>${totalCount}</b>\n` +
    `✅ Активных: <b>${activeCount}</b>\n` +
    `⏸ Приостановлено: <b>${totalCount - activeCount}</b>\n\n` +
    `📅 ${formatDate(new Date())}`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("📋 Список чатов", "panel_chats")],
  ]);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(msg, { parse_mode: "HTML", ...keyboard });
  } else {
    await ctx.reply(msg, { parse_mode: "HTML", ...keyboard });
  }
}

async function sendChatList(ctx: Context, page = 0): Promise<void> {
  const PAGE_SIZE = 5;
  const allChats = await getAllChats();
  const total = allChats.length;
  const start = page * PAGE_SIZE;
  const pageChats = allChats.slice(start, start + PAGE_SIZE);

  if (total === 0) {
    const msg = "📭 <b>Нет чатов</b>\n\nБот ещё не добавлен ни в одну группу.";
    if (ctx.callbackQuery) {
      await ctx.editMessageText(msg, { parse_mode: "HTML" });
    } else {
      await ctx.reply(msg, { parse_mode: "HTML" });
    }
    return;
  }

  let msg = `📋 <b>Чаты бота</b> (${total} всего)\n`;
  msg += `Страница ${page + 1} из ${Math.ceil(total / PAGE_SIZE)}\n\n`;

  for (const chat of pageChats) {
    const status = chat.isActive ? "✅" : "⏸";
    const type = chat.type === "supergroup" ? "Супергруппа" : "Группа";
    msg += `${status} <b>${escapeHtml(chat.title)}</b>\n`;
    msg += `   📌 ${type} | 👥 ${chat.memberCount} участников\n`;
    msg += `   📅 Добавлен: ${timeAgo(new Date(chat.addedAt))}\n\n`;
  }

  // Build keyboard: one button per chat + navigation
  const chatButtons = pageChats.map((chat) => [
    Markup.button.callback(
      `${chat.isActive ? "✅" : "⏸"} ${chat.title.slice(0, 25)}`,
      `chat_info_${chat.id}`
    ),
  ]);

  const navRow = [];
  if (page > 0) navRow.push(Markup.button.callback("⬅️ Назад", `chats_page_${page - 1}`));
  if (start + PAGE_SIZE < total) navRow.push(Markup.button.callback("➡️ Вперёд", `chats_page_${page + 1}`));

  const backRow = [Markup.button.callback("🏠 Главное меню", "panel_main")];

  const keyboard = Markup.inlineKeyboard([
    ...chatButtons,
    ...(navRow.length > 0 ? [navRow] : []),
    backRow,
  ]);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(msg, { parse_mode: "HTML", ...keyboard });
  } else {
    await ctx.reply(msg, { parse_mode: "HTML", ...keyboard });
  }
}

async function sendChatInfo(ctx: Context, chatId: number): Promise<void> {
  const allChats = await getAllChats();
  const chat = allChats.find((c) => c.id === chatId);

  if (!chat) {
    await ctx.reply("❌ Чат не найден.", { parse_mode: "HTML" });
    return;
  }

  // Try to get fresh member count
  let memberCount = chat.memberCount ?? 0;
  let inviteLink = chat.inviteLink ?? null;

  try {
    const chatInfo = await ctx.telegram.getChat(chatId);
    if ("member_count" in chatInfo && typeof chatInfo.member_count === "number") {
      memberCount = chatInfo.member_count;
    }
    if ("username" in chatInfo && chatInfo.username) {
      inviteLink = `https://t.me/${chatInfo.username}`;
    } else if ("invite_link" in chatInfo && chatInfo.invite_link) {
      inviteLink = chatInfo.invite_link;
    }
  } catch { /* bot might have left */ }

  const status = chat.isActive ? "✅ Активен" : "⏸ Приостановлен";
  const type = chat.type === "supergroup" ? "Супергруппа" : "Группа";
  const chatUsername = "username" in chat && chat.username ? `@${chat.username}` : "Приватная";

  let msg = `📊 <b>Информация о чате</b>\n\n`;
  msg += `📌 <b>Название:</b> ${escapeHtml(chat.title)}\n`;
  msg += `🆔 <b>ID:</b> <code>${chat.id}</code>\n`;
  msg += `📂 <b>Тип:</b> ${type}\n`;
  msg += `🔗 <b>Username:</b> ${chatUsername}\n`;
  msg += `👥 <b>Участников:</b> ${memberCount}\n`;
  msg += `📅 <b>Добавлен:</b> ${formatDate(new Date(chat.addedAt))}\n`;
  msg += `🔄 <b>Обновлён:</b> ${timeAgo(new Date(chat.updatedAt))}\n`;
  msg += `⚡ <b>Статус:</b> ${status}\n`;
  if (inviteLink) msg += `\n🔗 <b>Ссылка:</b> ${inviteLink}\n`;

  const actionButton = chat.isActive
    ? Markup.button.callback("⏸ Приостановить", `chat_pause_${chatId}`)
    : Markup.button.callback("▶️ Возобновить", `chat_resume_${chatId}`);

  const keyboard = Markup.inlineKeyboard([
    [actionButton],
    [Markup.button.callback("🔗 Получить ссылку", `chat_link_${chatId}`)],
    [Markup.button.callback("🚪 Исключить бота", `chat_leave_${chatId}`)],
    [Markup.button.callback("⬅️ К списку чатов", "panel_chats")],
  ]);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(msg, { parse_mode: "HTML", ...keyboard });
  } else {
    await ctx.reply(msg, { parse_mode: "HTML", ...keyboard });
  }
}
