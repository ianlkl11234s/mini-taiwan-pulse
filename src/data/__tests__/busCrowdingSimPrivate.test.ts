import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { BUS_CROWDING_SIM_ASSETS } from "../busCrowdingSimAssets";
import {
  BUS_CROWDING_SIM_PRIVATE_ENDPOINT, clearBusCrowdingSimCache, fetchBusCrowdingPrivateJson, isBusCrowdingAccessDenied,
  loadBusCrowdingReplayTrips, loadBusCrowdingScenario, type BusCrowdingSimAuth,
} from "../busCrowdingSimLoader";
import { BUS_CROWDING_SCENARIOS, BUS_CROWDING_VERSIONS } from "../busCrowdingSimTypes";
import { LAYER_MANIFEST } from "../layerManifest";

const here = path.dirname(fileURLToPath(import.meta.url));
const auth = (userId = "owner"): BusCrowdingSimAuth => ({ userId, token: async () => `token-${userId}` });
const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

/** 依資產 size 回 206；body 長度刻意對齊 size（不足補空白，JSON.parse 容許尾端空白）。 */
function fakeSidecar(bodies: Partial<Record<string, unknown>>, status = 206) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const name = url.slice(BUS_CROWDING_SIM_PRIVATE_ENDPOINT.length + 1) as keyof typeof BUS_CROWDING_SIM_ASSETS;
    const size = BUS_CROWDING_SIM_ASSETS[name].size;
    const json = bytesOf(bodies[name] ?? {});
    const body = new Uint8Array(size).fill(0x20);
    body.set(json.subarray(0, size));
    return new Response(status === 206 ? body : null, { status });
  });
  return { calls, fetchFn };
}

describe("公車擁擠模擬私人資產契約", () => {
  it("前端與 sidecar 白名單逐一相同（檔名、大小、sha256）", () => {
    const server = fs.readFileSync(path.resolve(here, "../../../server/coral-private/bus-crowding-assets.mjs"), "utf8");
    const rows = [...server.matchAll(/"([^"]+)": Object\.freeze\(\{ filename: "([^"]+)", size: (\d+), sha256: "([0-9a-f]{64})" \}\)/g)]
      .map((m) => [m[1], { filename: m[2], size: Number(m[3]), sha256: m[4] }]);
    expect(Object.fromEntries(rows)).toEqual(BUS_CROWDING_SIM_ASSETS);
  });

  it("每個版本×方案都有數值檔與回放檔；meta.json 不在白名單", () => {
    const expected = ["segments", "lines", ...BUS_CROWDING_VERSIONS.flatMap((v) => BUS_CROWDING_SCENARIOS.flatMap((s) => [`${v}-${s}`, `${v}-trips-${s}`]))];
    expect(Object.keys(BUS_CROWDING_SIM_ASSETS).sort()).toEqual(expected.sort());
    expect(Object.values(BUS_CROWDING_SIM_ASSETS).map((a) => a.filename)).not.toContain("meta.json");
    for (const a of Object.values(BUS_CROWDING_SIM_ASSETS)) expect(a.size).toBeLessThanOrEqual(8 * 1024 * 1024);
  });

  it("manifest 只登記私人資產，不再指向 public/sim", () => {
    const source = LAYER_MANIFEST.busCrowdingSim.source;
    expect(source.kind).toBe("custom");
    const assets = source.kind === "custom" ? source.staticAssets ?? [] : [];
    expect(assets).toHaveLength(34);
    for (const a of assets) expect(a).toMatch(/^PRIVATE_OWNER_ONLY: /);
    expect(JSON.stringify(source)).not.toContain("public/sim");
  });

  it("public/ 底下沒有公車擁擠資料（dev 任何人可讀、build 會複製進 dist）", () => {
    expect(fs.existsSync(path.resolve(here, "../../../public/sim"))).toBe(false);
  });
});

describe("公車擁擠模擬私人讀取", () => {
  it("每個請求帶 Bearer 與整段 Range、不快取 HTTP", async () => {
    const { calls, fetchFn } = fakeSidecar({ segments: { type: "FeatureCollection", features: [] } });
    const fc = await fetchBusCrowdingPrivateJson("segments", auth(), fetchFn);
    expect(fc).toEqual({ type: "FeatureCollection", features: [] });
    expect(calls[0]!.url).toBe(`${BUS_CROWDING_SIM_PRIVATE_ENDPOINT}/segments`);
    const headers = calls[0]!.init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-owner");
    expect(headers.Range).toBe(`bytes=0-${BUS_CROWDING_SIM_ASSETS.segments.size - 1}`);
    expect(calls[0]!.init!.cache).toBe("no-store");
  });

  it("401／403 丟出帶 status 的錯誤（呼叫端據此鎖回），其他狀態是一般錯誤", async () => {
    for (const status of [401, 403]) {
      const error = await fetchBusCrowdingPrivateJson("lines", auth(), fakeSidecar({}, status).fetchFn).catch((e: unknown) => e);
      expect(isBusCrowdingAccessDenied(error)).toBe(true);
    }
    const unavailable = await fetchBusCrowdingPrivateJson("lines", auth(), fakeSidecar({}, 503).fetchFn).catch((e: unknown) => e);
    expect(isBusCrowdingAccessDenied(unavailable)).toBe(false);
    expect(String(unavailable)).toContain("HTTP 503");
  });

  it("長度不符就失敗，不解析半截資料", async () => {
    const fetchFn = async () => new Response(new Uint8Array(4), { status: 206 });
    await expect(fetchBusCrowdingPrivateJson("lines", auth(), fetchFn)).rejects.toThrow("長度不符");
  });

  it("方案數值兩版一起抓；快取依帳號分開，clear 後重抓", async () => {
    clearBusCrowdingSimCache();
    const values = { ov: [0.1], n: [6] };
    const { calls, fetchFn } = fakeSidecar({ "v137-s1_307_headway": values, "v180-s1_307_headway": values });
    const a = await loadBusCrowdingScenario("s1_307_headway", auth("a"), fetchFn);
    expect(a.values.v137).toEqual(values);
    expect(calls.map((c) => c.url.split("/").pop()).sort()).toEqual(["v137-s1_307_headway", "v180-s1_307_headway"]);
    await loadBusCrowdingScenario("s1_307_headway", auth("a"), fetchFn);
    expect(calls).toHaveLength(2);
    await loadBusCrowdingScenario("s1_307_headway", auth("b"), fetchFn);
    expect(calls).toHaveLength(4);
    clearBusCrowdingSimCache();
    await loadBusCrowdingScenario("s1_307_headway", auth("a"), fetchFn);
    expect(calls).toHaveLength(6);
  });

  it("回放班次＝基準 trips＋方案 diff（私人 key v180-trips-*）", async () => {
    clearBusCrowdingSimCache();
    const trip = (id: string) => ({ id, l: 1, t: [25200, 25300], c: "01", q: [0, 1] });
    const { calls, fetchFn } = fakeSidecar({
      "v180-trips-base": { trips: [trip("a"), trip("b")] },
      "v180-trips-s4_307_regular": { removed: ["a"], changed: [trip("c")] },
    });
    const trips = await loadBusCrowdingReplayTrips("v180", "s4_307_regular", auth(), fetchFn);
    expect(trips.map((t) => t.id)).toEqual(["b", "c"]);
    expect(calls.map((c) => c.url.split("/").pop())).toEqual(["v180-trips-base", "v180-trips-s4_307_regular"]);
  });
});
