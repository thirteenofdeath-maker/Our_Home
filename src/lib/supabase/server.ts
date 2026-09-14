import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

/**
 * Server-side Supabase client for use in Server Components, Server
 * Actions, and Route Handlers. Reads/writes the auth session via Next.js
 * cookies, per the current official @supabase/ssr pattern.
 *
 * `setAll` is wrapped in try/catch because Server Components are allowed to
 * read cookies but not write them — Next.js throws if you attempt a write
 * there. When called from a Server Component this therefore silently no-ops
 * and relies on `middleware.ts` to refresh the session cookie instead.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — no-op, middleware.ts handles
            // session refresh instead.
          }
        },
      },
    },
  );
}
