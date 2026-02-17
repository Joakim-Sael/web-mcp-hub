// ---------------------------------------------------------------------------
// URL Pattern Matching — supports :param dynamic segments and ** wildcards
// ---------------------------------------------------------------------------

/**
 * Extract the pathname from a urlPattern by stripping the domain prefix.
 *
 *   "example.com/dashboard/:id" → "/dashboard/:id"
 *   "example.com"               → "/"
 */
function extractPath(urlPattern: string, domain: string): string {
  let path = urlPattern;

  // Strip domain prefix (already normalized lowercase, no www.)
  if (path.toLowerCase().startsWith(domain)) {
    path = path.slice(domain.length);
  }

  if (!path.startsWith("/")) path = "/" + path;

  // Remove trailing slash for consistency (except root)
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  return path;
}

/**
 * Normalize a raw URL (full or partial) to just its pathname.
 *
 *   "https://example.com/dashboard/abc?foo=bar" → "/dashboard/abc"
 *   "example.com/dashboard/abc"                 → "/dashboard/abc"
 */
function normalizeUrlToPath(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return path;
  } catch {
    // Not a full URL — strip protocol-like prefix and domain
    let path = url.replace(/^https?:\/\//, "");
    const slashIdx = path.indexOf("/");
    if (slashIdx >= 0) {
      path = path.slice(slashIdx);
    } else {
      path = "/";
    }
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return path;
  }
}

interface MatchResult {
  matched: boolean;
  /** Higher = more specific. Static segments score 3, dynamic (:param) 2, wildcard (**) 0. */
  score: number;
  /** Captured dynamic params, e.g. { id: "abc-123" } */
  params: Record<string, string>;
}

/**
 * Match a URL against a urlPattern.
 *
 * Pattern segment types:
 *   - `"static"`  — exact match (case-insensitive)      → score +3
 *   - `":param"`  — any single path segment, captured    → score +2
 *   - `"**"`      — matches all remaining segments (must be last) → score +0
 *
 * A domain-only pattern (path = "/") always matches with score 0.
 *
 * The number of segments must match exactly unless a ** wildcard is used.
 */
function matchUrlPattern(
  urlPattern: string,
  actualUrl: string,
  domain: string,
): MatchResult {
  const patternPath = extractPath(urlPattern, domain);
  const urlPath = normalizeUrlToPath(actualUrl);

  // Domain-only pattern — matches everything on the domain
  if (patternPath === "/") {
    return { matched: true, score: 0, params: {} };
  }

  const patternSegments = patternPath.split("/").filter(Boolean);
  const urlSegments = urlPath.split("/").filter(Boolean);

  const params: Record<string, string> = {};
  let score = 0;

  for (let i = 0; i < patternSegments.length; i++) {
    const ps = patternSegments[i];

    // Wildcard — matches everything remaining (adds no score so exact
    // patterns always outrank wildcards at the same depth)
    if (ps === "**") {
      return { matched: true, score, params };
    }

    // Not enough URL segments for this pattern segment
    if (i >= urlSegments.length) {
      return { matched: false, score: 0, params: {} };
    }

    const us = urlSegments[i];

    // Dynamic segment — matches any single segment
    if (ps.startsWith(":")) {
      params[ps.slice(1)] = us;
      score += 2;
      continue;
    }

    // Static segment — exact match (case-insensitive)
    if (ps.toLowerCase() === us.toLowerCase()) {
      score += 3;
      continue;
    }

    // Mismatch
    return { matched: false, score: 0, params: {} };
  }

  // If the URL has more segments than the pattern, it's not a match
  // (use ** at the end of the pattern for prefix matching)
  if (urlSegments.length > patternSegments.length) {
    return { matched: false, score: 0, params: {} };
  }

  return { matched: true, score, params };
}

/**
 * Rank a list of configs by how well their urlPattern matches an actual URL.
 *
 * Returns only matching configs, sorted most-specific-first.
 * Domain-only patterns (score 0) always match and appear last.
 */
export function rankConfigsByUrl<T extends { urlPattern: string }>(
  configs: T[],
  actualUrl: string,
  domain: string,
): T[] {
  const scored = configs
    .map((config) => ({
      config,
      ...matchUrlPattern(config.urlPattern, actualUrl, domain),
    }))
    .filter((r) => r.matched)
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.config);
}

export { extractPath, normalizeUrlToPath, matchUrlPattern };
