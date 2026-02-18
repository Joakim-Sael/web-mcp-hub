import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { ToolDescriptor } from "./types.js";

export const configs = pgTable(
  "configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: text("domain").notNull(),
    urlPattern: text("url_pattern").notNull(),
    pageType: text("page_type"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    tools: jsonb("tools").$type<ToolDescriptor[]>().notNull(),
    contributor: text("contributor").notNull(),
    version: integer("version").default(1).notNull(),
    tags: jsonb("tags").$type<string[]>(),
    hasExecution: integer("has_execution").default(0).notNull(),
    verifiedTools: jsonb("verified_tools").$type<Record<string, ToolDescriptor>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_configs_domain").on(table.domain),
    index("idx_configs_has_execution").on(table.hasExecution),
  ],
).enableRLS();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const configVotes = pgTable(
  "config_votes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    configId: uuid("config_id")
      .notNull()
      .references(() => configs.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    vote: integer("vote").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.configId, table.toolName] })],
).enableRLS();

// Column names use snake_case (refresh_token, access_token, etc.) because
// @auth/drizzle-adapter expects these exact property names.
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
).enableRLS();

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
}).enableRLS();

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
).enableRLS();

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").unique().notNull(),
    keyPrefix: text("key_prefix").notNull(),
    label: text("label").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_api_keys_user_id").on(table.userId),
    index("idx_api_keys_key_prefix").on(table.keyPrefix),
  ],
).enableRLS();
