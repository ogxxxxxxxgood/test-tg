import {
  pgTable,
  bigint,
  text,
  timestamp,
  boolean,
  integer,
  varchar,
  primaryKey,
  jsonb,
} from "drizzle-orm/pg-core";

// ─── Chats (groups where the bot is active) ───────────────────────────────────
export const chats = pgTable("chats", {
  id: bigint("id", { mode: "number" }).primaryKey(), // Telegram chat ID
  title: text("title").notNull(),
  username: text("username"), // null if private group
  type: varchar("type", { length: 20 }).notNull().default("supergroup"), // group | supergroup | channel
  memberCount: integer("member_count").default(0),
  inviteLink: text("invite_link"),
  isActive: boolean("is_active").notNull().default(true), // false = bot suspended
  addedAt: timestamp("added_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Chat Admins (bot-level admin registry per chat) ──────────────────────────
export const chatAdmins = pgTable(
  "chat_admins",
  {
    chatId: bigint("chat_id", { mode: "number" })
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    username: text("username"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    addedBy: bigint("added_by", { mode: "number" }).notNull(), // who used /addadmin
    addedAt: timestamp("added_at").notNull().defaultNow(),
    isFounder: boolean("is_founder").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.chatId, t.userId] })]
);

// ─── Banned Users (per-chat blacklist) ────────────────────────────────────────
export const bannedUsers = pgTable(
  "banned_users",
  {
    chatId: bigint("chat_id", { mode: "number" })
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    username: text("username"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    bannedBy: bigint("banned_by", { mode: "number" }).notNull(),
    bannedByUsername: text("banned_by_username"),
    reason: text("reason"),
    bannedAt: timestamp("banned_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.chatId, t.userId] })]
);

// ─── Muted Users (per-chat mute log) ─────────────────────────────────────────
export const mutedUsers = pgTable(
  "muted_users",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    chatId: bigint("chat_id", { mode: "number" })
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    username: text("username"),
    firstName: text("first_name"),
    mutedBy: bigint("muted_by", { mode: "number" }).notNull(),
    mutedByUsername: text("muted_by_username"),
    reason: text("reason"),
    mutedAt: timestamp("muted_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"), // null = permanent
    isActive: boolean("is_active").notNull().default(true),
  }
);

// ─── Moderation Logs (full audit trail) ───────────────────────────────────────
export const moderationLogs = pgTable("moderation_logs", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  chatTitle: text("chat_title"),
  action: varchar("action", { length: 20 }).notNull(), // ban | unban | kick | mute | unmute | warn
  targetUserId: bigint("target_user_id", { mode: "number" }).notNull(),
  targetUsername: text("target_username"),
  targetFirstName: text("target_first_name"),
  executorUserId: bigint("executor_user_id", { mode: "number" }).notNull(),
  executorUsername: text("executor_username"),
  reason: text("reason"),
  meta: jsonb("meta"), // extra data (duration, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Warns (per-chat warning system) ─────────────────────────────────────────
export const warns = pgTable("warns", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity(),
  chatId: bigint("chat_id", { mode: "number" })
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  username: text("username"),
  firstName: text("first_name"),
  warnedBy: bigint("warned_by", { mode: "number" }).notNull(),
  warnedByUsername: text("warned_by_username"),
  reason: text("reason"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Chat Settings ────────────────────────────────────────────────────────────
export const chatSettings = pgTable("chat_settings", {
  chatId: bigint("chat_id", { mode: "number" })
    .primaryKey()
    .references(() => chats.id, { onDelete: "cascade" }),
  welcomeMessage: text("welcome_message"),
  welcomeEnabled: boolean("welcome_enabled").notNull().default(false),
  goodbyeMessage: text("goodbye_message"),
  goodbyeEnabled: boolean("goodbye_enabled").notNull().default(false),
  rulesText: text("rules_text"),
  antiSpamEnabled: boolean("anti_spam_enabled").notNull().default(false),
  antiFloodEnabled: boolean("anti_flood_enabled").notNull().default(false),
  antiFloodLimit: integer("anti_flood_limit").notNull().default(5), // msgs per 5 sec
  maxWarns: integer("max_warns").notNull().default(3),
  warnAction: varchar("warn_action", { length: 10 }).notNull().default("kick"), // kick | ban | mute
  languageCode: varchar("language_code", { length: 10 }).notNull().default("ru"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Pending Admin Checks (for auto-leave if no admin given) ──────────────────
export const pendingAdminChecks = pgTable("pending_admin_checks", {
  chatId: bigint("chat_id", { mode: "number" }).primaryKey(),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  deadlineAt: timestamp("deadline_at").notNull(),
  resolved: boolean("resolved").notNull().default(false),
});

// ─── Anti-Flood Tracker (in-memory is fine, but persisted for analytics) ──────
export const floodMessages = pgTable("flood_messages", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  messageCount: integer("message_count").notNull().default(1),
  windowStart: timestamp("window_start").notNull().defaultNow(),
});
