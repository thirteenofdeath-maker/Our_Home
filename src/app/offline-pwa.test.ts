import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("offline-first PWA foundation", () => {
  it("pre-caches an offline fallback and app assets", () => {
    const worker = read("public/sw.js");
    expect(worker).toContain('const OFFLINE_URL = "/offline.html"');
    expect(worker).toContain("cache.addAll(PRECACHE_URLS)");
    expect(worker).toContain("cacheFirst(request)");
  });

  it("uses network-first private pages without caching sign-in redirects", () => {
    const worker = read("public/sw.js");
    expect(worker).toContain("networkFirstPage(request)");
    expect(worker).toContain("!response.redirected");
    expect(worker).toContain("requestedUrl.pathname === responseUrl.pathname");
  });

  it("keeps private pages in a separately purgeable cache", () => {
    const worker = read("public/sw.js");
    expect(worker).toContain("our-home-private-pages-");
    expect(worker).toContain("CLEAR_PRIVATE_CACHES");
    expect(worker).toContain("caches.delete(PRIVATE_PAGE_CACHE)");
  });

  it("shows connectivity state globally", () => {
    const layout = read("src/app/layout.tsx");
    const status = read("src/app/OfflineStatus.tsx");
    expect(layout).toContain("<OfflineStatus />");
    expect(status).toContain('window.addEventListener("offline"');
    expect(status).toContain('window.addEventListener("online"');
  });
});
