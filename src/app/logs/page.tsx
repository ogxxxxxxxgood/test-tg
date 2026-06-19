import { db } from "@/db";
import { moderationLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getLogs() {
  return db
    .select()
    .from(moderationLogs)
    .orderBy(desc(moderationLogs.createdAt))
    .limit(100);
}

function formatDate(date: Date): string {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const ACTION_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  ban: { label: "Бан", color: "text-red-400", bg: "bg-red-500/10", icon: "🔨" },
  unban: { label: "Разбан", color: "text-green-400", bg: "bg-green-500/10", icon: "🔓" },
  kick: { label: "Кик", color: "text-orange-400", bg: "bg-orange-500/10", icon: "👢" },
  mute: { label: "Мут", color: "text-yellow-400", bg: "bg-yellow-500/10", icon: "🔇" },
  unmute: { label: "Анмут", color: "text-blue-400", bg: "bg-blue-500/10", icon: "🔊" },
  warn: { label: "Варн", color: "text-purple-400", bg: "bg-purple-500/10", icon: "⚠️" },
};

export default async function LogsPage() {
  const logs = await getLogs();

  const actionCounts = logs.reduce(
    (acc, log) => {
      acc[log.action] = (acc[log.action] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <header className="border-b border-white/5 bg-[#161b22]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="text-white/40 hover:text-white transition text-sm">
            ← Назад
          </Link>
          <div className="w-px h-5 bg-white/10" />
          <h1 className="font-semibold text-sm">Лог модерации</h1>
          <span className="text-xs text-white/30">последние {logs.length} записей</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary */}
        <div className="flex flex-wrap gap-3 mb-6">
          {Object.entries(ACTION_MAP).map(([action, info]) => (
            <div
              key={action}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl ${info.bg} border border-white/5`}
            >
              <span className="text-base">{info.icon}</span>
              <span className={`text-sm font-medium ${info.color}`}>{info.label}</span>
              <span className="text-sm text-white/50">{actionCounts[action] ?? 0}</span>
            </div>
          ))}
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-xl font-semibold mb-2">Нет записей</h2>
            <p className="text-white/40">Действия модерации будут отображаться здесь</p>
          </div>
        ) : (
          <div className="bg-[#161b22] rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 text-xs">
                    <th className="text-left px-5 py-3">Действие</th>
                    <th className="text-left px-5 py-3">Цель</th>
                    <th className="text-left px-5 py-3">Исполнитель</th>
                    <th className="text-left px-5 py-3">Чат</th>
                    <th className="text-left px-5 py-3">Причина</th>
                    <th className="text-left px-5 py-3">Дата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log) => {
                    const action = ACTION_MAP[log.action] ?? {
                      label: log.action,
                      color: "text-white/60",
                      bg: "bg-white/5",
                      icon: "📌",
                    };
                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-white/2 transition text-sm"
                      >
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${action.bg} ${action.color}`}
                          >
                            {action.icon} {action.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-white/70">
                          <div>
                            {log.targetFirstName ?? log.targetUsername ?? `ID ${log.targetUserId}`}
                          </div>
                          <div className="text-white/30 text-xs">ID: {log.targetUserId}</div>
                        </td>
                        <td className="px-5 py-3 text-white/50">
                          {log.executorUsername ? `@${log.executorUsername}` : `ID ${log.executorUserId}`}
                        </td>
                        <td className="px-5 py-3 text-white/40">
                          {log.chatTitle ? (
                            <Link
                              href={`/chats/${log.chatId}`}
                              className="hover:text-white/70 transition"
                            >
                              {log.chatTitle}
                            </Link>
                          ) : (
                            <span className="text-white/25">{log.chatId}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-white/40 max-w-[200px]">
                          <div className="truncate">{log.reason ?? "—"}</div>
                        </td>
                        <td className="px-5 py-3 text-white/30 whitespace-nowrap text-xs">
                          {formatDate(new Date(log.createdAt))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
