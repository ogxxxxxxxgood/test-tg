import { NextResponse } from "next/server";
import { db } from "@/db";
import { chats, bannedUsers, moderationLogs, warns } from "@/db/schema";
import { eq, count, gte, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/stats
 * Returns aggregated bot statistics for the dashboard
 */
export async function GET(): Promise<NextResponse> {
  try {
    const [
      allChats,
      activeChatsResult,
      totalBansResult,
      totalActionsResult,
      recentLogsResult,
    ] = await Promise.all([
      db.select().from(chats).orderBy(desc(chats.addedAt)),
      db.select({ count: count() }).from(chats).where(eq(chats.isActive, true)),
      db.select({ count: count() }).from(bannedUsers),
      db.select({ count: count() }).from(moderationLogs),
      db.select().from(moderationLogs).orderBy(desc(moderationLogs.createdAt)).limit(10),
    ]);

    // Actions in last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActionsResult = await db
      .select({ count: count() })
      .from(moderationLogs)
      .where(gte(moderationLogs.createdAt, yesterday));

    // Active warns count
    const activeWarnsResult = await db
      .select({ count: count() })
      .from(warns)
      .where(eq(warns.isActive, true));

    return NextResponse.json({
      chats: {
        total: allChats.length,
        active: activeChatsResult[0]?.count ?? 0,
        paused: allChats.length - (activeChatsResult[0]?.count ?? 0),
        list: allChats,
      },
      moderation: {
        totalBans: totalBansResult[0]?.count ?? 0,
        totalActions: totalActionsResult[0]?.count ?? 0,
        actionsLast24h: recentActionsResult[0]?.count ?? 0,
        activeWarns: activeWarnsResult[0]?.count ?? 0,
      },
      recentLogs: recentLogsResult,
    });
  } catch (err) {
    console.error("[Stats API] Error:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
