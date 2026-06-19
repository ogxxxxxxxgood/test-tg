/**
 * Bot Configuration
 * All values are read from environment variables.
 * Never hard-code tokens or IDs here.
 */

export const BOT_CONFIG = {
  /** Telegram Bot API token from @BotFather */
  token: process.env.TELEGRAM_BOT_TOKEN ?? "",

  /** Telegram user ID of the developer/owner — has full PM access */
  developerId: Number(process.env.DEVELOPER_ID ?? "0"),

  /** Optional webhook URL for production mode */
  webhookUrl: process.env.WEBHOOK_URL ?? "",

  /** Bot username without @ */
  botUsername: process.env.BOT_USERNAME ?? "",

  /** How long (ms) the bot waits for admin rights before leaving */
  adminCheckTimeout: 5 * 60 * 1000, // 5 minutes

  /** Max warnings before auto-action */
  defaultMaxWarns: 3,

  /** Anti-flood: max messages per window */
  floodWindow: 5000, // 5 seconds
  floodLimit: 5,
} as const;

export type BotConfig = typeof BOT_CONFIG;
