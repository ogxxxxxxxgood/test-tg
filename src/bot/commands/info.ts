import { Telegraf, Context } from "telegraf";
import { mention, displayName, escapeHtml } from "../utils/userMention";
import { formatDate } from "../utils/parseTime";
import { getWarnCount, getBanList } from "../services/moderationService";

/**
 * /info — shows detailed information about a user
 *
 * Usage:
 *   Reply to a message: /info
 *   Direct:            /info @username|ID
 */
export function registerInfoCommand(bot: Telegraf<Context>): void {
  bot.command("info", async (ctx) => {
    if (!ctx.chat || !ctx.from || !ctx.message) return;
    if (ctx.chat.type === "private") return;

    const chatId = ctx.chat.id;
    let targetId: number | null = null;
    let targetUser: { id: number; username?: string; first_name?: string; last_name?: string; is_bot?: boolean } | null = null;

    const replyTo = ctx.message.reply_to_message;
    if (replyTo && replyTo.from) {
      targetUser = replyTo.from;
      targetId = replyTo.from.id;
    } else {
      const text = ctx.message.text ?? "";
      const args = text.split(/\s+/).slice(1);
      if (!args[0]) {
        // Show info about the command sender
        targetId = ctx.from.id;
        targetUser = ctx.from;
      } else {
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
                last_name: "last_name" in chat ? (chat as { last_name?: string }).last_name : undefined,
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
    }

    if (!targetId) return;

    let status = "Неизвестно";
    let joinDate: string | null = null;

    try {
      const member = await ctx.telegram.getChatMember(chatId, targetId);
      const statusMap: Record<string, string> = {
        creator: "👑 Создатель",
        administrator: "👮 Администратор",
        member: "👤 Участник",
        restricted: "🔇 Ограничен",
        left: "🚶 Покинул чат",
        kicked: "🚫 Заблокирован",
      };
      status = statusMap[member.status] ?? member.status;
    } catch { /* user left */ }

    // Check warns and bans
    const warnCount = await getWarnCount(chatId, targetId);
    const banList = await getBanList(chatId);
    const isBanned = banList.some((b) => b.userId === targetId);

    const targetMention = mention(
      targetId,
      targetUser?.first_name ?? String(targetId),
      targetUser?.username
    );

    let msg = `ℹ️ <b>Информация о пользователе</b>\n\n`;
    msg += `👤 Имя: ${targetMention}\n`;
    const fullName = displayName(targetUser?.first_name, targetUser?.last_name, targetUser?.username, targetId);
    msg += `📛 Полное имя: <code>${escapeHtml(fullName)}</code>\n`;
    if (targetUser?.username) msg += `🔗 Username: @${escapeHtml(targetUser.username)}\n`;
    msg += `🆔 ID: <code>${targetId}</code>\n`;
    if (targetUser?.is_bot) msg += `🤖 Тип: <b>Бот</b>\n`;
    msg += `\n📊 <b>Статус в чате:</b> ${status}\n`;
    msg += `⚠️ <b>Предупреждений:</b> ${warnCount}\n`;
    msg += `🚫 <b>В чёрном списке:</b> ${isBanned ? "Да" : "Нет"}\n`;
    if (joinDate) msg += `📅 <b>Вступил:</b> ${joinDate}\n`;

    await ctx.reply(msg, { parse_mode: "HTML" });
  });
}
