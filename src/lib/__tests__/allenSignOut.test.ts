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
const OWNER_ID = "c5c835be-fc6c-46bb-b4b7-cb5945f57e7d";

function installSessionStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
  vi.stubGlobal("sessionStorage", storage);
  return { values, storage };
}

function session(userId = OWNER_ID) {
  api.getSession.mockResolvedValue({ data: { session: { access_token: TOKEN, user: { id: userId } } } });
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

  it("沒有 session 時不呼叫 revoke，仍會正常登出", async () => {
    const { storage } = installSessionStorage();
    api.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await signOut();

    expect(api.getSession).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(api.signOut).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledWith(ALLEN_MARKER);
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

  it("新分頁缺少 marker 時，仍以目前 owner session 撤銷 grant", async () => {
    const { storage } = installSessionStorage();
    session();
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

    await signOut();

    expect(fetch).toHaveBeenCalledWith("/api/private-research/allen-coral-atlas/revoke", expect.objectContaining({
      method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store",
    }));
    expect(api.signOut).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledWith(ALLEN_MARKER);
  });

  it("一般使用者不會因 optional Allen sidecar outage 被阻止登出", async () => {
    installSessionStorage({ [ALLEN_MARKER]: "1" });
    session("ordinary-user");

    await signOut();

    expect(fetch).not.toHaveBeenCalled();
    expect(api.signOut).toHaveBeenCalledTimes(1);
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
