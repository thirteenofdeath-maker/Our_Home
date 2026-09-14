import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy` (the
 * `middleware` function name/file is deprecated, not removed — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * This still runs before every matched request, same as middleware did.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sw.js, manifest, icons (PWA/static assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest|icons).*)",
  ],
};
