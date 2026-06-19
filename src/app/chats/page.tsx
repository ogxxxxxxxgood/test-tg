import { db } from "@/db";
import { chats, bannedUsers, chatAdmins } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getChatsData() {
  const allChats = await db.select().from(chats).orderBy(chats.addedAt);

  const chatsWithStats = await Promise.all(
    allChats.map(async (chat) => {
      const [bansResult, adminsResult] = await Promise.all([
        db
          .select({ count: count() })
          .from(bannedUsers)
          .where(eq(bannedUsers.chatId, chat.id)),
        db
          .select({ count: count() })
          .from(chatAdmins)
          .where(eq(chatAdmins.chatId, chat.id)),
      ]);

      return {
        ...chat,
        banCount: bansResult[0]?.count ?? 0,
        adminCount: adminsResult[0]?.count ?? 0,
      };
    })
  );

  return chatsWithStats;
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

export default async function ChatsPage() {
  const chatsData = await getChatsData();

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <header className="border-b border-white/5 bg-[#161b22]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="text-white/40 hover:text-white transition text-sm">
            ← Назад
          </Link>
          <div className="w-px h-5 bg-white/10" />
          <h1 className="font-semibold text-sm">Все чаты ({chatsData.length})</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {chatsData.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-xl font-semibold mb-2">Нет чатов</h2>
            <p className="text-white/40">Добавьте бота в группу для начала работы</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {chatsData.map((chat) => (
              <Link
                key={chat.id}
                href={`/chats/${chat.id}`}
                className="block p-5 bg-[#161b22] rounded-2xl border border-white/5 hover:border-white/10 transition group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                      {chat.type === "supergroup" ? "👥" : "💬"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{chat.title}</h3>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            chat.isActive
                              ? "bg-green-500/15 text-green-400"
                              : "bg-yellow-500/15 text-yellow-400"
                          }`}
                        >
                          {chat.isActive ? "✅ Активен" : "⏸ Приостановлен"}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40">
                          {chat.type === "supergroup" ? "Супергруппа" : "Группа"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-white/40">
                        <span>🆔 {chat.id}</span>
                        {chat.username && <span>@{chat.username}</span>}
                        <span>📅 {formatDate(new Date(chat.addedAt))}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-center flex-shrink-0">
                    <div>
                      <div className="text-lg font-bold">{chat.memberCount}</div>
                      <div className="text-[10px] text-white/30">участников</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-red-400">{chat.banCount}</div>
                      <div className="text-[10px] text-white/30">в ЧС</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-yellow-400">{chat.adminCount}</div>
                      <div className="text-[10px] text-white/30">админов</div>
                    </div>
                    <div className="text-white/20 group-hover:text-white/60 transition text-lg">
                      →
                    </div>
                  </div>
                </div>

                {chat.inviteLink && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <a
                      href={chat.inviteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 transition"
                      onClick={(e) => e.stopPropagation()}
                    >
                      🔗 {chat.inviteLink}
                    </a>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
