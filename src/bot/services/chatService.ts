import { db } from "@/db";
import {
  chats,
  chatSettings,
  chatAdmins,
  pendingAdminChecks,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Context } from "telegraf";
import { Chat } from "telegraf/types";

/**
 * Upserts a chat record when the bot is added to a group
 */
export async function upsertChat(
  chat: Chat.GroupChat | Chat.SupergroupChat,
  memberCount?: number
): Promise<void> {
  const existing = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chat.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(chats)
      .set({
        title: chat.title,
        username: "username" in chat ? chat.username ?? null : null,
        memberCount: memberCount ?? existing[0].memberCount,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(chats.id, chat.id));
  } else {
    await db.insert(chats).values({
      id: chat.id,
      title: chat.title,
      username: "username" in chat ? chat.username ?? null : null,
      type: chat.type,
      memberCount: memberCount ?? 0,
      isActive: true,
      addedAt: new Date(),
      updatedAt: new Date(),
    });

    // Create default settings
    await db
      .insert(chatSettings)
      .values({
        chatId: chat.id,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  }
}

/**
 * Registers the creator as a bot-level admin (founder)
 */
export async function registerFounder(
  chatId: number,
  userId: number,
  firstName?: string,
  username?: string
): Promise<void> {
  // Check if founder already registered
  const existing = await db
    .select()
    .from(chatAdmins)
    .where(and(eq(chatAdmins.chatId, chatId), eq(chatAdmins.isFounder, true)))
    .limit(1);

  if (existing.length > 0) return;

  await db
    .insert(chatAdmins)
    .values({
      chatId,
      userId,
      username: username ?? null,
      firstName: firstName ?? null,
      addedBy: userId,
      isFounder: true,
      addedAt: new Date(),
    })
    .onConflictDoNothing();
}

/**
 * Marks a chat as inactive (bot paused or left)
 */
export async function setChatActive(
  chatId: number,
  active: boolean
): Promise<void> {
  await db
    .update(chats)
    .set({ isActive: active, updatedAt: new Date() })
    .where(eq(chats.id, chatId));
}

/**
 * Stores the generated invite link for a private chat
 */
export async function setChatInviteLink(
  chatId: number,
  link: string
): Promise<void> {
  await db
    .update(chats)
    .set({ inviteLink: link, updatedAt: new Date() })
    .where(eq(chats.id, chatId));
}

/**
 * Updates the member count for a chat
 */
export async function updateMemberCount(
  chatId: number,
  count: number
): Promise<void> {
  await db
    .update(chats)
    .set({ memberCount: count, updatedAt: new Date() })
    .where(eq(chats.id, chatId));
}

/**
 * Creates a pending admin-check entry (bot must receive admin in 5 min)
 */
export async function createPendingAdminCheck(chatId: number): Promise<void> {
  const deadline = new Date(Date.now() + 5 * 60 * 1000);
  await db
    .insert(pendingAdminChecks)
    .values({
      chatId,
      addedAt: new Date(),
      deadlineAt: deadline,
      resolved: false,
    })
    .onConflictDoNothing();
}

/**
 * Resolves (clears) a pending admin check
 */
export async function resolvePendingAdminCheck(chatId: number): Promise<void> {
  await db
    .update(pendingAdminChecks)
    .set({ resolved: true })
    .where(eq(pendingAdminChecks.chatId, chatId));
}

/**
 * Gets all active chats
 */
export async function getAllActiveChats() {
  return db.select().from(chats).where(eq(chats.isActive, true));
}

/**
 * Gets chat settings
 */
export async function getChatSettings(chatId: number) {
  const rows = await db
    .select()
    .from(chatSettings)
    .where(eq(chatSettings.chatId, chatId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Gets all chats (for developer dashboard)
 */
export async function getAllChats() {
  return db
    .select()
    .from(chats)
    .orderBy(chats.addedAt);
}

/**
 * Tries to generate an invite link for a chat and stores it
 */
export async function ensureInviteLink(
  ctx: Context,
  chatId: number
): Promise<string | null> {
  try {
    const chatInfo = await ctx.telegram.getChat(chatId);
    if ("invite_link" in chatInfo && chatInfo.invite_link) {
      await setChatInviteLink(chatId, chatInfo.invite_link);
      return chatInfo.invite_link;
    }
    // Generate a new invite link
    const link = await ctx.telegram.exportChatInviteLink(chatId);
    await setChatInviteLink(chatId, link);
    return link;
  } catch {
    return null;
  }
}
