import { db } from "@/db";
import { bannedUsers, mutedUsers, moderationLogs, warns, chatAdmins } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";

// ─── Ban Service ──────────────────────────────────────────────────────────────

export async function addBan(data: {
  chatId: number;
  userId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  bannedBy: number;
  bannedByUsername?: string | null;
  reason?: string | null;
}): Promise<void> {
  await db
    .insert(bannedUsers)
    .values({
      chatId: data.chatId,
      userId: data.userId,
      username: data.username ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      bannedBy: data.bannedBy,
      bannedByUsername: data.bannedByUsername ?? null,
      reason: data.reason ?? null,
      bannedAt: new Date(),
    })
    .onConflictDoNothing();
}

export async function removeBan(chatId: number, userId: number): Promise<void> {
  await db
    .delete(bannedUsers)
    .where(
      and(eq(bannedUsers.chatId, chatId), eq(bannedUsers.userId, userId))
    );
}

export async function isBanned(chatId: number, userId: number): Promise<boolean> {
  const rows = await db
    .select()
    .from(bannedUsers)
    .where(
      and(eq(bannedUsers.chatId, chatId), eq(bannedUsers.userId, userId))
    )
    .limit(1);
  return rows.length > 0;
}

export async function getBanList(chatId: number) {
  return db
    .select()
    .from(bannedUsers)
    .where(eq(bannedUsers.chatId, chatId))
    .orderBy(desc(bannedUsers.bannedAt));
}

// ─── Mute Service ─────────────────────────────────────────────────────────────

export async function addMute(data: {
  chatId: number;
  userId: number;
  username?: string | null;
  firstName?: string | null;
  mutedBy: number;
  mutedByUsername?: string | null;
  reason?: string | null;
  durationSeconds?: number | null;
}): Promise<void> {
  // Deactivate any existing mutes for this user in this chat
  await db
    .update(mutedUsers)
    .set({ isActive: false })
    .where(
      and(eq(mutedUsers.chatId, data.chatId), eq(mutedUsers.userId, data.userId))
    );

  const expiresAt = data.durationSeconds
    ? new Date(Date.now() + data.durationSeconds * 1000)
    : null;

  await db.insert(mutedUsers).values({
    chatId: data.chatId,
    userId: data.userId,
    username: data.username ?? null,
    firstName: data.firstName ?? null,
    mutedBy: data.mutedBy,
    mutedByUsername: data.mutedByUsername ?? null,
    reason: data.reason ?? null,
    mutedAt: new Date(),
    expiresAt,
    isActive: true,
  });
}

export async function removeMute(chatId: number, userId: number): Promise<void> {
  await db
    .update(mutedUsers)
    .set({ isActive: false })
    .where(
      and(eq(mutedUsers.chatId, chatId), eq(mutedUsers.userId, userId), eq(mutedUsers.isActive, true))
    );
}

// ─── Warn Service ─────────────────────────────────────────────────────────────

export async function addWarn(data: {
  chatId: number;
  userId: number;
  username?: string | null;
  firstName?: string | null;
  warnedBy: number;
  warnedByUsername?: string | null;
  reason?: string | null;
}): Promise<number> {
  await db.insert(warns).values({
    chatId: data.chatId,
    userId: data.userId,
    username: data.username ?? null,
    firstName: data.firstName ?? null,
    warnedBy: data.warnedBy,
    warnedByUsername: data.warnedByUsername ?? null,
    reason: data.reason ?? null,
    isActive: true,
    createdAt: new Date(),
  });

  // Return current warn count
  const activeWarns = await db
    .select()
    .from(warns)
    .where(
      and(
        eq(warns.chatId, data.chatId),
        eq(warns.userId, data.userId),
        eq(warns.isActive, true)
      )
    );
  return activeWarns.length;
}

export async function removeLastWarn(chatId: number, userId: number): Promise<boolean> {
  const rows = await db
    .select()
    .from(warns)
    .where(
      and(eq(warns.chatId, chatId), eq(warns.userId, userId), eq(warns.isActive, true))
    )
    .orderBy(desc(warns.createdAt))
    .limit(1);

  if (rows.length === 0) return false;

  await db
    .update(warns)
    .set({ isActive: false })
    .where(eq(warns.id, rows[0].id));

  return true;
}

export async function clearWarns(chatId: number, userId: number): Promise<void> {
  await db
    .update(warns)
    .set({ isActive: false })
    .where(and(eq(warns.chatId, chatId), eq(warns.userId, userId)));
}

export async function getWarnCount(chatId: number, userId: number): Promise<number> {
  const rows = await db
    .select()
    .from(warns)
    .where(
      and(eq(warns.chatId, chatId), eq(warns.userId, userId), eq(warns.isActive, true))
    );
  return rows.length;
}

export async function getWarnList(chatId: number, userId: number) {
  return db
    .select()
    .from(warns)
    .where(
      and(eq(warns.chatId, chatId), eq(warns.userId, userId), eq(warns.isActive, true))
    )
    .orderBy(desc(warns.createdAt));
}

// ─── Admin Service ────────────────────────────────────────────────────────────

export async function addBotAdmin(data: {
  chatId: number;
  userId: number;
  username?: string | null;
  firstName?: string | null;
  addedBy: number;
}): Promise<void> {
  await db
    .insert(chatAdmins)
    .values({
      chatId: data.chatId,
      userId: data.userId,
      username: data.username ?? null,
      firstName: data.firstName ?? null,
      addedBy: data.addedBy,
      isFounder: false,
      addedAt: new Date(),
    })
    .onConflictDoNothing();
}

export async function removeBotAdmin(chatId: number, userId: number): Promise<void> {
  await db
    .delete(chatAdmins)
    .where(
      and(
        eq(chatAdmins.chatId, chatId),
        eq(chatAdmins.userId, userId),
        eq(chatAdmins.isFounder, false) // cannot remove founder
      )
    );
}

export async function getChatAdmins(chatId: number) {
  return db
    .select()
    .from(chatAdmins)
    .where(eq(chatAdmins.chatId, chatId))
    .orderBy(chatAdmins.addedAt);
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export async function logAction(data: {
  chatId: number;
  chatTitle?: string | null;
  action: string;
  targetUserId: number;
  targetUsername?: string | null;
  targetFirstName?: string | null;
  executorUserId: number;
  executorUsername?: string | null;
  reason?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  await db.insert(moderationLogs).values({
    chatId: data.chatId,
    chatTitle: data.chatTitle ?? null,
    action: data.action,
    targetUserId: data.targetUserId,
    targetUsername: data.targetUsername ?? null,
    targetFirstName: data.targetFirstName ?? null,
    executorUserId: data.executorUserId,
    executorUsername: data.executorUsername ?? null,
    reason: data.reason ?? null,
    meta: data.meta ?? null,
    createdAt: new Date(),
  });
}

export async function getRecentLogs(chatId: number, limit = 20) {
  return db
    .select()
    .from(moderationLogs)
    .where(eq(moderationLogs.chatId, chatId))
    .orderBy(desc(moderationLogs.createdAt))
    .limit(limit);
}
