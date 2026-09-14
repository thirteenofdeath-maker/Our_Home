const fallbackUrl = "https://fgwuaztnctklgktaeqdb.supabase.co";
const fallbackPublishableKey =
  "sb_publishable_oj7so24e97VvTRSOO8o0rg_Rru3o0kS";

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;

export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  fallbackPublishableKey;
