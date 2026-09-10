import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Next.js swaps the real "server-only" package for a no-op at build
      // time via a bundler condition; Vitest has no such condition, so
      // any test that imports a repository file starting with
      // `import "server-only"` needs the same swap here. See
      // src/lib/testing/server-only-stub.ts for the full explanation.
      "server-only": path.resolve(import.meta.dirname, "./src/lib/testing/server-only-stub.ts"),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
