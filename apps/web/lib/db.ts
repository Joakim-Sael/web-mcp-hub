import { eq, and, like, or, sql, desc, inArray } from "drizzle-orm";
import {
  getDb,
  configs,
  users,
  configVotes,
  rankConfigsByUrl,
  type WebMcpConfig,
  type CreateConfigInput,
  type UpdateConfigInput,
  type ToolDescriptor,
} from "@web-mcp-hub/db";

export type LeaderboardEntry = {
  rank: number;
  contributor: string;
  image: string | null;
  configCount: number;
  toolCount: number;
};

function rowToConfig(row: typeof configs.$inferSelect): WebMcpConfig {
  const vMap = row.verifiedTools ?? {};
  const allVerified = row.tools.length > 0 && row.tools.every((t) => t.name in vMap);
  return {
    id: row.id,
    domain: row.domain,
    urlPattern: row.urlPattern,
    pageType: row.pageType ?? undefined,
    title: row.title,
    description: row.description,
    tools: row.tools,
    contributor: row.contributor,
    version: row.version,
    verified: allVerified,
    verifiedToolNames: row.verifiedTools ? Object.keys(row.verifiedTools) : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tags: row.tags ?? undefined,
  };
}

function rowToVerifiedConfig(row: typeof configs.$inferSelect): WebMcpConfig {
  const vMap = row.verifiedTools ?? {};
  // Only include tools that have a verified snapshot, using the snapshot version
  const verifiedTools = row.tools.filter((t) => t.name in vMap).map((t) => vMap[t.name]);
  const allVerified = row.tools.length > 0 && row.tools.every((t) => t.name in vMap);
  return {
    id: row.id,
    domain: row.domain,
    urlPattern: row.urlPattern,
    pageType: row.pageType ?? undefined,
    title: row.title,
    description: row.description,
    tools: verifiedTools,
    contributor: row.contributor,
    version: row.version,
    verified: allVerified,
    verifiedToolNames: row.verifiedTools ? Object.keys(row.verifiedTools) : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tags: row.tags ?? undefined,
  };
}

function computeHasExecution(tools: ToolDescriptor[]): number {
  return tools.some((t) => t.execution) ? 1 : 0;
}

export async function listConfigs(opts: {
  search?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
  yolo?: boolean;
}): Promise<{ configs: WebMcpConfig[]; total: number }> {
  const db = getDb();
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const yolo = opts.yolo ?? false;

  const conditions = [];

  if (!yolo) {
    conditions.push(
      sql`${configs.verifiedTools} IS NOT NULL AND ${configs.verifiedTools} != '{}'::jsonb`,
    );
  }

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

  return {
    configs: rows.map(yolo ? rowToConfig : rowToVerifiedConfig),
    total: Number(countResult.count),
  };
}

export async function lookupByDomain(
  domain: string,
  url?: string,
  opts?: { executable?: boolean; yolo?: boolean },
): Promise<WebMcpConfig[]> {
  const db = getDb();
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  const yolo = opts?.yolo ?? false;

  const conditions = [eq(configs.domain, normalized)];
  if (opts?.executable) {
    conditions.push(eq(configs.hasExecution, 1));
  }
  if (!yolo) {
    conditions.push(
      sql`${configs.verifiedTools} IS NOT NULL AND ${configs.verifiedTools} != '{}'::jsonb`,
    );
  }

  // Fetch all configs for this domain
  const rows = await db
    .select()
    .from(configs)
    .where(and(...conditions))
    .orderBy(desc(configs.updatedAt));

  const mapper = yolo ? rowToConfig : rowToVerifiedConfig;
  const allConfigs = rows.map(mapper);

  // Without a URL, return everything for the domain
  if (!url) return allConfigs;

  // Rank configs by URL pattern specificity (most specific first).
  // Supports :param dynamic segments and ** wildcards in urlPattern.
  return rankConfigsByUrl(allConfigs, url, normalized);
}

export async function getConfigById(id: string): Promise<WebMcpConfig | null> {
  const db = getDb();
  const [row] = await db.select().from(configs).where(eq(configs.id, id));
  return row ? rowToConfig(row) : null;
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
  return row ? rowToConfig(row) : null;
}

export async function createConfig(input: CreateConfigInput): Promise<WebMcpConfig> {
  const db = getDb();
  const normalized = input.domain.toLowerCase().replace(/^www\./, "");
  const hasExecution = computeHasExecution(input.tools);
  const now = new Date();

  const [row] = await db
    .insert(configs)
    .values({
      domain: normalized,
      urlPattern: input.urlPattern,
      pageType: input.pageType ?? null,
      title: input.title,
      description: input.description,
      tools: input.tools,
      contributor: input.contributor,
      version: 1,
      tags: input.tags ?? null,
      hasExecution,
      verifiedTools: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return rowToConfig(row);
}

export async function updateConfig(
  id: string,
  input: UpdateConfigInput,
): Promise<WebMcpConfig | null> {
  const db = getDb();
  const existing = await getConfigById(id);
  if (!existing) return null;

  const updates: Record<string, unknown> = {
    version: sql`${configs.version} + 1`,
    updatedAt: new Date(),
  };

  if (input.urlPattern !== undefined) updates.urlPattern = input.urlPattern;
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.pageType !== undefined) updates.pageType = input.pageType;
  if (input.tools !== undefined) {
    updates.tools = input.tools;
    updates.hasExecution = computeHasExecution(input.tools);
  }
  if (input.contributor !== undefined) updates.contributor = input.contributor;
  if (input.tags !== undefined) updates.tags = input.tags;

  const [row] = await db.update(configs).set(updates).where(eq(configs.id, id)).returning();

  return row ? rowToConfig(row) : null;
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

  const [toolCountResult] = await db
    .select({
      total: sql<number>`coalesce(sum(jsonb_array_length(${configs.tools})), 0)`,
    })
    .from(configs);

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
      contributor: configs.contributor,
      image: users.image,
      configCount: sql<number>`count(*)`,
      toolCount: sql<number>`coalesce(sum(jsonb_array_length(${configs.tools})), 0)`,
    })
    .from(configs)
    .leftJoin(users, eq(configs.contributor, users.name))
    .groupBy(configs.contributor, users.image)
    .orderBy(sql`count(*) desc`, sql`coalesce(sum(jsonb_array_length(${configs.tools})), 0) desc`)
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

  // Check for existing vote
  const [existing] = await db.select({ vote: configVotes.vote }).from(configVotes).where(where);

  if (existing) {
    if (existing.vote === vote) {
      // Same direction → toggle off (remove vote)
      await db.delete(configVotes).where(where);
    } else {
      // Different direction → update
      await db.update(configVotes).set({ vote, createdAt: new Date() }).where(where);
    }
  } else {
    // No existing vote → insert
    await db
      .insert(configVotes)
      .values({ userId, configId, toolName, vote, createdAt: new Date() });
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
