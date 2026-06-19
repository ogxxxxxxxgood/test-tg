import { Telegraf, Context } from "telegraf";
import { escapeHtml } from "../utils/userMention";

/**
 * /start and /help commands
 * Shows different content depending on context (group vs PM)
 */
export function registerHelpCommands(bot: Telegraf<Context>): void {
  const helpText = `
🤖 <b>Guard Bot — Бот модерации группы</b>

<b>═══ Команды модерации ═══</b>

🔨 <code>/ban</code> — Заблокировать пользователя (добавить в ЧС)
   <i>Ответом: /ban [причина]</i>
   <i>Напрямую: /ban @user [причина]</i>

🔓 <code>/unban</code> — Разблокировать пользователя
   <i>/unban @user|ID</i>

👢 <code>/kick</code> — Исключить пользователя (может вернуться)
   <i>Ответом: /kick [причина]</i>
   <i>Напрямую: /kick @user [причина]</i>

🔇 <code>/mute</code> — Ограничить отправку сообщений
   <i>Ответом: /mute &lt;время&gt; [причина]</i>
   <i>Напрямую: /mute @user &lt;время&gt; [причина]</i>
   <i>Время: 30s, 5m, 2h, 1d, 1w</i>

🔊 <code>/unmute</code> — Снять ограничения
   <i>Ответом или: /unmute @user|ID</i>

⚠️ <code>/warn</code> — Выдать предупреждение
↩️ <code>/unwarn</code> — Снять последнее предупреждение
📋 <code>/warns</code> — Просмотреть предупреждения
🧹 <code>/clearwarns</code> — Сбросить все предупреждения

<b>═══ Информация ═══</b>

📋 <code>/banlist</code> — Список заблокированных
ℹ️ <code>/info</code> — Информация о пользователе
👑 <code>/admins</code> — Список администраторов бота
📜 <code>/rules</code> — Правила чата
👥 <code>/staff</code> — Список администраторов

<b>═══ Управление ═══</b>

👑 <code>/addadmin</code> — Назначить администратора бота
🔻 <code>/removeadmin</code> — Снять администратора бота
📝 <code>/setrules</code> — Установить правила чата

<b>═══ Форматы времени ═══</b>
<code>30s</code> — 30 секунд
<code>5m</code> — 5 минут
<code>2h</code> — 2 часа
<code>1d</code> — 1 день
<code>1w</code> — 1 неделя
`.trim();

  bot.start(async (ctx) => {
    if (!ctx.from) return;

    const developerId = Number(process.env.DEVELOPER_ID ?? "0");

    if (ctx.chat?.type === "private" && ctx.from.id === developerId) {
      await ctx.reply(
        `🔧 <b>Панель управления разработчика</b>\n\n` +
        `Привет, ${escapeHtml(ctx.from.first_name)}!\n` +
        `Здесь вы можете управлять ботом и всеми чатами.\n\n` +
        `Используйте /panel для доступа к панели управления.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (ctx.chat?.type === "private") {
      await ctx.reply(
        `👋 <b>Guard Bot</b>\n\n` +
        `Я — бот для модерации Telegram-групп.\n` +
        `Добавьте меня в группу и назначьте администратором для начала работы.\n\n` +
        `/help — список команд`,
        { parse_mode: "HTML" }
      );
      return;
    }

    await ctx.reply(
      `✅ <b>Guard Bot активирован!</b>\n\nИспользуйте /help для просмотра команд.`,
      { parse_mode: "HTML" }
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(helpText, { parse_mode: "HTML" });
  });

  bot.command("staff", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    try {
      const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
      const chatTitle = "title" in ctx.chat ? ctx.chat.title : "Чат";

      let msg = `👥 <b>Администраторы «${escapeHtml(chatTitle)}»</b>\n\n`;
      for (const admin of admins) {
        const user = admin.user;
        if (user.is_bot) continue;
        const name = escapeHtml(
          [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || String(user.id)
        );
        const role = admin.status === "creator" ? "👑 Создатель" : "👮 Администратор";
        const customTitle = "custom_title" in admin && admin.custom_title ? ` — <i>${escapeHtml(admin.custom_title)}</i>` : "";
        msg += `${role}: <a href="tg://user?id=${user.id}">${name}</a>${customTitle}\n`;
      }

      await ctx.reply(msg, { parse_mode: "HTML" });
    } catch {
      await ctx.reply("❌ Не удалось получить список администраторов.", { parse_mode: "HTML" });
    }
  });
}
