import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const stores = new Map<string, Map<string, Response>>();
  const listeners: Record<
    string,
    (event: { waitUntil: (promise: Promise<void>) => void }) => void
  > = {};
  const key = (value: Request | URL | string) =>
    value instanceof Request
      ? value.url
      : new URL(String(value), "https://home.test").href;
  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        match: async (request: Request | URL | string) =>
          store.get(key(request))?.clone(),
        put: async (request: Request | URL | string, response: Response) => {
          store.set(key(request), response.clone());
        },
        addAll: async () => undefined,
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    async match(request: Request | URL | string) {
      for (const store of stores.values())
        if (store.has(key(request))) return store.get(key(request))!.clone();
    },
  };
  const response = (url: string, body: string, owner = "user-a") => {
    const result = new Response(body, {
      headers: { "content-type": "text/html", "X-Our-Home-User": owner },
    });
    Object.defineProperty(result, "url", { value: url });
    return result;
  };
  const fetch = vi.fn(async (request: Request) =>
    response(request.url, "fresh"),
  );
  const context = vm.createContext({
    self: {
      location: { origin: "https://home.test" },
      addEventListener: (
        name: string,
        callback: (event: {
          waitUntil: (promise: Promise<void>) => void;
        }) => void,
      ) => {
        listeners[name] = callback;
      },
      clients: { claim: async () => undefined },
    },
    caches,
    fetch,
    Request,
    Response,
    Headers,
    URL,
    crypto: webcrypto,
  });
  vm.runInContext(
    readFileSync("public/sw.js", "utf8") +
      "\n globalThis.testApi = { fetchAndCachePrivatePage, cacheFirstMainPage, clearPrivateCaches, warmMainAppRoutes };",
    context,
  );
  return { stores, caches, fetch, response, listeners, api: context.testApi };
}

describe("persistent private page cache", () => {
  it("keeps pages during service-worker activation", async () => {
    const w = worker();
    await w.api.fetchAndCachePrivatePage(
      new Request("https://home.test/wallets"),
    );
    await new Promise<void>((resolve) =>
      w.listeners.activate({
        waitUntil: async (promise: Promise<void>) => {
          await promise;
          resolve();
        },
      }),
    );
    expect(await w.caches.match("https://home.test/wallets")).toBeDefined();
  });
  it("serves a cached detail page immediately and revalidates in background", async () => {
    const w = worker();
    const request = new Request("https://home.test/pets/123");
    await w.api.fetchAndCachePrivatePage(request);
    w.fetch.mockImplementation(async () => {
      throw new Error("offline");
    });
    const response = await w.api.cacheFirstMainPage(
      { waitUntil: () => undefined },
      request,
    );
    expect(await response.text()).toBe("fresh");
  });
  it("does not resurrect a private page from an in-flight request after logout", async () => {
    const w = worker();
    let finish!: (response: Response) => void;
    w.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = w.api.fetchAndCachePrivatePage(
      new Request("https://home.test/finance"),
    );
    await vi.waitFor(() => expect(finish).toBeDefined());
    await w.api.clearPrivateCaches();
    finish(w.response("https://home.test/finance", "old account"));
    await pending;
    expect(await w.caches.match("https://home.test/finance")).toBeUndefined();
  });
  it("replaces cached pages when the authenticated identity changes", async () => {
    const w = worker();
    await w.api.fetchAndCachePrivatePage(
      new Request("https://home.test/wallets"),
    );
    w.fetch.mockImplementation(async (request: Request) =>
      w.response(request.url, "new account", "user-b"),
    );
    await w.api.fetchAndCachePrivatePage(
      new Request("https://home.test/household"),
    );
    expect(await w.caches.match("https://home.test/wallets")).toBeUndefined();
    expect(
      await (await w.caches.match("https://home.test/household"))?.text(),
    ).toBe("new account");
  });
  it("warms nested app routes but rejects external and authentication pages", async () => {
    const w = worker();
    await w.api.warmMainAppRoutes([
      "/wallets",
      "/pets/123",
      "//evil.test/finance",
      "/login",
    ]);
    expect(w.fetch.mock.calls.map(([request]) => request.url)).toEqual([
      "https://home.test/wallets",
      "https://home.test/pets/123",
    ]);
  });
});
