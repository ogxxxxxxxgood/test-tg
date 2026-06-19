import { db } from "@/db";
import { chats, bannedUsers, moderationLogs, warns, chatAdmins } from "@/db/schema";
import { eq, count, gte, desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getStats() {
  const [
    allChats,
    activeChatsResult,
    totalBansResult,
    totalActionsResult,
    recentLogsResult,
    activeWarnsResult,
  ] = await Promise.all([
    db.select().from(chats).orderBy(desc(chats.addedAt)).limit(5),
    db.select({ count: count() }).from(chats).where(eq(chats.isActive, true)),
    db.select({ count: count() }).from(bannedUsers),
    db.select({ count: count() }).from(moderationLogs),
    db.select().from(moderationLogs).orderBy(desc(moderationLogs.createdAt)).limit(10),
    db.select({ count: count() }).from(warns).where(eq(warns.isActive, true)),
  ]);

  const totalChatsResult = await db.select({ count: count() }).from(chats);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentActionsResult = await db
    .select({ count: count() })
    .from(moderationLogs)
    .where(gte(moderationLogs.createdAt, yesterday));

  return {
    totalChats: totalChatsResult[0]?.count ?? 0,
    activeChats: activeChatsResult[0]?.count ?? 0,
    totalBans: totalBansResult[0]?.count ?? 0,
    totalActions: totalActionsResult[0]?.count ?? 0,
    actionsLast24h: recentActionsResult[0]?.count ?? 0,
    activeWarns: activeWarnsResult[0]?.count ?? 0,
    recentChats: allChats,
    recentLogs: recentLogsResult,
  };
}

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}с назад`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}м назад`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}ч назад`;
  return `${Math.floor(diffHr / 24)}д назад`;
}

const ACTION_LABELS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  ban: { label: "Бан", color: "text-red-400", bg: "bg-red-500/10", icon: "🔨" },
  unban: { label: "Разбан", color: "text-green-400", bg: "bg-green-500/10", icon: "🔓" },
  kick: { label: "Кик", color: "text-orange-400", bg: "bg-orange-500/10", icon: "👢" },
  mute: { label: "Мут", color: "text-yellow-400", bg: "bg-yellow-500/10", icon: "🔇" },
  unmute: { label: "Анмут", color: "text-blue-400", bg: "bg-blue-500/10", icon: "🔊" },
  warn: { label: "Варн", color: "text-purple-400", bg: "bg-purple-500/10", icon: "⚠️" },
};

export default async function HomePage() {
  const stats = await getStats();
  const botUsername = process.env.BOT_USERNAME || "guard_bot";

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-[#161b22]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg">
              🛡️
            </div>
            <div>
              <h1 className="font-bold text-sm leading-none">Guard Bot</h1>
              <p className="text-xs text-white/40 mt-0.5">Панель управления</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
              @{botUsername}
            </div>
            <Link
              href="/chats"
              className="text-xs bg-white/5 hover:bg-white/10 transition px-3 py-1.5 rounded-lg border border-white/10"
            >
              Все чаты
            </Link>
            <Link
              href="/logs"
              className="text-xs bg-white/5 hover:bg-white/10 transition px-3 py-1.5 rounded-lg border border-white/10"
            >
              Логи
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ─── Stats Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard
            icon="💬"
            label="Всего чатов"
            value={stats.totalChats}
            color="blue"
          />
          <StatCard
            icon="✅"
            label="Активных"
            value={stats.activeChats}
            color="green"
          />
          <StatCard
            icon="🚫"
            label="Заблокировано"
            value={stats.totalBans}
            color="red"
          />
          <StatCard
            icon="⚡"
            label="Действий 24ч"
            value={stats.actionsLast24h}
            color="yellow"
          />
          <StatCard
            icon="⚠️"
            label="Активных варнов"
            value={stats.activeWarns}
            color="purple"
          />
          <StatCard
            icon="📊"
            label="Всего действий"
            value={stats.totalActions}
            color="cyan"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* ─── Recent Chats ───────────────────────────────────────────────── */}
          <section className="bg-[#161b22] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-sm">Последние чаты</h2>
              <Link
                href="/chats"
                className="text-xs text-blue-400 hover:text-blue-300 transition"
              >
                Все →
              </Link>
            </div>

            {stats.recentChats.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-white/40 text-sm">Бот ещё не добавлен ни в один чат</p>
                <p className="text-white/25 text-xs mt-1">
                  Добавьте @{botUsername} в группу и выдайте права администратора
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/3 hover:bg-white/5 transition border border-white/5"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-lg flex-shrink-0">
                      {chat.type === "supergroup" ? "👥" : "💬"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{chat.title}</p>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            chat.isActive
                              ? "bg-green-500/15 text-green-400"
                              : "bg-yellow-500/15 text-yellow-400"
                          }`}
                        >
                          {chat.isActive ? "активен" : "пауза"}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">
                        👥 {chat.memberCount} · {timeAgo(new Date(chat.addedAt))}
                      </p>
                    </div>
                    <Link
                      href={`/chats/${chat.id}`}
                      className="text-xs text-white/30 hover:text-white/70 transition flex-shrink-0"
                    >
                      →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─── Recent Actions ─────────────────────────────────────────────── */}
          <section className="bg-[#161b22] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-sm">Последние действия</h2>
              <Link
                href="/logs"
                className="text-xs text-blue-400 hover:text-blue-300 transition"
              >
                Все →
              </Link>
            </div>

            {stats.recentLogs.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-white/40 text-sm">Нет действий</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.recentLogs.map((log) => {
                  const action = ACTION_LABELS[log.action] ?? {
                    label: log.action,
                    color: "text-white/60",
                    bg: "bg-white/5",
                    icon: "📌",
                  };
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-white/3 border border-white/5"
                    >
                      <span
                        className={`text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0 ${action.bg} ${action.color}`}
                      >
                        {action.icon} {action.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/70 truncate">
                          {log.targetFirstName ?? log.targetUsername ?? `ID ${log.targetUserId}`}
                          {log.chatTitle && (
                            <span className="text-white/30"> в {log.chatTitle}</span>
                          )}
                        </p>
                        {log.reason && (
                          <p className="text-xs text-white/30 truncate mt-0.5">
                            {log.reason}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-white/25 flex-shrink-0">
                        {timeAgo(new Date(log.createdAt))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ─── Setup Section ──────────────────────────────────────────────────── */}
        <section className="mt-6 bg-[#161b22] rounded-2xl border border-white/5 p-6">
          <h2 className="font-semibold text-sm mb-4">⚙️ Быстрая настройка</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <SetupCard
              step="1"
              icon="🤖"
              title="Создайте бота"
              desc="Откройте @BotFather, создайте нового бота и скопируйте токен в .env файл"
              color="blue"
            />
            <SetupCard
              step="2"
              icon="👥"
              title="Добавьте в группу"
              desc="Добавьте бота в вашу группу и немедленно выдайте права администратора"
              color="purple"
            />
            <SetupCard
              step="3"
              icon="🛡️"
              title="Настройте через ЛС"
              desc="Напишите боту в личные сообщения с аккаунта разработчика команду /panel"
              color="green"
            />
          </div>
        </section>

        {/* ─── Commands Quick Reference ────────────────────────────────────── */}
        <section className="mt-6 bg-[#161b22] rounded-2xl border border-white/5 p-6">
          <h2 className="font-semibold text-sm mb-5">📋 Команды бота</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { cmd: "/ban", desc: "Заблокировать + чёрный список", icon: "🔨", color: "red" },
              { cmd: "/unban", desc: "Разблокировать пользователя", icon: "🔓", color: "green" },
              { cmd: "/kick", desc: "Исключить (с возможностью вернуться)", icon: "👢", color: "orange" },
              { cmd: "/mute", desc: "Ограничить отправку сообщений", icon: "🔇", color: "yellow" },
              { cmd: "/unmute", desc: "Снять ограничения", icon: "🔊", color: "blue" },
              { cmd: "/warn", desc: "Выдать предупреждение", icon: "⚠️", color: "purple" },
              { cmd: "/banlist", desc: "Список заблокированных", icon: "📋", color: "red" },
              { cmd: "/addadmin", desc: "Назначить администратора бота", icon: "👑", color: "yellow" },
              { cmd: "/info", desc: "Информация о пользователе", icon: "ℹ️", color: "cyan" },
              { cmd: "/rules", desc: "Правила чата", icon: "📜", color: "green" },
              { cmd: "/staff", desc: "Список администраторов", icon: "👮", color: "blue" },
              { cmd: "/panel", desc: "Панель разработчика (ЛС)", icon: "🔧", color: "purple" },
            ].map((item) => (
              <div
                key={item.cmd}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/3 border border-white/5"
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                <div>
                  <code className="text-xs font-mono text-blue-300">{item.cmd}</code>
                  <p className="text-xs text-white/40 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20",
    green: "from-green-500/20 to-green-600/5 border-green-500/20",
    red: "from-red-500/20 to-red-600/5 border-red-500/20",
    yellow: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/20",
    purple: "from-purple-500/20 to-purple-600/5 border-purple-500/20",
    cyan: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/20",
  };

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-4 ${colorMap[color] ?? colorMap.blue}`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-xs text-white/40 mt-1">{label}</div>
    </div>
  );
}

function SetupCard({
  step,
  icon,
  title,
  desc,
  color,
}: {
  step: string;
  icon: string;
  title: string;
  desc: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    green: "text-green-400 bg-green-500/10",
  };

  return (
    <div className="p-4 rounded-xl bg-white/3 border border-white/5">
      <div className="flex items-center gap-3 mb-3">
        <span
          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${colorMap[color]}`}
        >
          {step}
        </span>
        <span className="text-xl">{icon}</span>
        <span className="font-medium text-sm">{title}</span>
      </div>
      <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
    </div>
  );
}
