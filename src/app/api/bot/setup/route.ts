import { NextRequest, NextResponse } from "next/server";
import { getBot } from "@/bot";

export const dynamic = "force-dynamic";

/**
 * POST /api/bot/setup
 * Sets the webhook URL for the bot
 * Body: { webhookUrl: string, secret?: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { webhookUrl } = await request.json() as { webhookUrl: string };

    if (!webhookUrl) {
      return NextResponse.json({ error: "webhookUrl is required" }, { status: 400 });
    }

    const bot = getBot();
    await bot.telegram.setWebhook(webhookUrl);

    // Set bot commands
    await bot.telegram.setMyCommands([
      { command: "start", description: "Запустить бота" },
      { command: "help", description: "Справка по командам" },
      { command: "ban", description: "Заблокировать пользователя" },
      { command: "unban", description: "Разблокировать пользователя" },
      { command: "kick", description: "Исключить пользователя" },
      { command: "mute", description: "Замутить пользователя" },
      { command: "unmute", description: "Снять мут" },
      { command: "warn", description: "Выдать предупреждение" },
      { command: "unwarn", description: "Снять предупреждение" },
      { command: "warns", description: "Просмотреть предупреждения" },
      { command: "clearwarns", description: "Сбросить предупреждения" },
      { command: "banlist", description: "Список заблокированных" },
      { command: "info", description: "Информация о пользователе" },
      { command: "admins", description: "Список администраторов бота" },
      { command: "addadmin", description: "Назначить администратора" },
      { command: "removeadmin", description: "Снять администратора" },
      { command: "rules", description: "Правила чата" },
      { command: "setrules", description: "Установить правила" },
      { command: "staff", description: "Список администраторов Telegram" },
      { command: "panel", description: "Панель управления (только разработчик)" },
    ]);

    return NextResponse.json({
      ok: true,
      message: `Webhook set to ${webhookUrl}`,
    });
  } catch (err) {
    console.error("[Setup] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/bot/setup
 * Removes the webhook (switches to polling mode)
 */
export async function DELETE(): Promise<NextResponse> {
  try {
    const bot = getBot();
    await bot.telegram.deleteWebhook();
    return NextResponse.json({ ok: true, message: "Webhook deleted" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
