import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const researchAuthConfigured = Boolean(url && anonKey);

/**
 * Separate PKCE login: no implicit tokens in URL, no main-app session reuse. Stored in
 * localStorage (P3) so one sign-in covers every tab and survives a restart; agents attach
 * to signed-in tabs without a pairing code. supabase-js coordinates multi-tab refresh.
 */
export const researchAuth = researchAuthConfigured ? createClient(url!, anonKey!, {
  auth: {
    flowType: "pkce",
    storageKey: "pulse-research-auth-v1",
    storage: typeof window === "undefined" ? undefined : window.localStorage,
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
  },
}) : null;
