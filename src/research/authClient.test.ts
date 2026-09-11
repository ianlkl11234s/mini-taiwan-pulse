import { afterEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); createClient.mockClear(); });

describe("researchAuth", () => {
  it("uses a dedicated sessionStorage PKCE client with only the anon key", async () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("window", { sessionStorage: storage });
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key-only");
    const auth = await import("./authClient");
    expect(auth.researchAuthConfigured).toBe(true);
    expect(createClient).toHaveBeenCalledWith("https://project.supabase.co", "anon-key-only", expect.objectContaining({ auth: expect.objectContaining({ flowType: "pkce", storageKey: "pulse-research-auth-v1", storage, persistSession: true, detectSessionInUrl: true, autoRefreshToken: true }) }));
    const [, configuredKey] = (createClient.mock.calls[0] ?? []) as unknown[];
    expect(configuredKey).not.toMatch(/service_role|admin/i);
  });
});
