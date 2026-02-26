import { eq, and, like, or, sql, desc, inArray } from "drizzle-orm";
import {
  getDb,
  configs,
  tools,
  users,
  configVotes,
  rankConfigsByUrl,
  type WebMcpConfig,
  type CreateConfigInput,
  type UpdateConfigInput,
  type AddToolInput,
  type UpdateToolInput,
  type ToolDescriptor,
} from "@web-mcp-hub/db";

export type LeaderboardEntry = {
  rank: number;
  contributor: string;
  image: string | null;
  configCount: number;
  toolCount: number;
};

function toolRowToDescriptor(t: typeof tools.$inferSelect): ToolDescriptor {
  return {
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations ?? undefined,
    execution: t.execution ?? undefined,
    contributor: t.contributor,
  };
}

function rowToConfig(
  row: typeof configs.$inferSelect,
  toolRows: (typeof tools.$inferSelect)[],
): WebMcpConfig {
  const verifiedToolNames = toolRows.filter((t) => t.verified).map((t) => t.name);
  return {
    id: row.id,
    domain: row.domain,
    urlPattern: row.urlPattern,
    pageType: row.pageType ?? undefined,
    title: row.title,
    description: row.description,
    tools: toolRows.map(toolRowToDescriptor),
    contributor: row.contributor,
    version: row.version,
    verified: toolRows.length > 0 && toolRows.every((t) => t.verified),
    verifiedToolNames: verifiedToolNames.length > 0 ? verifiedToolNames : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tags: row.tags ?? undefined,
  };
}

function rowToVerifiedConfig(
  row: typeof configs.$inferSelect,
  toolRows: (typeof tools.$inferSelect)[],
): WebMcpConfig {
  const verifiedToolRows = toolRows.filter((t) => t.verified);
  const verifiedToolNames = verifiedToolRows.map((t) => t.name);
  return {
    id: row.id,
    domain: row.domain,
    urlPattern: row.urlPattern,
    pageType: row.pageType ?? undefined,
    title: row.title,
    description: row.description,
    tools: verifiedToolRows.map(toolRowToDescriptor),
    totalToolCount: toolRows.length,
    contributor: row.contributor,
    version: row.version,
    verified: toolRows.length > 0 && toolRows.every((t) => t.verified),
    verifiedToolNames: verifiedToolNames.length > 0 ? verifiedToolNames : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tags: row.tags ?? undefined,
  };
}

async function getToolsForConfigIds(
  configIds: string[],
): Promise<Map<string, (typeof tools.$inferSelect)[]>> {
  if (configIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db.select().from(tools).where(inArray(tools.configId, configIds));
  const map = new Map<string, (typeof tools.$inferSelect)[]>();
  for (const id of configIds) map.set(id, []);
  for (const row of rows) map.get(row.configId)!.push(row);
  return map;
}

export async function listConfigs(opts: {
  search?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
  yolo?: boolean;
  /** When set, the user's own configs are included even if unverified. */
  currentUser?: string;
}): Promise<{ configs: WebMcpConfig[]; total: number }> {
  const db = getDb();
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const yolo = opts.yolo ?? false;

  const conditions = [];

  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(
      or(
        like(configs.domain, term),
        like(configs.title, term),
        like(configs.description, term),
        like(configs.urlPattern, term),
      ),
    );
  }

  if (opts.tag) {
    conditions.push(sql`${configs.tags} @> ${JSON.stringify([opts.tag])}::jsonb`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(configs)
    .where(where);

  const rows = await db
    .select()
    .from(configs)
    .where(where)
    .orderBy(desc(configs.updatedAt))
    .limit(pageSize)
    .offset(offset);

  const toolsMap = await getToolsForConfigIds(rows.map((r) => r.id));

  const mapper = yolo
    ? (row: typeof configs.$inferSelect) => rowToConfig(row, toolsMap.get(row.id) ?? [])
    : opts.currentUser
      ? (row: typeof configs.$inferSelect) =>
          row.contributor === opts.currentUser
            ? rowToConfig(row, toolsMap.get(row.id) ?? [])
            : rowToVerifiedConfig(row, toolsMap.get(row.id) ?? [])
      : (row: typeof configs.$inferSelect) => rowToVerifiedConfig(row, toolsMap.get(row.id) ?? []);

  return {
    configs: rows.map(mapper),
    total: Number(countResult.count),
  };
}

export async function lookupByDomain(
  domain: string,
  url?: string,
  opts?: { executable?: boolean; yolo?: boolean; currentUser?: string },
): Promise<WebMcpConfig[]> {
  const db = getDb();
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  const yolo = opts?.yolo ?? false;

  const conditions = [eq(configs.domain, normalized)];
  if (opts?.executable) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM tools WHERE config_id = ${configs.id} AND execution IS NOT NULL AND verified = true)`,
    );
  }

  const rows = await db
    .select()
    .from(configs)
    .where(and(...conditions))
    .orderBy(desc(configs.updatedAt));

  const toolsMap = await getToolsForConfigIds(rows.map((r) => r.id));

  const mapper = yolo
    ? (row: typeof configs.$inferSelect) => rowToConfig(row, toolsMap.get(row.id) ?? [])
    : opts?.currentUser
      ? (row: typeof configs.$inferSelect) =>
          row.contributor === opts.currentUser
            ? rowToConfig(row, toolsMap.get(row.id) ?? [])
            : rowToVerifiedConfig(row, toolsMap.get(row.id) ?? [])
      : (row: typeof configs.$inferSelect) => rowToVerifiedConfig(row, toolsMap.get(row.id) ?? []);

  const allConfigs = rows.map(mapper);

  if (!url) return allConfigs;

  return rankConfigsByUrl(allConfigs, url, normalized);
}

export async function getConfigById(id: string): Promise<WebMcpConfig | null> {
  const db = getDb();
  const [row] = await db.select().from(configs).where(eq(configs.id, id));
  if (!row) return null;
  const toolsMap = await getToolsForConfigIds([id]);
  return rowToConfig(row, toolsMap.get(id) ?? []);
}

export async function findByDomainAndPattern(
  domain: string,
  urlPattern: string,
): Promise<WebMcpConfig | null> {
  const db = getDb();
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  const [row] = await db
    .select()
    .from(configs)
    .where(and(eq(configs.domain, normalized), eq(configs.urlPattern, urlPattern)));
  if (!row) return null;
  const toolsMap = await getToolsForConfigIds([row.id]);
  return rowToConfig(row, toolsMap.get(row.id) ?? []);
}

export async function countConfigsByContributor(contributor: string): Promise<number> {
  const db = getDb();
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(configs)
    .where(eq(configs.contributor, contributor));
  return Number(result.count);
}

export async function createConfig(input: CreateConfigInput): Promise<WebMcpConfig> {
  const db = getDb();
  const normalized = input.domain.toLowerCase().replace(/^www\./, "");
  const now = new Date();

  const [row] = await db
    .insert(configs)
    .values({
      domain: normalized,
      urlPattern: input.urlPattern,
      pageType: input.pageType ?? null,
      title: input.title,
      description: input.description,
      contributor: input.contributor,
      version: 1,
      tags: input.tags ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  let toolRows: (typeof tools.$inferSelect)[] = [];
  if (input.tools.length > 0) {
    toolRows = await db
      .insert(tools)
      .values(
        input.tools.map((t) => ({
          configId: row.id,
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: t.annotations ?? null,
          execution: t.execution ?? null,
          contributor: input.contributor,
          verified: false,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .returning();
  }

  return rowToConfig(row, toolRows);
}

export async function updateConfig(
  id: string,
  input: UpdateConfigInput,
): Promise<WebMcpConfig | null> {
  const db = getDb();

  const updates: Record<string, unknown> = {
    version: sql`${configs.version} + 1`,
    updatedAt: new Date(),
  };

  if (input.urlPattern !== undefined) updates.urlPattern = input.urlPattern;
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.pageType !== undefined) updates.pageType = input.pageType;
  if (input.contributor !== undefined) updates.contributor = input.contributor;
  if (input.tags !== undefined) updates.tags = input.tags;

  const [row] = await db.update(configs).set(updates).where(eq(configs.id, id)).returning();
  if (!row) return null;

  const toolsMap = await getToolsForConfigIds([id]);
  return rowToConfig(row, toolsMap.get(id) ?? []);
}

export async function addToolToConfig(
  configId: string,
  tool: AddToolInput,
  contributor: string,
): Promise<ToolDescriptor | null | "limit"> {
  const db = getDb();
  const now = new Date();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tools)
    .where(eq(tools.configId, configId));

  if (Number(count) >= 50) return "limit";

  const [inserted] = await db
    .insert(tools)
    .values({
      configId,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations ?? null,
      execution: tool.execution ?? null,
      contributor,
      verified: false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  if (!inserted) return null; // name already taken in this config

  return toolRowToDescriptor(inserted);
}

export async function updateToolInConfig(
  configId: string,
  toolName: string,
  input: UpdateToolInput,
): Promise<ToolDescriptor | null> {
  const db = getDb();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.description !== undefined) updates.description = input.description;
  if (input.inputSchema !== undefined) updates.inputSchema = input.inputSchema;
  if (input.annotations !== undefined) updates.annotations = input.annotations ?? null;
  if (input.execution !== undefined) updates.execution = input.execution ?? null;

  const [updated] = await db
    .update(tools)
    .set(updates)
    .where(and(eq(tools.configId, configId), eq(tools.name, toolName)))
    .returning();

  if (!updated) return null;
  return toolRowToDescriptor(updated);
}

export async function deleteToolFromConfig(
  configId: string,
  toolName: string,
): Promise<WebMcpConfig | null> {
  const db = getDb();

  const [configRow] = await db.select().from(configs).where(eq(configs.id, configId));
  if (!configRow) return null;

  const deleted = await db
    .delete(tools)
    .where(and(eq(tools.configId, configId), eq(tools.name, toolName)))
    .returning();

  if (deleted.length > 0) {
    const remaining = await db.select().from(tools).where(eq(tools.configId, configId));
    if (remaining.length === 0) {
      await db.delete(configs).where(eq(configs.id, configId));
      return null;
    }
  }

  const toolsMap = await getToolsForConfigIds([configId]);
  return rowToConfig(configRow, toolsMap.get(configId) ?? []);
}

export async function getStats(): Promise<{
  totalConfigs: number;
  totalTools: number;
  totalUsers: number;
  topDomains: { domain: string; count: number }[];
}> {
  const db = getDb();

  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(configs);
  const [userCountResult] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [toolCountResult] = await db.select({ total: sql<number>`count(*)` }).from(tools);

  const topDomains = await db
    .select({
      domain: configs.domain,
      count: sql<number>`count(*)`,
    })
    .from(configs)
    .groupBy(configs.domain)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  return {
    totalConfigs: Number(countResult.count),
    totalTools: Number(toolCountResult.total),
    totalUsers: Number(userCountResult.count),
    topDomains: topDomains.map((d) => ({
      domain: d.domain,
      count: Number(d.count),
    })),
  };
}

export async function getLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
  const db = getDb();

  const rows = await db
    .select({
      contributor: tools.contributor,
      image: users.image,
      toolCount: sql<number>`count(*)`,
      configCount: sql<number>`(SELECT count(*) FROM configs WHERE contributor = ${tools.contributor})`,
    })
    .from(tools)
    .leftJoin(users, eq(tools.contributor, users.name))
    .groupBy(tools.contributor, users.image)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.map((row, i) => ({
    rank: i + 1,
    contributor: row.contributor,
    image: row.image,
    configCount: Number(row.configCount),
    toolCount: Number(row.toolCount),
  }));
}

// ── Votes ────────────────────────────────────────────────────────────

export type ToolVoteSummary = {
  score: number;
  userVote: number | null;
};

export async function getToolVotes(
  configId: string,
  toolName: string,
  userId?: string,
): Promise<ToolVoteSummary> {
  const db = getDb();

  const where = and(eq(configVotes.configId, configId), eq(configVotes.toolName, toolName));

  const [scoreResult] = await db
    .select({ score: sql<number>`coalesce(sum(${configVotes.vote}), 0)` })
    .from(configVotes)
    .where(where);

  let userVote: number | null = null;
  if (userId) {
    const [row] = await db
      .select({ vote: configVotes.vote })
      .from(configVotes)
      .where(and(where, eq(configVotes.userId, userId)));
    userVote = row?.vote ?? null;
  }

  return { score: Number(scoreResult.score), userVote };
}

export async function getToolVotesBatch(
  configId: string,
  toolNames: string[],
  userId?: string,
): Promise<Record<string, ToolVoteSummary>> {
  if (toolNames.length === 0) return {};

  const db = getDb();

  // Get scores per tool
  const scoreRows = await db
    .select({
      toolName: configVotes.toolName,
      score: sql<number>`coalesce(sum(${configVotes.vote}), 0)`,
    })
    .from(configVotes)
    .where(and(eq(configVotes.configId, configId), inArray(configVotes.toolName, toolNames)))
    .groupBy(configVotes.toolName);

  const result: Record<string, ToolVoteSummary> = {};
  for (const name of toolNames) {
    result[name] = { score: 0, userVote: null };
  }
  for (const row of scoreRows) {
    result[row.toolName] = { score: Number(row.score), userVote: null };
  }

  // Get user's votes if authenticated
  if (userId) {
    const userRows = await db
      .select({ toolName: configVotes.toolName, vote: configVotes.vote })
      .from(configVotes)
      .where(
        and(
          eq(configVotes.configId, configId),
          eq(configVotes.userId, userId),
          inArray(configVotes.toolName, toolNames),
        ),
      );
    for (const row of userRows) {
      if (result[row.toolName]) {
        result[row.toolName].userVote = row.vote;
      }
    }
  }

  return result;
}

export async function upsertToolVote(
  userId: string,
  configId: string,
  toolName: string,
  vote: number,
): Promise<void> {
  const db = getDb();

  const where = and(
    eq(configVotes.userId, userId),
    eq(configVotes.configId, configId),
    eq(configVotes.toolName, toolName),
  );

  // Check for existing vote to handle toggle-off (same direction → delete)
  const [existing] = await db.select({ vote: configVotes.vote }).from(configVotes).where(where);

  if (existing?.vote === vote) {
    // Same direction → toggle off (remove vote)
    await db.delete(configVotes).where(where);
  } else {
    // No vote or different direction → atomic upsert prevents PK constraint violation
    // under concurrent requests from the same user
    await db
      .insert(configVotes)
      .values({ userId, configId, toolName, vote, createdAt: new Date() })
      .onConflictDoUpdate({
        target: [configVotes.userId, configVotes.configId, configVotes.toolName],
        set: { vote, createdAt: new Date() },
      });
  }
}

export async function getConfigVoteSummaries(configIds: string[]): Promise<Record<string, number>> {
  if (configIds.length === 0) return {};

  const db = getDb();
  const rows = await db
    .select({
      configId: configVotes.configId,
      score: sql<number>`coalesce(sum(${configVotes.vote}), 0)`,
    })
    .from(configVotes)
    .where(inArray(configVotes.configId, configIds))
    .groupBy(configVotes.configId);

  const result: Record<string, number> = {};
  for (const id of configIds) {
    result[id] = 0;
  }
  for (const row of rows) {
    result[row.configId] = Number(row.score);
  }
  return result;
}
