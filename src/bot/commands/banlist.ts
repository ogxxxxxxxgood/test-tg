import { Telegraf, Context } from "telegraf";
import { requireModerator } from "../middlewares/adminCheck";
import { getBanList } from "../services/moderationService";
import { formatDate } from "../utils/parseTime";
import { displayName, escapeHtml } from "../utils/userMention";

function esc(s: string | null | undefined): string {
  return escapeHtml(s ?? "");
}

/**
 * /banlist — shows the chat's ban list with full details
 */
export function registerBanlistCommand(bot: Telegraf<Context>): void {
  bot.command("banlist", requireModerator(), async (ctx) => {
    if (!ctx.chat || !ctx.from) return;

    const chatId = ctx.chat.id;
    const bans = await getBanList(chatId);

    if (bans.length === 0) {
      await ctx.reply(
        "📋 <b>Чёрный список пуст</b>\n\n<i>В этом чате нет заблокированных пользователей.</i>",
        { parse_mode: "HTML" }
      );
      return;
    }

    const chatTitle = ctx.chat.type !== "private" ? ctx.chat.title : "Чат";
    const CHUNK_SIZE = 20; // Telegram message limit safe

    let msg = `🚫 <b>Чёрный список чата «${esc(chatTitle)}»</b>\n`;
    msg += `<i>Всего заблокировано: ${bans.length}</i>\n`;
    msg += "─".repeat(30) + "\n\n";

    const chunks: string[] = [];
    let currentChunk = msg;

    for (let i = 0; i < bans.length; i++) {
      const ban = bans[i];
      const name = displayName(
        ban.firstName,
        ban.lastName,
        ban.username,
        ban.userId
      );
      const bannedByName = ban.bannedByUsername
        ? `@${ban.bannedByUsername}`
        : `ID: ${ban.bannedBy}`;

      let entry = `<b>${i + 1}.</b> <a href="tg://user?id=${ban.userId}">${esc(name)}</a>\n`;
      entry += `   🆔 ID: <code>${ban.userId}</code>\n`;
      entry += `   👮 Заблокировал: ${esc(bannedByName)}\n`;
      entry += `   📅 Дата: ${formatDate(new Date(ban.bannedAt))}\n`;
      if (ban.reason) entry += `   📝 Причина: <i>${esc(ban.reason)}</i>\n`;
      entry += "\n";

      if (currentChunk.length + entry.length > 3800) {
        chunks.push(currentChunk);
        currentChunk = entry;
      } else {
        currentChunk += entry;
      }

      if (i === bans.length - 1) {
        chunks.push(currentChunk);
      }
    }

    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: "HTML" });
    }
  });
}
