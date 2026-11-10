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
import { loadH3DemographicsYearly, loadH3DemographicsYears } from "../h3Loader";
import { callWhitelistedRpc } from "../../chat/tools/rpcTools";
import { fetchLandSubsidenceTimeseries, landSubsidenceStationFileId } from "../landSubsidenceLoader";
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

describe("地層下陷單站時序", () => {
  it("站號以 UTF-8 hex 當檔名，讀靜態快照、不打 RPC", async () => {
    expect(landSubsidenceStationFileId("deep_pile:BM_NTUH(1)")).toBe("646565705f70696c653a424d5f4e545548283129");
    const fetchMock = vi.fn((_url: string) => Promise.resolve(ok([
      { bucket_start: "2020-01-01", depth_layer_m: "3", value: "1.5", n: 2, value_kind: "ring_compression_mm" },
    ])));
    vi.stubGlobal("fetch", fetchMock);
    const rows = await fetchLandSubsidenceTimeseries("mag_ring:TEST(1)");
    expect(fetchMock.mock.calls[0]![0]).toBe(`/static-rpc/get_land_subsidence_timeseries_${landSubsidenceStationFileId("mag_ring:TEST(1)")}.json`);
    expect(rows).toEqual([{ bucket_start: "2020-01-01", depth_layer_m: 3, value: 1.5, n: 2, value_kind: "ring_compression_mm" }]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("缺檔明確失敗", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(fetchLandSubsidenceTimeseries("gnss:MISSING")).rejects.toThrow("HTTP 404");
  });
});

describe("H3 年度人口", () => {
  it("年份清單與（年, 解析度）讀靜態快照、不打 RPC", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(ok(url.endsWith("get_h3_demographics_years.json")
      ? [{ year: 107, resolution: 8, cell_count: 1 }]
      : [{ h3_index: "88abc", population: 10 }])));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadH3DemographicsYears()).resolves.toEqual([{ year: 107, resolution: 8, cell_count: 1 }]);
    const cells = await loadH3DemographicsYearly(107, 8);
    expect(cells).toHaveLength(1);
    expect(fetchMock.mock.calls.map((c) => c[0])).toContain("/static-rpc/get_h3_demographics_yearly_107_r8.json");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("沒有該年／解析度（404）回空陣列", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(loadH3DemographicsYearly(113, 8)).resolves.toEqual([]);
  });

  it("chat 白名單改讀快照，404 當空結果", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(url.includes("_112_r7") ? ok([{ h3_index: "87a" }]) : new Response(null, { status: 404 })));
    vi.stubGlobal("fetch", fetchMock);
    const hit = await callWhitelistedRpc("get_h3_demographics_yearly", { target_year: 112 });
    expect(hit.ok).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toBe("/static-rpc/get_h3_demographics_yearly_112_r7.json");
    const miss = await callWhitelistedRpc("get_h3_demographics_yearly", { target_year: 113, target_resolution: 8 });
    expect(miss.ok).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });
});
