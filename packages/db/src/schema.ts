import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { ExecutionDescriptor } from "./types.js";

export const configs = pgTable(
  "configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: text("domain").notNull(),
    urlPattern: text("url_pattern").notNull(),
    pageType: text("page_type"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    contributor: text("contributor").notNull(),
    version: integer("version").default(1).notNull(),
    tags: jsonb("tags").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_configs_domain").on(table.domain),
    uniqueIndex("configs_domain_url_unique").on(table.domain, table.urlPattern),
    check("configs_title_length", sql`char_length(${table.title}) <= 200`),
    check("configs_description_length", sql`char_length(${table.description}) <= 5000`),
  ],
).enableRLS();

export const tools = pgTable(
  "tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    configId: uuid("config_id")
      .notNull()
      .references(() => configs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    inputSchema: jsonb("input_schema").$type<Record<string, unknown>>().notNull(),
    annotations: jsonb("annotations").$type<Record<string, string>>(),
    execution: jsonb("execution").$type<ExecutionDescriptor>(),
    contributor: text("contributor").notNull(),
    verified: boolean("verified").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_tools_config_name").on(table.configId, table.name),
    index("idx_tools_config_id").on(table.configId),
    index("idx_tools_contributor").on(table.contributor),
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
