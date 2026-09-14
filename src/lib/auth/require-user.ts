import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Every Server Action and protected Server Component calls this first. It
 * is a UX convenience, not the authorization boundary — Postgres RLS is
 * what actually stops a request for someone else's data (see
 * docs/ARCHITECTURE.md §5). This just avoids null-checking `user` in every
 * feature action.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}
