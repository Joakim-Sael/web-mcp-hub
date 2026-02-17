import { describe, it, expect } from "vitest";
import {
  matchUrlPattern,
  extractPath,
  normalizeUrlToPath,
  rankConfigsByUrl,
} from "../url-matching.js";

// ---------------------------------------------------------------------------
// extractPath
// ---------------------------------------------------------------------------

describe("extractPath", () => {
  it("extracts path from domain-prefixed pattern", () => {
    expect(extractPath("example.com/dashboard/:id", "example.com")).toBe("/dashboard/:id");
  });

  it("returns / for domain-only pattern", () => {
    expect(extractPath("example.com", "example.com")).toBe("/");
  });

  it("handles pattern without leading slash", () => {
    expect(extractPath("example.com/search", "example.com")).toBe("/search");
  });

  it("strips trailing slash", () => {
    expect(extractPath("example.com/search/", "example.com")).toBe("/search");
  });

  it("preserves root path", () => {
    expect(extractPath("example.com/", "example.com")).toBe("/");
  });
});

// ---------------------------------------------------------------------------
// normalizeUrlToPath
// ---------------------------------------------------------------------------

describe("normalizeUrlToPath", () => {
  it("extracts pathname from full URL", () => {
    expect(normalizeUrlToPath("https://example.com/dashboard/abc?foo=bar")).toBe(
      "/dashboard/abc",
    );
  });

  it("handles URL without protocol", () => {
    expect(normalizeUrlToPath("example.com/dashboard/abc")).toBe("/dashboard/abc");
  });

  it("handles domain-only URL", () => {
    expect(normalizeUrlToPath("https://example.com")).toBe("/");
  });

  it("strips trailing slash", () => {
    expect(normalizeUrlToPath("https://example.com/path/")).toBe("/path");
  });

  it("handles URL with hash", () => {
    expect(normalizeUrlToPath("https://example.com/page#section")).toBe("/page");
  });
});

// ---------------------------------------------------------------------------
// matchUrlPattern
// ---------------------------------------------------------------------------

describe("matchUrlPattern", () => {
  const domain = "example.com";

  describe("domain-only patterns", () => {
    it("matches any URL with score 0", () => {
      const result = matchUrlPattern("example.com", "https://example.com/any/path", domain);
      expect(result.matched).toBe(true);
      expect(result.score).toBe(0);
    });

    it("matches root URL", () => {
      const result = matchUrlPattern("example.com", "https://example.com", domain);
      expect(result.matched).toBe(true);
      expect(result.score).toBe(0);
    });
  });

  describe("static segment matching", () => {
    it("matches exact path with score 3 per segment", () => {
      const result = matchUrlPattern(
        "example.com/dashboard",
        "https://example.com/dashboard",
        domain,
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBe(3);
    });

    it("matches multi-segment path", () => {
      const result = matchUrlPattern(
        "example.com/admin/settings",
        "https://example.com/admin/settings",
        domain,
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBe(6); // 3 + 3
    });

    it("is case-insensitive", () => {
      const result = matchUrlPattern(
        "example.com/Dashboard",
        "https://example.com/dashboard",
        domain,
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBe(3);
    });

    it("does not match different path", () => {
      const result = matchUrlPattern(
        "example.com/dashboard",
        "https://example.com/settings",
        domain,
      );
      expect(result.matched).toBe(false);
    });

    it("does not match URL with extra segments", () => {
      const result = matchUrlPattern(
        "example.com/dashboard",
        "https://example.com/dashboard/sub",
        domain,
      );
      expect(result.matched).toBe(false);
    });

    it("does not match shorter URL", () => {
      const result = matchUrlPattern(
        "example.com/admin/settings",
        "https://example.com/admin",
        domain,
      );
      expect(result.matched).toBe(false);
    });
  });

  describe("dynamic segment matching (:param)", () => {
    it("matches any single segment with score 2", () => {
      const result = matchUrlPattern(
        "example.com/users/:id",
        "https://example.com/users/abc-123",
        domain,
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBe(5); // 3 (users) + 2 (:id)
      expect(result.params).toEqual({ id: "abc-123" });
    });

    it("captures multiple dynamic segments", () => {
      const result = matchUrlPattern(
        "example.com/users/:userId/posts/:postId",
        "https://example.com/users/42/posts/99",
        domain,
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBe(10); // 3+2+3+2
      expect(result.params).toEqual({ userId: "42", postId: "99" });
    });

    it("does not match when URL has too few segments", () => {
      const result = matchUrlPattern(
        "example.com/users/:id",
        "https://example.com/users",
        domain,
      );
      expect(result.matched).toBe(false);
    });
  });

  describe("wildcard matching (**)", () => {
    it("matches everything after **", () => {
      const result = matchUrlPattern(
        "example.com/admin/**",
        "https://example.com/admin/settings/advanced",
        domain,
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBe(3); // only static "admin" scores
    });

    it("matches the root of the wildcard path", () => {
      const result = matchUrlPattern(
        "example.com/admin/**",
        "https://example.com/admin",
        domain,
      );
      expect(result.matched).toBe(true);
    });

    it("does not match non-matching prefix", () => {
      const result = matchUrlPattern(
        "example.com/admin/**",
        "https://example.com/user/settings",
        domain,
      );
      expect(result.matched).toBe(false);
    });
  });

  describe("mixed patterns", () => {
    it("combines static and dynamic segments", () => {
      const result = matchUrlPattern(
        "example.com/api/users/:id",
        "https://example.com/api/users/xyz",
        domain,
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBe(8); // 3 (api) + 3 (users) + 2 (:id)
    });
  });
});

// ---------------------------------------------------------------------------
// rankConfigsByUrl
// ---------------------------------------------------------------------------

describe("rankConfigsByUrl", () => {
  const domain = "example.com";

  it("returns matching configs sorted by specificity (most specific first)", () => {
    const configs = [
      { urlPattern: "example.com", name: "domain-fallback" },
      { urlPattern: "example.com/admin/**", name: "admin-wildcard" },
      { urlPattern: "example.com/admin/settings", name: "admin-settings-exact" },
    ];

    const ranked = rankConfigsByUrl(
      configs,
      "https://example.com/admin/settings",
      domain,
    );

    expect(ranked.map((c) => c.name)).toEqual([
      "admin-settings-exact", // score 6
      "admin-wildcard", // score 3
      "domain-fallback", // score 0
    ]);
  });

  it("filters out non-matching configs", () => {
    const configs = [
      { urlPattern: "example.com/dashboard", name: "dashboard" },
      { urlPattern: "example.com/settings", name: "settings" },
    ];

    const ranked = rankConfigsByUrl(
      configs,
      "https://example.com/dashboard",
      domain,
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].name).toBe("dashboard");
  });

  it("returns empty array when nothing matches", () => {
    const configs = [
      { urlPattern: "example.com/admin", name: "admin" },
    ];

    const ranked = rankConfigsByUrl(
      configs,
      "https://example.com/user/profile",
      domain,
    );

    expect(ranked).toEqual([]);
  });

  it("ranks dynamic segment lower than static segment", () => {
    const configs = [
      { urlPattern: "example.com/users/:id", name: "dynamic" },
      { urlPattern: "example.com/users/me", name: "static" },
    ];

    const ranked = rankConfigsByUrl(
      configs,
      "https://example.com/users/me",
      domain,
    );

    expect(ranked[0].name).toBe("static"); // score 6 vs 5
    expect(ranked[1].name).toBe("dynamic");
  });

  it("domain-only pattern always comes last", () => {
    const configs = [
      { urlPattern: "example.com", name: "fallback" },
      { urlPattern: "example.com/page", name: "specific" },
    ];

    const ranked = rankConfigsByUrl(
      configs,
      "https://example.com/page",
      domain,
    );

    expect(ranked[0].name).toBe("specific");
    expect(ranked[ranked.length - 1].name).toBe("fallback");
  });
});
