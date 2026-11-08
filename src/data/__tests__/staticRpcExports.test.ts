// 2026-11 不會變的公開資料改讀 CDN 靜態快照（ADR-0026）：loader 讀對檔、不再打 RPC，
// 匯出腳本的分組與前端一致。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) }, supabaseConfigured: true }));

import { WASTE_GROUP_CITIES } from "../../types";
import { fetchWasteScheduleDay, wasteScheduleGroupsFor } from "../wasteScheduleLoader";
import { loadFireEventsByYear, loadFireEventYears } from "../fireLoader";
import { fetchReservoirWatershedRivers } from "../reservoirContextLoader";
import { fetchDataCatalogForLayer } from "../dataCatalogLoader";
import { UPSTREAM_REGISTRY, resolveUpstreamDatasets } from "../upstreamRegistry";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => rpc.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe("匯出腳本與前端一致", () => {
  it("WASTE_GROUPS 與 WASTE_GROUP_CITIES 逐組相同", () => {
    const sh = readFileSync(resolve(__dirname, "../../../scripts/export/export-static-rpc-snapshots.sh"), "utf8");
    const block = sh.slice(sh.indexOf("WASTE_GROUPS=("), sh.indexOf(")", sh.indexOf("WASTE_GROUPS=(")));
    const parsed = Object.fromEntries([...block.matchAll(/"(\w+):([^"]+)"/g)].map((m) => [m[1], m[2]!.split(",")]));
    expect(parsed).toEqual(WASTE_GROUP_CITIES);
  });
});

describe("垃圾車表定", () => {
  it("只讀涵蓋所選城市的分組檔，並濾掉同組其他城市", async () => {
    expect(wasteScheduleGroupsFor(["臺北市", "高雄市"])).toEqual(["TaipeiMetro", "Kaoping"]);
    const route = (city: string) => ({ city, route_id: city, route_name: null, vehicle_type: "garbage", stops: [] });
    const fetchMock = vi.fn((url: string) => Promise.resolve(ok(url.includes("TaipeiMetro") ? [route("臺北市"), route("新北市")] : [route("高雄市"), route("屏東縣")])));
    vi.stubGlobal("fetch", fetchMock);
    const routes = await fetchWasteScheduleDay(["臺北市", "高雄市"], 3);
    expect(fetchMock.mock.calls.map((c) => c[0]).sort()).toEqual([
      "/static-rpc/get_waste_schedule_day_3_Kaoping.json",
      "/static-rpc/get_waste_schedule_day_3_TaipeiMetro.json",
    ]);
    expect(routes.map((r) => r.city).sort()).toEqual(["臺北市", "高雄市"]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("分組檔缺漏時明確失敗（不回退 RPC）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(fetchWasteScheduleDay(["臺北市"], 0)).rejects.toThrow("HTTP 404");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("火災事件", () => {
  it("年份清單與各年事件讀靜態快照", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(ok(url.endsWith("get_fire_event_years.json")
      ? [{ year: 112, n: 1 }]
      : [{ c: "A", t: 1, lng: 121, lat: 25, cn: "臺北市", tw: null, cs: null, d: null, i: 1, m: 1, h: 2, rm: null }])));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadFireEventYears()).resolves.toEqual([{ year: 112, n: 1 }]);
    const ev = await loadFireEventsByYear(112);
    expect(fetchMock).toHaveBeenCalledWith("/static-rpc/get_fire_events_by_year_112.json");
    expect(ev[0]).toMatchObject({ case_id: "A", deaths: 0, injuries: 1 });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("水庫集水區河網", () => {
  it("讀每個 compare_id 一檔；沒有快照（404）視同空河網", async () => {
    const fc = { type: "FeatureCollection", features: [{ type: "Feature", geometry: null, properties: {} }] };
    const fetchMock = vi.fn((url: string) => Promise.resolve(url.endsWith("_10201.json") ? ok(fc) : new Response(null, { status: 404 })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchReservoirWatershedRivers(10201)).resolves.toEqual(fc);
    await expect(fetchReservoirWatershedRivers(99999)).resolves.toEqual({ type: "FeatureCollection", features: [] });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("其他錯誤仍拋出", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(fetchReservoirWatershedRivers(77777)).rejects.toThrow("HTTP 500");
  });
});

describe("資料目錄 pulse_only 血緣", () => {
  it("一次呼叫 get_data_catalog_by_dataset_ids（讀 metadata.data_catalog），不再直讀 public.data_catalog", async () => {
    const key = Object.keys(UPSTREAM_REGISTRY).find((k) => (UPSTREAM_REGISTRY as Record<string, { status?: string }>)[k]?.status === "pulse_only"
      && resolveUpstreamDatasets(k as never).length > 0)!;
    rpc.mockResolvedValue({ data: [{ dataset_id: "x", title: "X" }], error: null });
    const out = await fetchDataCatalogForLayer(key as never);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]![0]).toBe("get_data_catalog_by_dataset_ids");
    expect(Array.isArray((rpc.mock.calls[0]![1] as { p_dataset_ids: unknown }).p_dataset_ids)).toBe(true);
    expect(out[0]).toMatchObject({ datasetId: "x", title: "X" });
  });

  it("RPC 尚未套用時回空陣列", async () => {
    const key = Object.keys(UPSTREAM_REGISTRY).find((k) => (UPSTREAM_REGISTRY as Record<string, { status?: string }>)[k]?.status === "pulse_only"
      && resolveUpstreamDatasets(k as never).length > 0)!;
    rpc.mockResolvedValue({ data: null, error: { message: "Could not find the function" } });
    await expect(fetchDataCatalogForLayer(key as never)).resolves.toEqual([]);
  });
});
