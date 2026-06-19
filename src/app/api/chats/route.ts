import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chats } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const allChats = await db.select().from(chats).orderBy(chats.addedAt);
    return NextResponse.json(allChats);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const { chatId, isActive } = await request.json() as { chatId: number; isActive: boolean };
    await db
      .update(chats)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(chats.id, chatId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
