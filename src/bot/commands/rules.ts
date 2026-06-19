import { Telegraf, Context } from "telegraf";
import { canModerate } from "../utils/permissions";
import { db } from "@/db";
import { chatSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { escapeHtml } from "../utils/userMention";

/**
 * /rules — shows the group rules
 * /setrules — sets the group rules (moderators only)
 * /delrules — deletes the rules (moderators only)
 */
export function registerRulesCommands(bot: Telegraf<Context>): void {
  // /rules
  bot.command("rules", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const chatId = ctx.chat.id;
    const settings = await db
      .select()
      .from(chatSettings)
      .where(eq(chatSettings.chatId, chatId))
      .limit(1);

    const rules = settings[0]?.rulesText;
    if (!rules) {
      await ctx.reply(
        "ℹ️ Правила для этого чата ещё не установлены.\n" +
        "<i>Администратор может установить их командой <code>/setrules</code></i>",
        { parse_mode: "HTML" }
      );
      return;
    }

    const chatTitle = "title" in ctx.chat ? ctx.chat.title : "Чат";
    await ctx.reply(
      `📋 <b>Правила чата «${escapeHtml(chatTitle)}»</b>\n\n${escapeHtml(rules)}`,
      { parse_mode: "HTML" }
    );
  });

  // /setrules
  bot.command("setrules", async (ctx) => {
    if (!ctx.chat || !ctx.from || !ctx.message) return;
    if (ctx.chat.type === "private") return;

    const canMod = await canModerate(ctx, ctx.chat.id, ctx.from.id);
    if (!canMod) {
      await ctx.reply("🚫 Только администраторы могут устанавливать правила.", { parse_mode: "HTML" });
      return;
    }

    const text = ctx.message.text ?? "";
    const rules = text.split(/\s+/).slice(1).join(" ").trim();
    if (!rules) {
      await ctx.reply(
        "❌ Укажите текст правил: <code>/setrules Ваши правила здесь</code>",
        { parse_mode: "HTML" }
      );
      return;
    }

    await db
      .insert(chatSettings)
      .values({ chatId: ctx.chat.id, rulesText: rules, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: chatSettings.chatId,
        set: { rulesText: rules, updatedAt: new Date() },
      });

    await ctx.reply(
      "✅ <b>Правила установлены!</b>\nПользователи могут просмотреть их командой /rules",
      { parse_mode: "HTML" }
    );
  });

  // /delrules
  bot.command("delrules", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;

    const canMod = await canModerate(ctx, ctx.chat.id, ctx.from.id);
    if (!canMod) return;

    await db
      .update(chatSettings)
      .set({ rulesText: null, updatedAt: new Date() })
      .where(eq(chatSettings.chatId, ctx.chat.id));

    await ctx.reply("🗑️ Правила удалены.", { parse_mode: "HTML" });
  });
}
