import "server-only";

/**
 * Server Actions never return a raw Postgres/PostgREST error message to
 * the client — it can leak schema/policy internals, and it's not
 * something a user can act on anyway. This logs the full error
 * server-side, in development only, so it's still visible while working
 * locally; production returns the same safe message either way but never
 * writes the detail to the server log (nothing here decides what the
 * client sees — the caller still returns its own fixed `{ error }`).
 */
function isPostgrestErrorLike(
  err: unknown,
): err is { code: string; message: string; details: string; hint: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "message" in err &&
    "details" in err &&
    "hint" in err
  );
}

export function logDatabaseErrorInDev(context: string, err: unknown): void {
  if (process.env.NODE_ENV !== "development") return;

  if (isPostgrestErrorLike(err)) {
    console.error(context, {
      code: err.code,
      message: err.message,
      details: err.details,
      hint: err.hint,
    });
  } else {
    console.error(context, err);
  }
}
