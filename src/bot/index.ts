import { Telegraf, Context } from "telegraf";
import { BOT_CONFIG } from "./config";
import { requireActiveChatMiddleware } from "./middlewares/adminCheck";
import { antiFloodMiddleware } from "./handlers/antiFlood";
import { registerNewMemberHandler } from "./handlers/newMember";
import { registerBanCommand } from "./commands/ban";
import { registerUnbanCommand } from "./commands/unban";
import { registerKickCommand } from "./commands/kick";
import { registerMuteCommand } from "./commands/mute";
import { registerUnmuteCommand } from "./commands/unmute";
import { registerBanlistCommand } from "./commands/banlist";
import { registerWarnCommands } from "./commands/warn";
import { registerAdminCommands } from "./commands/addadmin";
import { registerInfoCommand } from "./commands/info";
import { registerRulesCommands } from "./commands/rules";
import { registerHelpCommands } from "./commands/help";
import { registerPanelCommands } from "./commands/panel";

let botInstance: Telegraf<Context> | null = null;

/**
 * Returns the singleton Telegraf bot instance.
 * Creates it on first call.
 */
export function getBot(): Telegraf<Context> {
  if (botInstance) return botInstance;

  if (!BOT_CONFIG.token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set in environment variables");
  }

  const bot = new Telegraf<Context>(BOT_CONFIG.token);

  // ─── Global middlewares ────────────────────────────────────────────────────
  bot.use(requireActiveChatMiddleware());
  bot.use(antiFloodMiddleware());

  // ─── Event handlers ────────────────────────────────────────────────────────
  registerNewMemberHandler(bot);

  // ─── Commands ──────────────────────────────────────────────────────────────
  registerHelpCommands(bot);
  registerPanelCommands(bot);
  registerBanCommand(bot);
  registerUnbanCommand(bot);
  registerKickCommand(bot);
  registerMuteCommand(bot);
  registerUnmuteCommand(bot);
  registerBanlistCommand(bot);
  registerWarnCommands(bot);
  registerAdminCommands(bot);
  registerInfoCommand(bot);
  registerRulesCommands(bot);

  // ─── Error handler ─────────────────────────────────────────────────────────
  bot.catch((err, ctx) => {
    console.error(`[Bot] Unhandled error for ${ctx.updateType}:`, err);
  });

  botInstance = bot;
  return bot;
}

/**
 * Starts the bot in long-polling mode (for development)
 */
export async function startBotPolling(): Promise<void> {
  const bot = getBot();
  await bot.launch({ dropPendingUpdates: true });
  console.log("🤖 Guard Bot started in polling mode");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
