import { Context } from "telegraf";
import { db } from "@/db";
import { chatAdmins } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { BOT_CONFIG } from "../config";

/**
 * Checks if a user is a Telegram admin/owner in the chat
 */
export async function isTelegramAdmin(
  ctx: Context,
  chatId: number,
  userId: number
): Promise<boolean> {
  try {
    const member = await ctx.telegram.getChatMember(chatId, userId);
    return member.status === "administrator" || member.status === "creator";
  } catch {
    return false;
  }
}

/**
 * Checks if a user is the Telegram chat creator/owner
 */
export async function isTelegramOwner(
  ctx: Context,
  chatId: number,
  userId: number
): Promise<boolean> {
  try {
    const member = await ctx.telegram.getChatMember(chatId, userId);
    return member.status === "creator";
  } catch {
    return false;
  }
}

/**
 * Checks if a user is a bot-level admin (registered via /addadmin)
 */
export async function isBotAdmin(
  chatId: number,
  userId: number
): Promise<boolean> {
  const rows = await db
    .select()
    .from(chatAdmins)
    .where(and(eq(chatAdmins.chatId, chatId), eq(chatAdmins.userId, userId)));
  return rows.length > 0;
}

/**
 * Checks if a user is the developer
 */
export function isDeveloper(userId: number): boolean {
  return userId === BOT_CONFIG.developerId;
}

/**
 * Checks if a user can use moderation commands:
 * - Telegram owner (creator)
 * - Bot-level admin (added via /addadmin)
 * - Developer
 */
export async function canModerate(
  ctx: Context,
  chatId: number,
  userId: number
): Promise<boolean> {
  if (isDeveloper(userId)) return true;
  const [telegramOwner, botAdmin] = await Promise.all([
    isTelegramOwner(ctx, chatId, userId),
    isBotAdmin(chatId, userId),
  ]);
  return telegramOwner || botAdmin;
}

/**
 * Returns all required admin permissions for the bot to function
 */
export function getRequiredBotPermissions() {
  return {
    can_delete_messages: true,
    can_restrict_members: true,
    can_invite_users: true,
    can_pin_messages: true,
    can_manage_chat: true,
    can_promote_members: true,
    is_anonymous: false,
  };
}
