import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) }, supabaseConfigured: true }));

import {
  clearPollingHeatCache,
  clearPollingSnapshotCache,
  clearPollingStationsCache,
  fetchPollingHeat,
  fetchPollingStations,
  normalizePollingHeat,
  isMissingPollingRpc,
  normalizePollingStations,
  pollingBoundsKey,
  pollingSnapshotToBbox,
  snapPollingBounds,
} from "../pollingStationsLoader";
import { POLLING_COLOR_MODES, POLLING_HEAT_ELECTORS_UNIT, POLLING_HEAT_VOTES_UNIT, pollingHeatRamp, pollingLead } from "../pollingStationsTypes";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { formatPartyVotes } from "../../components/featureInfo/politicsPanels";
import { LAYER_PARAMS_SPEC } from "../layerParamsSpec";

// RPC 回傳形狀（gis-platform mig 495 get_polling_stations_2024）的最小 fixture
const RAW = {
  type: "FeatureCollection",
  meta: { total: 17795, mapped: 15626, in_bbox: 3135, truncated: true, loaded_at: "2026-11-03T03:18:05+00:00" },
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [121.5446, 25.0330] },
      properties: {
        county: "臺北市", town: "大安區", village: "仁慈里", station_no: "0401", name: "仁愛國小",
        address: "臺北市大安區仁愛路四段99號", precision: "poi_name",
        pres24_electors: 1200, pres24_votes: 900, pres24_valid: 890, pres24_turnout: 75.0,
        pres24_dpp_votes: 300, pres24_dpp_pct: 33.71, pres24_kmt_votes: 450, pres24_kmt_pct: 50.56,
        pres24_tpp_votes: 140, pres24_tpp_pct: 15.73,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [120.3, 22.6] },
      properties: {
        county: "高雄市", town: "苓雅區", station_no: "0100", name: "某里活動中心", precision: "road",
        pres24_dpp_votes: 200, pres24_kmt_votes: 200, pres24_tpp_votes: 50, pres24_turnout: null,
      },
    },
    { type: "Feature", geometry: null, properties: { county: "連江縣", station_no: "0001" } },
  ],
};

// CDN 快照形狀（export-static-rpc-snapshots.sh @polling）的最小 fixture
const SNAP = {
  meta: { total: 17795, mapped: 2, loaded_at: "2026-11-03T03:18:05+00:00" },
  cols: ["lng", "lat", "county", "town", "village", "station_no", "name", "address", "precision",
    "pres24_electors", "pres24_votes", "pres24_valid", "pres24_turnout",
    "pres24_dpp_votes", "pres24_dpp_pct", "pres24_kmt_votes", "pres24_kmt_pct", "pres24_tpp_votes", "pres24_tpp_pct"],
  rows: [
    [121.5446, 25.033, "臺北市", "大安區", "仁慈里", "0401", "仁愛國小", "臺北市大安區仁愛路四段99號", "poi_name",
      1200, 900, 890, 75.0, 300, 33.71, 450, 50.56, 140, 15.73],
    [120.3, 22.6, "高雄市", "前鎮區", "", "0001", "某國小", "", "poi_name", 800, null, null, null, null, null, null, null, null, null],
  ],
};

describe("pollingStations loader", () => {
  beforeEach(() => {
    rpc.mockReset();
    clearPollingStationsCache();
    clearPollingHeatCache();
    clearPollingSnapshotCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("normalize：衍生 lead、缺投票率給 -1、跳過非 Point、meta 轉 camelCase", () => {
    const d = normalizePollingStations(RAW);
    expect(d.fc.features).toHaveLength(2);
    expect(d.fc.features[0]!.properties!.lead).toBe("kmt");
    expect(d.fc.features[1]!.properties!.lead).toBe("tie");
    expect(d.fc.features[1]!.properties!.pres24_turnout).toBe(-1);
    expect(d.meta).toEqual({ total: 17795, mapped: 15626, inBbox: 3135, truncated: true, loadedAt: "2026-11-03T03:18:05+00:00" });
    expect(normalizePollingStations(null).meta.truncated).toBe(false);
  });

  it("pollingLead：單一最高票、同票、全缺值", () => {
    expect(pollingLead({ pres24_dpp_votes: 5, pres24_kmt_votes: 3, pres24_tpp_votes: 1 })).toBe("dpp");
    expect(pollingLead({ pres24_dpp_votes: "2", pres24_kmt_votes: 3, pres24_tpp_votes: 9 })).toBe("tpp");
    expect(pollingLead({ pres24_dpp_votes: 3, pres24_kmt_votes: 3, pres24_tpp_votes: 1 })).toBe("tie");
    expect(pollingLead({})).toBe("tie");
  });

  it("bbox 向外對齊 0.02° 格網；小幅平移同一快取鍵", () => {
    const a = snapPollingBounds({ west: 121.501, south: 25.011, east: 121.559, north: 25.049 });
    expect(a).toEqual({ west: 121.5, south: 25.0, east: 121.56, north: 25.06 });
    const b = snapPollingBounds({ west: 121.505, south: 25.015, east: 121.555, north: 25.045 });
    expect(pollingBoundsKey(a)).toBe(pollingBoundsKey(b));
  });

  it("fetch：讀全臺快照、前端依對齊後 bbox 篩選；同鍵第二次走快取、快照只抓一次", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(SNAP), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const ctrl = new AbortController();
    const d1 = await fetchPollingStations({ west: 121.501, south: 25.011, east: 121.559, north: 25.049 }, ctrl.signal);
    expect(fetchMock).toHaveBeenCalledWith("/static-rpc/polling_stations_2024.json");
    expect(d1.fc.features).toHaveLength(1);
    expect(d1.fc.features[0]!.properties).toMatchObject({ name: "仁愛國小", lead: "kmt", pres24_electors: 1200 });
    expect(d1.meta).toEqual({ total: 17795, mapped: 2, inBbox: 1, truncated: false, loadedAt: "2026-11-03T03:18:05+00:00" });
    const d2 = await fetchPollingStations({ west: 121.505, south: 25.015, east: 121.555, north: 25.045 });
    expect(d2).toBe(d1);
    await fetchPollingStations({ west: 120, south: 22, east: 121, north: 23 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("bbox 篩選：超過上限等距取樣並標 truncated", () => {
    const rows = Array.from({ length: 10 }, (_, k) => [121 + k * 0.001, 25, "臺北市", "", "", String(k)]);
    const out = pollingSnapshotToBbox({ meta: { total: 10, mapped: 10 }, cols: ["lng", "lat", "county", "town", "village", "station_no"], rows }, { west: 120, south: 24, east: 122, north: 26 }, 4) as { meta: Record<string, unknown>; features: GeoJSON.Feature[] };
    expect(out.features).toHaveLength(4);
    expect(out.meta).toMatchObject({ in_bbox: 10, truncated: true });
    expect(out.features.map((f) => f.properties!.station_no)).toEqual(["0", "2", "5", "7"]);
  });

  it("fetch：快照未部署（404）時拋出可辨識的錯誤", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(fetchPollingStations({ west: 121, south: 25, east: 121.1, north: 25.1 })).rejects.toSatisfy(isMissingPollingRpc);
  });

  it("popup 票數格式：票數（得票率%），缺值回空", () => {
    const fmt = (n: number, o?: Intl.NumberFormatOptions) => new Intl.NumberFormat("zh-TW", o).format(n);
    expect(formatPartyVotes(1234, 41.9, fmt)).toBe("1,234（41.90%）");
    expect(formatPartyVotes(12, null, fmt)).toBe("12");
    expect(formatPartyVotes(null, 10, fmt)).toBe("");
  });

  it("著色 select 的 encode 與 POLLING_COLOR_MODES 逐位相同（idx 0＝領先政黨）", () => {
    const spec = LAYER_PARAMS_SPEC.pollingStations2024.find((s) => s.name === "pollingStations2024ColorBy");
    expect(spec && "encode" in spec ? spec.encode : null).toEqual([...POLLING_COLOR_MODES]);
    expect(POLLING_COLOR_MODES[0]).toBe("lead");
    expect(POLLING_COLOR_MODES[1]).toBe("turnout");
  });

  it("中性 append 在 idx 2；選單中性排第一且為預設", () => {
    const spec = LAYER_PARAMS_SPEC.pollingStations2024.find((s) => s.name === "pollingStations2024ColorBy");
    expect(POLLING_COLOR_MODES.indexOf("neutral")).toBe(2);
    expect(spec && "encode" in spec ? spec.encode?.indexOf("neutral") : null).toBe(2);
    expect(spec?.default).toBe("neutral");
    expect(spec && "options" in spec ? spec.options?.[0]?.value : null).toBe("neutral");
  });

  it("heat 解析：cols＋rows → Point，權重先除好、null 權重 0、壞列跳過", () => {
    const d = normalizePollingHeat({
      meta: { count: 3, loaded_at: "2026-11-03T10:00:00+00:00" },
      cols: ["lng", "lat", "electors", "dpp", "kmt", "tpp"],
      rows: [[121.75361, 24.75432, 1057, 313, 264, 170], [120.1, 23.1, 800, null, null, null], [null, 23, 1, 1, 1, 1], "bad"],
    });
    expect(d.fc.features).toHaveLength(2);
    expect(d.fc.features[0]!.geometry.coordinates).toEqual([121.75361, 24.75432]);
    // 每所只進領先政黨那一層（313 票的民進黨），其他兩層 0
    expect(d.fc.features[0]!.properties).toEqual({
      w_electors: 1057 / POLLING_HEAT_ELECTORS_UNIT,
      w_dpp: 313 / POLLING_HEAT_VOTES_UNIT, w_kmt: 0, w_tpp: 0,
    });
    expect(d.fc.features[1]!.properties).toMatchObject({ w_dpp: 0, w_kmt: 0, w_tpp: 0 });
    expect(d.count).toBe(3);
    // 欄位順序以 cols 為準
    const r = normalizePollingHeat({ cols: ["lat", "lng", "tpp"], rows: [[25, 121, 50]] });
    expect(r.fc.features[0]!.geometry.coordinates).toEqual([121, 25]);
    expect(r.fc.features[0]!.properties).toMatchObject({ w_electors: 0, w_tpp: 50 / POLLING_HEAT_VOTES_UNIT, w_dpp: 0 });
    expect(normalizePollingHeat(null).fc.features).toHaveLength(0);
    // 同票：三層都不計
    const tie = normalizePollingHeat({ cols: ["lng", "lat", "dpp", "kmt", "tpp"], rows: [[121, 25, 300, 300, 100]] });
    expect(tie.fc.features[0]!.properties).toMatchObject({ w_dpp: 0, w_kmt: 0, w_tpp: 0 });
  });

  it("heat fetch：與點位共用全臺快照；session 內只抓一次；失敗不快取", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValue(new Response(JSON.stringify(SNAP), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPollingHeat()).rejects.toThrow("HTTP 500");
    const a = await fetchPollingHeat();
    const b = await fetchPollingHeat();
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(a.count).toBe(2);
    expect(a.fc.features[0]!.properties).toEqual({
      w_electors: 1200 / POLLING_HEAT_ELECTORS_UNIT, w_dpp: 0, w_kmt: 450 / POLLING_HEAT_VOTES_UNIT, w_tpp: 0,
    });
    await fetchPollingStations({ west: 121, south: 25, east: 121.1, north: 25.1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("熱區：中性模式只亮單色層；領先政黨三層依開關個別歸零；z12.5 淡到 0", () => {
    const heat = OVERLAY_REGISTRY.find((c) => c.id === "pollingStations2024" && c.sourceId === "polling-stations-2024-heat")!;
    const op = (suffix: string, p: Record<string, number>) => {
      const expr = heat.layers.find((l) => l.suffix === suffix)!.paint(true, p)["heatmap-opacity"] as unknown[];
      return [expr[4], expr[6]] as [number, number];
    };
    const neutral = { pollingStations2024ColorByIdx: 2 };
    expect(op("neutral", neutral)[0]).toBeGreaterThan(0);
    expect(op("dpp", neutral)[0]).toBe(0);
    // 預設（idx 缺）＝中性
    expect(op("neutral", {})[0]).toBeGreaterThan(0);
    // 投票率模式熱區沿用中性
    expect(op("neutral", { pollingStations2024ColorByIdx: 1 })[0]).toBeGreaterThan(0);
    const lead = { pollingStations2024ColorByIdx: 0, pollingStations2024HeatDpp: 1, pollingStations2024HeatKmt: 0, pollingStations2024HeatTpp: 1 };
    expect(op("neutral", lead)[0]).toBe(0);
    expect(op("dpp", lead)[0]).toBeGreaterThan(0);
    expect(op("kmt", lead)[0]).toBe(0);
    expect(op("tpp", lead)[0]).toBeGreaterThan(0);
    expect(op("dpp", lead)[1]).toBe(0);
    for (const l of heat.layers) expect(l.type).toBe("heatmap");
    expect(heat.layers.find((l) => l.suffix === "kmt")!.paint(true, lead)["heatmap-weight"]).toEqual(["get", "w_kmt"]);
  });

  it("三黨開關預設全開、只在領先政黨模式顯示", () => {
    for (const name of ["pollingStations2024HeatDpp", "pollingStations2024HeatKmt", "pollingStations2024HeatTpp"]) {
      const spec = LAYER_PARAMS_SPEC.pollingStations2024.find((s) => s.name === name);
      expect(spec?.kind).toBe("toggle");
      expect(spec?.default).toBe(true);
      expect(spec?.showWhen).toEqual({ param: "pollingStations2024ColorBy", equals: "lead" });
    }
  });

  it("熱區色階：7 階、末階為原色", () => {
    const ramp = pollingHeatRamp("#1f9d55");
    expect(ramp).toHaveLength(7);
    expect(ramp[6]).toBe("#1f9d55");
  });
});
