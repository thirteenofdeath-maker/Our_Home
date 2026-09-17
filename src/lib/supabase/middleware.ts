import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

/**
 * Refreshes the Supabase auth session cookie on every request and redirects
 * unauthenticated users away from the protected app shell. Called from the
 * root `proxy.ts` (Next.js 16 renamed the `middleware` file convention to
 * `proxy` — see proxy.ts for the note on that).
 *
 * IMPORTANT (per Supabase SSR guidance): do not add logic between
 * `createServerClient` and `getUser()`, and always return the
 * `supabaseResponse` object as-is (or copy its cookies onto a new
 * response) — returning a differently-constructed response can drop the
 * refreshed session cookie and randomly log users out.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/sign-up") ||
    path.startsWith("/auth") ||
    path === "/forgot-password" ||
    path === "/reset-password";
  const isPublicAsset =
    path.startsWith("/_next") ||
    path.startsWith("/manifest") ||
    path.startsWith("/sw.js") ||
    path.startsWith("/icons") ||
    path.startsWith("/art/") ||
    path === "/icon.svg" ||
    path === "/offline.html" ||
    path === "/favicon.ico";

  const redirectWithCookies = (url: URL) => {
    const response = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll())
      response.cookies.set(cookie);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };

  if (!user && !isAuthRoute && !isPublicAsset) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return redirectWithCookies(url);
  }

  if (user && (path === "/login" || path === "/sign-up")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return redirectWithCookies(url);
  }

  if (!isPublicAsset)
    supabaseResponse.headers.set("Cache-Control", "private, no-store");
  if (user && !isPublicAsset && !isAuthRoute)
    supabaseResponse.headers.set("X-Our-Home-User", user.id);
  return supabaseResponse;
}
