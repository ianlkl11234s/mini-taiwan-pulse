import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("../supabase", () => ({ supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })) } } }));

import { OWNER_DATA_ASSETS, OWNER_DATA_ENDPOINT, type OwnerDataAssetName } from "../../data/ownerDataAssets";
import { fetchOwnerJson, ownerDataStatus, readOwnerJson } from "../ownerData";
import { isAccessDenied } from "../layerGates";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");

/** 依資產 size 回 206；body 長度對齊 size（不足補空白，JSON.parse 容許尾端空白）。 */
function fakeSidecar(asset: OwnerDataAssetName, value: unknown, status = 206) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const size = OWNER_DATA_ASSETS[asset].size;
  const json = new TextEncoder().encode(JSON.stringify(value));
  const full = new Uint8Array(size).fill(0x20);
  full.set(json.subarray(0, size));
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (status !== 206) return new Response(null, { status });
    const m = /bytes=(\d+)-(\d+)/.exec(new Headers(init?.headers).get("Range") ?? "")!;
    return new Response(full.slice(Number(m[1]), Number(m[2]) + 1), { status: 206 });
  });
  return { calls, fetchFn };
}

describe("owner-data 私人資產契約", () => {
  it("前端與 sidecar 白名單逐一相同（檔名、大小、sha256）", () => {
    const server = fs.readFileSync(path.join(root, "server/coral-private/owner-data-assets.mjs"), "utf8");
    const rows = [...server.matchAll(/"([^"]+)": Object\.freeze\(\{ filename: "([^"]+)", size: (\d+), sha256: "([0-9a-f]{64})" \}\)/g)]
      .map((m) => [m[1], { filename: m[2], size: Number(m[3]), sha256: m[4] }]);
    expect(Object.fromEntries(rows)).toEqual(OWNER_DATA_ASSETS);
  });

  it("key 只用小寫英數與連字號（Caddy／nginx 正規式與 sidecar 白名單一致的前提）", () => {
    for (const key of Object.keys(OWNER_DATA_ASSETS)) expect(key).toMatch(/^[a-z0-9-]+$/);
  });

  it("畜牧 loader 不再呼叫 Supabase RPC", () => {
    const loader = fs.readFileSync(path.join(root, "src/data/livestockLoader.ts"), "utf8");
    expect(loader).not.toMatch(/supabase\.rpc|lib\/supabase/);
    expect(loader).toContain('fetchOwnerJson<GeoJSON.FeatureCollection>("livestock-farms"');
    expect(loader).toContain('fetchOwnerJson<GeoJSON.FeatureCollection>("livestock-slaughterhouses"');
  });
});

describe("readOwnerJson／fetchOwnerJson", () => {
  const fc = { type: "FeatureCollection", features: [{ type: "Feature", geometry: null, properties: { 場名: "x" } }] };

  it("帶 Bearer token 與 Range 讀同源端點，回傳原形狀", async () => {
    const { calls, fetchFn } = fakeSidecar("livestock-slaughterhouses", fc);
    const out = await readOwnerJson("livestock-slaughterhouses", { fetchFn, token: async () => "tok" });
    expect(out).toEqual(fc);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${OWNER_DATA_ENDPOINT}/livestock-slaughterhouses`);
    const h = new Headers(calls[0]!.init?.headers);
    expect(h.get("Authorization")).toBe("Bearer tok");
    expect(h.get("Range")).toBe(`bytes=0-${OWNER_DATA_ASSETS["livestock-slaughterhouses"].size - 1}`);
    expect(calls[0]!.init?.cache).toBe("no-store");
  });

  it("沒有登入 → 401，視為 access denied（hook 靜默），狀態不記成失敗", async () => {
    const fetchFn = vi.fn();
    const err = await fetchOwnerJson("livestock-farms", "livestock:farms", "x", { fetchFn }).catch((e: unknown) => e);
    expect(isAccessDenied(err)).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(ownerDataStatus.get("livestock-farms")).toEqual({ state: "idle" });
  });

  it("sidecar 401／403 → access denied", async () => {
    for (const status of [401, 403]) {
      const { fetchFn } = fakeSidecar("livestock-farms", fc, status);
      const err = await readOwnerJson("livestock-farms", { fetchFn, token: async () => "tok" }).catch((e: unknown) => e);
      expect(isAccessDenied(err)).toBe(true);
    }
  });

  it("其他錯誤寫進狀態給圖例顯示原因；成功後回 ready", async () => {
    const bad = fakeSidecar("livestock-farms", fc, 502);
    await expect(fetchOwnerJson("livestock-farms", "livestock:farms", "x", { fetchFn: bad.fetchFn, token: async () => "tok" })).rejects.toThrow("HTTP 502");
    expect(ownerDataStatus.get("livestock-farms")).toEqual({ state: "error", error: "HTTP 502" });
    const ok = fakeSidecar("livestock-farms", fc);
    await fetchOwnerJson("livestock-farms", "livestock:farms", "x", { fetchFn: ok.fetchFn, token: async () => "tok" });
    expect(ownerDataStatus.get("livestock-farms")).toEqual({ state: "ready" });
    ownerDataStatus.reset("livestock-farms");
    expect(ownerDataStatus.get("livestock-farms")).toEqual({ state: "idle" });
  });

  it("回應長度不符就中止，不合成資料", async () => {
    const fetchFn = vi.fn(async () => new Response(new Uint8Array(3), { status: 206 }));
    await expect(readOwnerJson("livestock-farms", { fetchFn, token: async () => "tok" })).rejects.toThrow("長度不符");
  });
});
