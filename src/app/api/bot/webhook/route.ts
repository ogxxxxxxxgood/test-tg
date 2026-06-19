import { NextRequest, NextResponse } from "next/server";
import { getBot } from "@/bot";

export const dynamic = "force-dynamic";

/**
 * POST /api/bot/webhook
 * Telegram sends updates here in webhook mode
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
    }

    const body = await request.json();
    const bot = getBot();

    await bot.handleUpdate(body);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Webhook] Error handling update:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/bot/webhook
 * Returns webhook status info
 */
export async function GET(): Promise<NextResponse> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
    }

    const bot = getBot();
    const webhookInfo = await bot.telegram.getWebhookInfo();
    const me = await bot.telegram.getMe();

    return NextResponse.json({
      ok: true,
      bot: {
        id: me.id,
        username: me.username,
        first_name: me.first_name,
      },
      webhook: webhookInfo,
    });
  } catch (err) {
    console.error("[Webhook] GET error:", err);
    return NextResponse.json({ error: "Failed to get webhook info" }, { status: 500 });
  }
}
