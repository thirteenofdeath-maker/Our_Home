# Production readiness audit — 2026-09-17

Status: **release blocked; do not promote yet**.

Baseline: UI branch d0d2f68413b0d1dd1d789f01834f949331242e13.
This audit preserves the current Preview work; it does not restore the older main branch UI.

## Fixed and tested

| Finding | Fix |
| --- | --- |
| Private HTML could be displayed before the server checked current authentication/permissions | Full-document navigation is network-first; retained cache is offline fallback. Client router prefetch remains enabled. |
| Cache Storage failure could break a successful response, POST, login or logout | Cache operations fail gracefully; network requests and server logout continue. |
| An in-flight fetch could write a stale account response during cache identity change | Recheck the cache generation after asynchronous body/identity reads. |
| Session refresh cookies were lost on proxy redirects | Copy refreshed cookies to redirects and mark personalized responses private/no-store. |
| Failed sign-out was treated as success | Check Supabase signOut error before redirecting. |
| Expired signup/email confirmation linked to password recovery incorrectly | Separate login confirmation errors from recovery errors; reject arbitrary callback destinations. |

## Release blockers

### Observer write permissions

Observer is excluded from family totals and cannot manage memberships. However,
existing shared-data RLS and money RPC checks use is_household_member without
excluding the observer role. Thus observer is not yet consistently read-only
across finance, plans and attachments.

A proposed database guard is in proposals/observer-read-only.sql. It is **not an
active migration** and **has not been applied**. Automatic approval review rejected
the original application because it added SECURITY DEFINER triggers to many
tables plus storage policies, with unverified cross-table impact. A read-only
database query verified private.guard_observer_write() is absent.

Before this proposal may ship, narrow/review its scope, validate against a staging
database with representative finance and background-job flows, and obtain the
required approval. Do not run it indirectly or bypass the rejection.

### Production deployment/configuration access

The Vercel connector returns no teams and returns 403 Forbidden for project
our-home-preview in thirteenofdeath-makers-projects. Vercel CLI reports
loggedIn=false. Therefore production branch/environment settings, auth redirect
allowlists, runtime logs, and promotion permissions could not be verified.

The existing production hostname https://our-home-preview.vercel.app/login returned
HTTP 200. This is the pre-existing site, **not evidence that this release deployed**.
Do not promote via an assumed branch mapping merely to bypass configuration review.

Supabase password-recovery code is covered by mocked API tests; actual email
delivery and the production redirect allowlist still require end-to-end verification.
No test email was sent to a real user.

## Verification

- Production dependency audit: 0 reported vulnerabilities (npm audit --omit=dev).
- Automated tests: 793 passed, 146 skipped; skipped tests are not claimed as verified.
- ESLint: passed.
- Production build and TypeScript compilation: passed.
- Cache regression tests cover offline fallback, online auth recheck, account changes,
  logout/fetch races, invalid warm-route targets, and storage unavailable.
- Recovery callback tests cover allowlisted redirects and expired link routing.

## Deployment decision

Safe application fixes may be reviewed on Preview. Production release remains
blocked by observer authorization and missing Vercel production access.
