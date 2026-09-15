import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../supabase", () => ({
  supabase: { auth: { getSession: api.getSession, signOut: api.signOut } },
}));

import { signOut } from "../auth";

const ALLEN_MARKER = "allen-private-session-active";
const TOKEN = "owner-token";

function installSessionStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
  vi.stubGlobal("sessionStorage", storage);
  return { values, storage };
}

function session() {
  api.getSession.mockResolvedValue({ data: { session: { access_token: TOKEN } } });
}

describe("Allen private grant sign-out", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", false);
    api.getSession.mockReset();
    api.signOut.mockReset().mockResolvedValue({ error: null });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("無 Allen marker 時沿用正常 Supabase logout", async () => {
    const { storage } = installSessionStorage();

    await signOut();

    expect(api.getSession).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(api.signOut).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("revoke 成功後才登出並清除 marker", async () => {
    const order: string[] = [];
    const { values, storage } = installSessionStorage({ [ALLEN_MARKER]: "1" });
    session();
    vi.mocked(fetch).mockImplementation(async () => {
      order.push("revoke");
      return { ok: true, status: 204 } as Response;
    });
    api.signOut.mockImplementation(async () => {
      order.push("signOut");
      return { error: null };
    });

    await signOut();

    expect(fetch).toHaveBeenCalledWith("/api/private-research/allen-coral-atlas/revoke", expect.objectContaining({
      method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store",
    }));
    expect(order).toEqual(["revoke", "signOut"]);
    expect(storage.removeItem).toHaveBeenCalledWith(ALLEN_MARKER);
    expect(values.has(ALLEN_MARKER)).toBe(false);
  });

  it.each([
    ["503", async () => ({ ok: false, status: 503 } as Response)],
    ["timeout", async () => { throw new DOMException("timed out", "TimeoutError"); }],
  ])("%s 時拒絕登出且保留 marker", async (_case, response) => {
    const { values, storage } = installSessionStorage({ [ALLEN_MARKER]: "1" });
    session();
    vi.mocked(fetch).mockImplementation(response);

    await expect(signOut()).rejects.toThrow("私人資料服務無法確認撤銷");

    expect(api.signOut).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(values.get(ALLEN_MARKER)).toBe("1");
  });

  it.each([401, 403])("已被拒絕的 revoke HTTP %s 視為完成，清 marker 後登出", async (status) => {
    const { values, storage } = installSessionStorage({ [ALLEN_MARKER]: "1" });
    session();
    vi.mocked(fetch).mockResolvedValue({ ok: false, status } as Response);

    await signOut();

    expect(api.signOut).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledWith(ALLEN_MARKER);
    expect(values.has(ALLEN_MARKER)).toBe(false);
  });
});
