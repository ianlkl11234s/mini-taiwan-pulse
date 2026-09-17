import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const researchAuthConfigured = Boolean(url && anonKey);

/** Separate tab-scoped PKCE login: no implicit tokens in URL, no main-app session reuse. */
export const researchAuth = researchAuthConfigured ? createClient(url!, anonKey!, {
  auth: {
    flowType: "pkce",
    storageKey: "pulse-research-auth-v1",
    storage: typeof window === "undefined" ? undefined : window.sessionStorage,
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
  },
}) : null;
