import { Context, Middleware } from "telegraf";
import { canModerate } from "../utils/permissions";

/**
 * Middleware: ensures command is sent in a group by a moderator
 * If not, silently ignores or notifies.
 */
export function requireModerator(): Middleware<Context> {
  return async (ctx, next) => {
    if (!ctx.chat || !ctx.from) return;

    const chatType = ctx.chat.type;
    if (chatType === "private") {
      await ctx.reply(
        "⚠️ Эта команда работает только в групповых чатах.",
        { parse_mode: "HTML" }
      );
      return;
    }

    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    const allowed = await canModerate(ctx, chatId, userId);
    if (!allowed) {
      await ctx.reply(
        "🚫 <b>Доступ запрещён.</b>\nТолько создатель чата и назначенные администраторы могут использовать эти команды.",
        { parse_mode: "HTML" }
      );
      return;
    }

    return next();
  };
}

/**
 * Middleware: only runs in group chats (silently ignores in DMs)
 */
export function requireGroup(): Middleware<Context> {
  return async (ctx, next) => {
    if (!ctx.chat) return;
    if (ctx.chat.type === "private") return;
    return next();
  };
}

/**
 * Middleware: only runs in private chats with the developer
 */
export function requireDeveloperPM(): Middleware<Context> {
  return async (ctx, next) => {
    if (!ctx.chat || !ctx.from) return;

    const developerId = Number(process.env.DEVELOPER_ID ?? "0");

    if (ctx.chat.type !== "private") return;
    if (ctx.from.id !== developerId) {
      await ctx.reply(
        "🔒 Этот бот работает только в составе группы. Для настройки обратитесь к разработчику.",
        { parse_mode: "HTML" }
      );
      return;
    }

    return next();
  };
}

/**
 * Middleware: checks if bot is active in this chat
 */
export function requireActiveChatMiddleware(): Middleware<Context> {
  return async (ctx, next) => {
    // Import here to avoid circular deps
    const { db } = await import("@/db");
    const { chats } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    if (!ctx.chat || ctx.chat.type === "private") return next();

    const chatId = ctx.chat.id;
    const rows = await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (rows.length > 0 && !rows[0].isActive) {
      // Bot is paused in this chat — only respond to nothing
      return;
    }

    return next();
  };
}
