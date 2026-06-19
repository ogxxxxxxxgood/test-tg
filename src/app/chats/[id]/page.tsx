import { db } from "@/db";
import {
  chats,
  bannedUsers,
  chatAdmins,
  moderationLogs,
  warns,
  mutedUsers,
  chatSettings,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getChatData(chatId: number) {
  const [
    chatResult,
    bans,
    admins,
    logs,
    activeWarns,
    activeMutes,
    settings,
  ] = await Promise.all([
    db.select().from(chats).where(eq(chats.id, chatId)).limit(1),
    db.select().from(bannedUsers).where(eq(bannedUsers.chatId, chatId)).orderBy(desc(bannedUsers.bannedAt)),
    db.select().from(chatAdmins).where(eq(chatAdmins.chatId, chatId)).orderBy(chatAdmins.addedAt),
    db.select().from(moderationLogs).where(eq(moderationLogs.chatId, chatId)).orderBy(desc(moderationLogs.createdAt)).limit(20),
    db.select().from(warns).where(and(eq(warns.chatId, chatId), eq(warns.isActive, true))).orderBy(desc(warns.createdAt)),
    db.select().from(mutedUsers).where(and(eq(mutedUsers.chatId, chatId), eq(mutedUsers.isActive, true))).orderBy(desc(mutedUsers.mutedAt)),
    db.select().from(chatSettings).where(eq(chatSettings.chatId, chatId)).limit(1),
  ]);

  return {
    chat: chatResult[0] ?? null,
    bans,
    admins,
    logs,
    activeWarns,
    activeMutes,
    settings: settings[0] ?? null,
  };
}

function formatDate(date: Date): string {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_MAP: Record<string, { label: string; color: string; icon: string }> = {
  ban: { label: "Бан", color: "text-red-400", icon: "🔨" },
  unban: { label: "Разбан", color: "text-green-400", icon: "🔓" },
  kick: { label: "Кик", color: "text-orange-400", icon: "👢" },
  mute: { label: "Мут", color: "text-yellow-400", icon: "🔇" },
  unmute: { label: "Анмут", color: "text-blue-400", icon: "🔊" },
  warn: { label: "Варн", color: "text-purple-400", icon: "⚠️" },
};

export default async function ChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const chatId = parseInt(resolvedParams.id, 10);
  if (isNaN(chatId)) notFound();

  const { chat, bans, admins, logs, activeWarns, activeMutes, settings } =
    await getChatData(chatId);

  if (!chat) notFound();

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <header className="border-b border-white/5 bg-[#161b22]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/chats" className="text-white/40 hover:text-white transition text-sm">
            ← Все чаты
          </Link>
          <div className="w-px h-5 bg-white/10" />
          <h1 className="font-semibold text-sm truncate">{chat.title}</h1>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
              chat.isActive
                ? "bg-green-500/15 text-green-400"
                : "bg-yellow-500/15 text-yellow-400"
            }`}
          >
            {chat.isActive ? "✅ Активен" : "⏸ Приостановлен"}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ─── Chat Info Card ──────────────────────────────────────────────── */}
        <div className="bg-[#161b22] rounded-2xl border border-white/5 p-6 mb-6">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-3xl flex-shrink-0">
              {chat.type === "supergroup" ? "👥" : "💬"}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold">{chat.title}</h2>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-white/50">
                <span>🆔 <code className="text-white/70 text-xs">{chat.id}</code></span>
                <span>📂 {chat.type === "supergroup" ? "Супергруппа" : "Группа"}</span>
                {chat.username && <span>🔗 @{chat.username}</span>}
                <span>📅 Добавлен: {formatDate(new Date(chat.addedAt))}</span>
              </div>
              {chat.inviteLink && (
                <div className="mt-2">
                  <a
                    href={chat.inviteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    🔗 {chat.inviteLink}
                  </a>
                </div>
              )}
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{chat.memberCount}</div>
                <div className="text-xs text-white/40">участников</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{bans.length}</div>
                <div className="text-xs text-white/40">в ЧС</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{activeWarns.length}</div>
                <div className="text-xs text-white/40">варнов</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">{activeMutes.length}</div>
                <div className="text-xs text-white/40">мутов</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* ─── Admins ─────────────────────────────────────────────────────── */}
          <section className="bg-[#161b22] rounded-2xl border border-white/5 p-5">
            <h3 className="font-semibold text-sm mb-4">👑 Администраторы бота</h3>
            {admins.length === 0 ? (
              <p className="text-white/40 text-xs">Нет зарегистрированных администраторов</p>
            ) : (
              <div className="space-y-2">
                {admins.map((admin) => (
                  <div key={admin.userId} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/3">
                    <span className="text-base">{admin.isFounder ? "⭐" : "👮"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {admin.firstName ?? admin.username ?? `ID ${admin.userId}`}
                        {admin.isFounder && <span className="text-yellow-400 text-xs ml-2">Основатель</span>}
                      </p>
                      {admin.username && (
                        <p className="text-xs text-white/40">@{admin.username}</p>
                      )}
                    </div>
                    <span className="text-xs text-white/25">{formatDate(new Date(admin.addedAt))}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─── Ban List ────────────────────────────────────────────────────── */}
          <section className="bg-[#161b22] rounded-2xl border border-white/5 p-5">
            <h3 className="font-semibold text-sm mb-4">🚫 Чёрный список ({bans.length})</h3>
            {bans.length === 0 ? (
              <p className="text-white/40 text-xs">Чёрный список пуст</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {bans.map((ban) => (
                  <div key={ban.userId} className="p-2.5 rounded-xl bg-red-500/5 border border-red-500/10">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {ban.firstName ?? ban.username ?? `ID ${ban.userId}`}
                        {ban.username && (
                          <span className="text-white/40 text-xs ml-1">@{ban.username}</span>
                        )}
                      </p>
                      <span className="text-xs text-white/30 flex-shrink-0">
                        {formatDate(new Date(ban.bannedAt))}
                      </span>
                    </div>
                    {ban.reason && (
                      <p className="text-xs text-white/40 mt-1 truncate">📝 {ban.reason}</p>
                    )}
                    <p className="text-xs text-white/25 mt-1">
                      Заблокировал: {ban.bannedByUsername ? `@${ban.bannedByUsername}` : `ID ${ban.bannedBy}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─── Active Mutes ────────────────────────────────────────────────── */}
          <section className="bg-[#161b22] rounded-2xl border border-white/5 p-5">
            <h3 className="font-semibold text-sm mb-4">🔇 Активные муты ({activeMutes.length})</h3>
            {activeMutes.length === 0 ? (
              <p className="text-white/40 text-xs">Нет активных мутов</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeMutes.map((mute) => (
                  <div key={mute.id} className="p-2.5 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {mute.firstName ?? mute.username ?? `ID ${mute.userId}`}
                      </p>
                      <span className="text-xs text-white/30 flex-shrink-0">
                        {mute.expiresAt
                          ? `до ${formatDate(new Date(mute.expiresAt))}`
                          : "Навсегда"}
                      </span>
                    </div>
                    {mute.reason && (
                      <p className="text-xs text-white/40 mt-1 truncate">📝 {mute.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─── Active Warns ─────────────────────────────────────────────────── */}
          <section className="bg-[#161b22] rounded-2xl border border-white/5 p-5">
            <h3 className="font-semibold text-sm mb-4">⚠️ Активные предупреждения ({activeWarns.length})</h3>
            {activeWarns.length === 0 ? (
              <p className="text-white/40 text-xs">Нет активных предупреждений</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeWarns.map((warn) => (
                  <div key={warn.id} className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/10">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {warn.firstName ?? warn.username ?? `ID ${warn.userId}`}
                      </p>
                      <span className="text-xs text-white/30 flex-shrink-0">
                        {formatDate(new Date(warn.createdAt))}
                      </span>
                    </div>
                    {warn.reason && (
                      <p className="text-xs text-white/40 mt-1 truncate">📝 {warn.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ─── Moderation Log ──────────────────────────────────────────────── */}
        <section className="mt-6 bg-[#161b22] rounded-2xl border border-white/5 p-5">
          <h3 className="font-semibold text-sm mb-4">📋 Лог модерации</h3>
          {logs.length === 0 ? (
            <p className="text-white/40 text-sm">Нет действий</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/40 border-b border-white/5">
                    <th className="text-left pb-3 pr-4">Действие</th>
                    <th className="text-left pb-3 pr-4">Цель</th>
                    <th className="text-left pb-3 pr-4">Исполнитель</th>
                    <th className="text-left pb-3 pr-4">Причина</th>
                    <th className="text-left pb-3">Дата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log) => {
                    const action = ACTION_MAP[log.action] ?? { label: log.action, color: "text-white/60", icon: "📌" };
                    return (
                      <tr key={log.id} className="hover:bg-white/2 transition">
                        <td className={`py-2.5 pr-4 font-medium ${action.color}`}>
                          {action.icon} {action.label}
                        </td>
                        <td className="py-2.5 pr-4 text-white/70">
                          {log.targetFirstName ?? log.targetUsername ?? `ID ${log.targetUserId}`}
                        </td>
                        <td className="py-2.5 pr-4 text-white/50">
                          {log.executorUsername ? `@${log.executorUsername}` : `ID ${log.executorUserId}`}
                        </td>
                        <td className="py-2.5 pr-4 text-white/40 max-w-[200px] truncate">
                          {log.reason ?? "—"}
                        </td>
                        <td className="py-2.5 text-white/30 whitespace-nowrap">
                          {formatDate(new Date(log.createdAt))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ─── Settings ───────────────────────────────────────────────────── */}
        {settings && (
          <section className="mt-6 bg-[#161b22] rounded-2xl border border-white/5 p-5">
            <h3 className="font-semibold text-sm mb-4">⚙️ Настройки чата</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <SettingItem label="Приветствие" value={settings.welcomeEnabled ? "✅ Включено" : "❌ Выключено"} />
              <SettingItem label="Прощание" value={settings.goodbyeEnabled ? "✅ Включено" : "❌ Выключено"} />
              <SettingItem label="Анти-флуд" value={settings.antiFloodEnabled ? `✅ Включено (${settings.antiFloodLimit} сообщ./5с)` : "❌ Выключено"} />
              <SettingItem label="Анти-спам" value={settings.antiSpamEnabled ? "✅ Включено" : "❌ Выключено"} />
              <SettingItem label="Лимит варнов" value={`${settings.maxWarns} предупреждений`} />
              <SettingItem label="Действие при лимите" value={{ kick: "👢 Кик", ban: "🔨 Бан", mute: "🔇 Мут" }[settings.warnAction] ?? settings.warnAction} />
            </div>
            {settings.rulesText && (
              <div className="mt-4 p-3 rounded-xl bg-white/3 border border-white/5">
                <p className="text-white/40 text-xs mb-1">📜 Правила:</p>
                <p className="text-xs text-white/70 whitespace-pre-wrap">{settings.rulesText}</p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function SettingItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/3 border border-white/5">
      <p className="text-white/40 mb-1">{label}</p>
      <p className="text-white/80 font-medium">{value}</p>
    </div>
  );
}
