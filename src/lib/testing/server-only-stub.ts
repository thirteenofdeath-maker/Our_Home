// Vitest stand-in for the "server-only" package, aliased in vitest.config.mts.
//
// The real package's only job is to throw if it's ever bundled into a
// client component (Next.js swaps it for a no-op via a "react-server"
// package export condition in its own server bundler). Vitest has no such
// bundler condition, so importing a repository file that starts with
// `import "server-only"` — e.g. features/categories/api.ts — would throw
// immediately in any test, for a reason that has nothing to do with what
// the test is actually checking. Aliasing to this empty module reproduces
// Next's own no-op swap for the test environment only; it has no effect
// on the real Next.js build, which still enforces server-only imports
// exactly as before.
export {};
