import { describe, expect, it, vi } from "vitest";
import { ACCOUNT_LOCAL_KEYS, accountDeletionNotice, deleteMyAccount, type AccountDeletionClient } from "../accountDeletion";

function setup(rpcResult: { error: { code?: string; message?: string } | null } | Error, signOutResult: { error: unknown } | Error = { error: null }) {
  const rpc = vi.fn(() => rpcResult instanceof Error ? Promise.reject(rpcResult) : Promise.resolve(rpcResult));
  const signOut = vi.fn(() => signOutResult instanceof Error ? Promise.reject(signOutResult) : Promise.resolve(signOutResult));
  const client: AccountDeletionClient = { rpc, auth: { signOut } };
  const values = new Map<string, string>([...ACCOUNT_LOCAL_KEYS.map((key) => [key, "x"] as [string, string]), ["mini-taiwan:locale:v1", "en"]]);
  const storage = { removeItem: vi.fn((key: string) => { values.delete(key); }) };
  return { client, rpc, signOut, storage, values };
}

describe("刪除帳號流程", () => {
  it("成功：呼叫 RPC → 清掉帳號相關 key（保留語系）→ 本地登出", async () => {
    const { client, rpc, signOut, storage, values } = setup({ error: null });
    await expect(deleteMyAccount(client, storage)).resolves.toEqual({ ok: true, signedOut: true });
    expect(rpc).toHaveBeenCalledWith("delete_my_account");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    for (const key of ACCOUNT_LOCAL_KEYS) expect(values.has(key)).toBe(false);
    expect(values.get("mini-taiwan:locale:v1")).toBe("en");
    expect(ACCOUNT_LOCAL_KEYS).toEqual(["pulse:guest-layer-favorites:v1", "pulse-research-auth-v1"]);
  });

  it("站主（42501）：回 owner，不清資料、不登出", async () => {
    const { client, signOut, storage } = setup({ error: { code: "42501", message: "owner account cannot be deleted" } });
    await expect(deleteMyAccount(client, storage)).resolves.toEqual({ ok: false, reason: "owner", detail: "owner account cannot be deleted" });
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("後端尚未部署（PGRST202）與其他錯誤、網路例外都回失敗，不清資料", async () => {
    const missing = setup({ error: { code: "PGRST202", message: "Could not find the function" } });
    expect(await deleteMyAccount(missing.client, missing.storage)).toMatchObject({ ok: false, reason: "unavailable" });
    const other = setup({ error: { code: "P0001", message: "boom" } });
    expect(await deleteMyAccount(other.client, other.storage)).toMatchObject({ ok: false, reason: "failed", detail: "boom" });
    const thrown = setup(new Error("network down"));
    expect(await deleteMyAccount(thrown.client, thrown.storage)).toEqual({ ok: false, reason: "failed", detail: "network down" });
    for (const s of [missing, other, thrown]) { expect(s.storage.removeItem).not.toHaveBeenCalled(); expect(s.signOut).not.toHaveBeenCalled(); }
  });

  it("RPC 成功但登出失敗：仍算已刪除，提示重新整理", async () => {
    const errored = setup({ error: null }, { error: new Error("logout failed") });
    expect(await deleteMyAccount(errored.client, errored.storage)).toEqual({ ok: true, signedOut: false });
    const rejected = setup({ error: null }, new Error("offline"));
    expect(await deleteMyAccount(rejected.client, rejected.storage)).toEqual({ ok: true, signedOut: false });
  });

  it("完成提示 store：設定、通知、清除", () => {
    const listener = vi.fn();
    const unsubscribe = accountDeletionNotice.subscribe(listener);
    accountDeletionNotice.set({ signedOut: true });
    expect(accountDeletionNotice.get()).toEqual({ signedOut: true });
    accountDeletionNotice.clear();
    expect(accountDeletionNotice.get()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
