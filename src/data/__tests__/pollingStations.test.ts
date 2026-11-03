import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) }, supabaseConfigured: true }));

import {
  clearPollingStationsCache,
  fetchPollingStations,
  isMissingPollingRpc,
  normalizePollingStations,
  pollingBoundsKey,
  snapPollingBounds,
} from "../pollingStationsLoader";
import { POLLING_COLOR_MODES, POLLING_FETCH_LIMIT, pollingLead } from "../pollingStationsTypes";
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

describe("pollingStations loader", () => {
  beforeEach(() => {
    rpc.mockReset();
    clearPollingStationsCache();
  });

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

  it("fetch：以對齊後的 bbox 與 p_limit 呼叫 RPC，同鍵第二次走快取", async () => {
    const abortSignal = vi.fn();
    rpc.mockImplementation(() => {
      const p = Promise.resolve({ data: RAW, error: null, status: 200 });
      return Object.assign(p, { abortSignal: (s: AbortSignal) => { abortSignal(s); return p; } });
    });
    const ctrl = new AbortController();
    const d1 = await fetchPollingStations({ west: 121.501, south: 25.011, east: 121.559, north: 25.049 }, ctrl.signal);
    expect(rpc).toHaveBeenCalledWith("get_polling_stations_2024", {
      p_west: 121.5, p_south: 25.0, p_east: 121.56, p_north: 25.06, p_limit: POLLING_FETCH_LIMIT,
    });
    expect(abortSignal).toHaveBeenCalledWith(ctrl.signal);
    const d2 = await fetchPollingStations({ west: 121.505, south: 25.015, east: 121.555, north: 25.045 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(d2).toBe(d1);
  });

  it("fetch：RPC 未部署時拋出可辨識的錯誤", async () => {
    rpc.mockImplementation(() => Promise.resolve({ data: null, error: { message: "Could not find the function", code: "PGRST202" }, status: 404 }));
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
  });
});
