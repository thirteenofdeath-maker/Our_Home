# Production readiness audit — 2026-09-22

Status: **application and database checks pass; production promotion is waiting for Vercel project access**.

Baseline: the current `ui` branch and its Supabase project. This audit preserves
the two-day Preview implementation; it does not restore or merge the older
`main` UI.

## Fixed and verified

| Finding | Resolution |
| --- | --- |
| Private HTML could be displayed before the server checked the current session | Full-document navigation is network-first; cached pages are offline fallback only. |
| Cache failures or an in-flight request could break a write or restore stale account data | Cache operations fail safely, cache generations prevent race writes, and account changes purge old snapshots. |
| Persistent route cache could outlive the intended user session | Cache is retained across updates/restarts and cleared on explicit logout, rejected sessions, or account identity change. |
| Session-refresh cookies could be lost on redirects | Redirect responses copy refreshed cookies and personalized responses are private/no-store. |
| Password recovery was missing and callback destinations were too permissive | Recovery request/reset flows are implemented and callback destinations are allowlisted. |
| Observer was not consistently read-only | Migration `20260922011522_scoped_observer_read_only` guards 44 household tables, finance RPC writes, and household asset storage. The transactional observer suite passed. |
| Birthday validation used the UTC calendar day | Client, domain, table constraints, and RPCs now use `Asia/Bangkok`; migration `20260922024948_bangkok_birthday_validation` is applied and inspected. |

## Verification results

- Production dependencies: 0 reported vulnerabilities (`npm audit --omit=dev`).
- ESLint: passed.
- TypeScript: passed.
- Automated tests: 795 passed, 146 skipped. The skipped file is the optional
  credential-driven RLS suite; the observer authorization SQL suites were run
  directly against the connected project and passed with rolled-back fixtures.
- Production build: passed; all 48 static pages generated and all application
  routes compiled.
- Public auth pages and protected-route redirects were checked in a desktop
  browser. No application console error or horizontal overflow was observed.
- App icons include favicon, 180 px Apple touch icon, 192/512 px PWA icons and
  maskable artwork. Manifest and service-worker assets are present.
- Cache regression coverage includes offline fallback, server auth recheck,
  logout/fetch races, account switching, invalid warm targets, and unavailable
  Cache Storage.

## Database advisor review

- Two `rls_enabled_no_policy` INFO notices are intentional internal tables:
  `notification_deliveries` and `push_public_config`; neither grants direct
  access to `anon` or `authenticated`.
- Authenticated `SECURITY DEFINER` warnings describe the intentional RPC API.
  Functions were checked for an authenticated identity/authorization boundary;
  the only public-config exception returns non-secret push configuration.
- Performance notices concern per-row auth evaluation, unused indexes in a new
  database, and duplicate profile read policies. They are optimization backlog,
  not correctness or release blockers; indexes should not be removed without
  production query evidence.

## Remaining external blocker

The connected Vercel account still returns no teams and `403 Forbidden` for
project `our-home-preview` under `thirteenofdeath-makers-projects`. Therefore the
production environment, runtime logs, auth redirect allowlist, and final
promotion cannot be verified or changed from this session.

The existing production hostname is the older deployment and must not be used
as evidence that this release was promoted. Reconnect Vercel with access to the
`thirteenofdeath-makers-projects` team, then verify environment variables and
promote the tested `ui` deployment to production.
