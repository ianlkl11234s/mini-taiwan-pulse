import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));

import { isMissingRpc, normalizeElectionEvents } from "../electionEventsLoader";
import {
  electionClaimantKey,
  electionEventSpan,
  electionSources,
  formatCrowdNumber,
  inElectionRange,
} from "../electionEventsTypes";
import { buildElectionDisplay } from "../../hooks/useElectionEventsLayer";
import { isAccessDenied } from "../../lib/layerGates";

const RAW = {
  type: "FeatureCollection",
  meta: { total: 5, mapped: 3, loaded_at: "2026-11-02T10:00:00+08:00" },
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [121.5, 25.04] },
      properties: {
        event_id: "e1", event_name: "大型造勢", event_date: "2026-11-01",
        starts_at: "2026-11-01T19:00:00+08:00", ends_at: "2026-11-01T21:30:00+08:00",
        camp: "民主進步黨", scale_tier: "L", reported_crowd: 30000, crowd_claimant: "organizer",
        event_status: "held", sources: [{ source: "中央社", url: "https://www.cna.com.tw/x" }, { source: "壞", url: "javascript:alert(1)" }],
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [120.3, 22.6] },
      properties: {
        event_id: "e2", event_name: "掃街", event_date: "2026-11-05", starts_at: null, ends_at: null,
        camp: "中國國民黨", scale_tier: "S", event_status: "scheduled",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [120.68, 24.14] },
      properties: {
        event_id: "e3", event_name: "座談", event_date: "2026-11-20", starts_at: "2026-11-20T14:00:00+08:00",
        camp: "無黨籍", scale_tier: "M", event_status: "postponed",
      },
    },
    // 無日期 → 不上圖
    { type: "Feature", geometry: { type: "Point", coordinates: [121, 24] }, properties: { event_id: "e4", camp: "台灣民眾黨" } },
    // 非 Point → 不上圖
    { type: "Feature", geometry: null, properties: { event_id: "e5", event_date: "2026-11-03" } },
  ],
};

const sec = (iso: string) => Date.parse(iso) / 1000;

describe("2026 選舉活動 loader", () => {
  it("衍生 camp_key／start_ts／end_ts，丟掉無日期與非 Point", () => {
    const { fc, meta } = normalizeElectionEvents(RAW);
    expect(fc.features.map((f) => f.properties?.event_id)).toEqual(["e1", "e2", "e3"]);
    expect(fc.features.map((f) => f.properties?.camp_key)).toEqual(["dpp", "kmt", "other"]);
    expect(meta).toEqual({ total: 5, mapped: 3, loadedAt: "2026-11-02T10:00:00+08:00" });
    const e2 = fc.features[1]!.properties!;
    expect(e2.start_ts).toBe(sec("2026-11-05T00:00:00+08:00"));
    expect(e2.end_ts).toBe(sec("2026-11-06T00:00:00+08:00") - 1);
    // 只有 starts_at：訖＝當日結束
    expect(fc.features[2]!.properties!.end_ts).toBe(sec("2026-11-21T00:00:00+08:00") - 1);
  });

  it("空回應不炸", () => {
    expect(normalizeElectionEvents(null).fc.features).toEqual([]);
  });

  it("無權限走 isAccessDenied；函式不存在走 isMissingRpc", () => {
    expect(isAccessDenied({ code: "42501", message: "permission denied for function" })).toBe(true);
    expect(isMissingRpc({ code: "PGRST202", message: "Could not find the function public.get_election_events_2026" })).toBe(true);
    expect(isMissingRpc({ code: "42501" })).toBe(false);
  });
});

describe("2026 選舉活動：時間軸", () => {
  const { fc } = normalizeElectionEvents(RAW);
  const t = sec("2026-11-02T12:00:00+08:00");

  it("全部：都顯示，已過的 _past=1，未來的照畫", () => {
    const { fc: out } = buildElectionDisplay(fc, t, "all");
    expect(out.features.map((f) => [f.properties?.event_id, f.properties?._past])).toEqual([["e1", 1], ["e2", 0], ["e3", 0]]);
  });

  it("未來 7 天／30 天／已舉辦 相對時間軸時間", () => {
    const ids = (r: "next7" | "next30" | "held") => buildElectionDisplay(fc, t, r).fc.features.map((f) => f.properties?.event_id);
    expect(ids("next7")).toEqual(["e2"]);
    expect(ids("next30")).toEqual(["e2", "e3"]);
    expect(ids("held")).toEqual(["e1"]);
  });

  it("時間跨過活動結束才改簽章（避免每次 tick 都 setData）", () => {
    const a = buildElectionDisplay(fc, t, "all").signature;
    expect(buildElectionDisplay(fc, t + 3600, "all").signature).toBe(a);
    expect(buildElectionDisplay(fc, sec("2026-11-06T00:00:00+08:00"), "all").signature).not.toBe(a);
  });

  it("活動進行中不算已過", () => {
    const span = electionEventSpan({ event_date: "2026-11-01", starts_at: "2026-11-01T19:00:00+08:00", ends_at: "2026-11-01T21:30:00+08:00" })!;
    expect(inElectionRange(span, sec("2026-11-01T20:00:00+08:00"), "held")).toBe(false);
    expect(inElectionRange(span, sec("2026-11-01T20:00:00+08:00"), "next7")).toBe(true);
  });
});

describe("2026 選舉活動：popup 格式", () => {
  it("宣稱人數：中文用萬，其他語系千分位", () => {
    const fmt = (n: number) => n.toLocaleString("en-US");
    expect(formatCrowdNumber(30000, "zh-TW", fmt)).toBe("3 萬");
    expect(formatCrowdNumber(12500, "zh-TW", fmt)).toBe("1.3 萬");
    expect(formatCrowdNumber(800, "zh-TW", fmt)).toBe("800");
    expect(formatCrowdNumber(30000, "en", fmt)).toBe("30,000");
  });

  it("宣稱者代碼 → 措辭 key", () => {
    expect(electionClaimantKey("police_estimate")).toBe("police_estimate");
    expect(electionClaimantKey(null)).toBe("unknown");
  });

  it("來源：Mapbox 給的 JSON 字串也吃，只留 http(s)，最多 5 筆", () => {
    const raw = JSON.stringify([
      { source: "a", url: "https://a" }, { source: "x", url: "javascript:void(0)" },
      ...Array.from({ length: 6 }, (_, i) => ({ source: `s${i}`, url: `https://s${i}` })),
    ]);
    const out = electionSources(raw);
    expect(out).toHaveLength(5);
    expect(out[0]).toEqual({ source: "a", url: "https://a" });
    expect(out.every((s) => s.url.startsWith("https://"))).toBe(true);
  });
});
