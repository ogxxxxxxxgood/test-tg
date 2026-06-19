import { Context } from "telegraf";

/**
 * Extended bot context
 */
export type BotContext = Context;

/**
 * Parsed mute duration
 */
export interface MuteDuration {
  seconds: number;
  label: string;
}

/**
 * Result of a user lookup by username or ID
 */
export interface ResolvedUser {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Inline keyboard button builder helper types
 */
export type CallbackData = string;
