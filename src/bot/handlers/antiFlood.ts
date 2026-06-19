import { Context, Middleware } from "telegraf";
import { getChatSettings } from "../services/chatService";
import { mention } from "../utils/userMention";

// In-memory flood tracker: Map<chatId_userId, { count, windowStart }>
const floodTracker = new Map<string, { count: number; windowStart: number }>();

/**
 * Anti-flood middleware
 * Tracks messages per user per chat and mutes/kicks if threshold exceeded
 */
export function antiFloodMiddleware(): Middleware<Context> {
  return async (ctx, next) => {
    if (!ctx.chat || !ctx.from || !ctx.message) return next();
    if (ctx.chat.type === "private") return next();

    const chatId = ctx.chat.id;
    const userId = ctx.from.id;

    const settings = await getChatSettings(chatId);
    if (!settings?.antiFloodEnabled) return next();

    const limit = settings.antiFloodLimit ?? 5;
    const windowMs = 5000; // 5 seconds
    const key = `${chatId}_${userId}`;
    const now = Date.now();

    const tracker = floodTracker.get(key) ?? { count: 0, windowStart: now };

    if (now - tracker.windowStart > windowMs) {
      // Reset window
      floodTracker.set(key, { count: 1, windowStart: now });
    } else {
      tracker.count++;
      floodTracker.set(key, tracker);

      if (tracker.count > limit) {
        // Mute for 10 minutes
        try {
          await ctx.telegram.restrictChatMember(chatId, userId, {
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
            until_date: Math.floor((Date.now() + 10 * 60 * 1000) / 1000),
          });

          floodTracker.delete(key);

          const userMention = mention(
            userId,
            ctx.from.first_name,
            ctx.from.username
          );

          await ctx.reply(
            `🌊 <b>Флуд обнаружен!</b>\n\n${userMention} замучен на 10 минут за флуд.`,
            { parse_mode: "HTML" }
          );
        } catch { /* ignore */ }
        return; // Don't process this message further
      }
    }

    return next();
  };
}
