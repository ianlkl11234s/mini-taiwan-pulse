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
import { buildElectionDisplay, electionCampPredicate } from "../../hooks/useElectionEventsLayer";
import { isAccessDenied } from "../../lib/layerGates";
import type { MapboxGeoJSONFeature } from "mapbox-gl";
import { SPREAD_GAP, pickElectionHits, spreadOffsetOf, spreadLayout } from "../../map/electionSpread";

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

describe("2026 選舉活動：位置精度（代表點分組）", () => {
  const t = sec("2026-11-10T12:00:00+08:00");
  const TAMSUI = [121.44, 25.17];
  const ev = (id: string, camp: string, precision: string, coords: number[], date: string) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: coords },
    properties: { event_id: id, event_name: id, event_date: date, camp, scale_tier: "M", location_precision: precision, city: "新北市", town: "淡水區" },
  });
  const { fc } = normalizeElectionEvents({
    features: [
      ev("v1", "民主進步黨", "address", TAMSUI, "2026-11-15"),
      ev("v2", "中國國民黨", "landmark", TAMSUI, "2026-11-15"),
      ev("t1", "中國國民黨", "town_centroid", TAMSUI, "2026-11-15"),
      ev("t2", "民主進步黨", "town_centroid", TAMSUI, "2026-11-12"),
      ev("t3", "中國國民黨", "town_centroid", TAMSUI, "2026-11-03"),
      ev("c1", "台灣民眾黨", "city_centroid", TAMSUI, "2026-11-20"),
      ev("s1", "民主進步黨", "settlement", [120.3, 23.3], "2026-11-09"),
    ],
  });
  const grp = (f: GeoJSON.Feature) => f.properties?._grp === 1;

  it("同精度同座標 2 場以上合成一個 _grp，1 場維持單點；場館點與代表點同座標也不混在一起", () => {
    const out = buildElectionDisplay(fc, t, "all");
    const singles = out.fc.features.filter((f) => !grp(f) && f.properties?._sp !== 1).map((f) => f.properties?.event_id).sort();
    expect(singles).toEqual(["c1", "s1"]);
    const groups = out.fc.features.filter(grp);
    expect(groups).toHaveLength(2);
    // 場館級（address＋landmark 同座標）另成一組，precision＝venue
    const v = groups.find((f) => f.properties?.n === 2)!.properties!;
    expect(out.icons.get(v._img as string)?.precision).toBe("venue");
    const g = groups.find((f) => f.properties?.n === 3)!.properties!;
    expect(g.n).toBe(3);
    expect(g._past).toBe(0);
    // 清單依日期新到舊
    expect(JSON.parse(g.events as string).map((e: { event_id: string }) => e.event_id)).toEqual(["t1", "t2", "t3"]);
    expect(out.icons.get(g._img as string)).toEqual({ counts: { kmt: 2, dpp: 1 }, precision: "town_centroid", allPast: false });
  });

  it("全部已舉辦的代表點：_past=1、圖示 key 不同", () => {
    const late = buildElectionDisplay(fc, sec("2026-11-30T00:00:00+08:00"), "all");
    const g = late.fc.features.find((f) => grp(f) && f.properties?.n === 3)!.properties!;
    expect(g._past).toBe(1);
    expect(String(g._img)).toContain("town_centroid-1-");
  });

  it("位置篩選：只看確切地點／只看代表點", () => {
    const ids = (location: "exact" | "approx") => buildElectionDisplay(fc, t, "all", { location }).fc.features
      .filter((f) => f.properties?._sp !== 1)
      .map((f) => (grp(f) ? `grp${f.properties?.n}` : f.properties?.event_id)).sort();
    expect(ids("exact")).toEqual(["grp2"]);
    expect(ids("approx")).toEqual(["c1", "grp3", "s1"]);
  });

  it("分組在篩選之後：陣營或時間篩到只剩 1 場就回到單點", () => {
    const onlyDpp = electionCampPredicate(0b00001);
    const out = buildElectionDisplay(fc, t, "all", { camp: onlyDpp });
    expect(out.fc.features.some(grp)).toBe(false);
    expect(out.fc.features.map((f) => f.properties?.event_id).sort()).toEqual(["s1", "t2", "v1"]);
    const held = buildElectionDisplay(fc, t, "held");
    expect(held.fc.features.map((f) => f.properties?.event_id).sort()).toEqual(["s1", "t3"]);
  });

  it("陣營遮罩：全選回 null；「其他」位元管 other", () => {
    expect(electionCampPredicate(undefined)).toBeNull();
    expect(electionCampPredicate(0b11111)).toBeNull();
    const otherOnly = electionCampPredicate(0b10000)!;
    expect(otherOnly("other")).toBe(true);
    expect(otherOnly("dpp")).toBe(false);
  });
});

describe("2026 選舉活動：確切地點同座標合成", () => {
  const t = sec("2026-11-10T12:00:00+08:00");
  const PARK = [121.5, 25.03];
  const ev = (id: string, camp: string, date: string, extra: Record<string, unknown> = {}, coords = PARK) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: coords },
    properties: { event_id: id, event_name: id, event_date: date, camp, scale_tier: "M", location_precision: "landmark", city: "臺北市", town: "大安區", ...extra },
  });
  const { fc } = normalizeElectionEvents({
    features: [
      ev("a", "民主進步黨", "2026-08-03", { location_text: "某公園" }),
      ev("b", "民主進步黨", "2026-11-01", { location_text: "某公園露天舞台", scale_tier: "L" }),
      ev("c", "中國國民黨", "2026-11-02", { location_text: "某公園", location_precision: "address" }),
      ev("d", "中國國民黨", "2026-11-20", {}, [121.5, 25.031]),
      ev("z", "台灣民眾黨", "2026-11-20", { location_precision: "town_centroid" }),
    ],
  });
  const grp = (f: GeoJSON.Feature) => f.properties?._grp === 1;

  it("同座標 3 場合成一個 _grp：場次數、陣營比例、地名、清單新到舊", () => {
    // 時間軸在 11-01 中午：a 已過、b 進行中、c 未到 → 不是全部已過
    const out = buildElectionDisplay(fc, sec("2026-11-01T12:00:00+08:00"), "all");
    const groups = out.fc.features.filter(grp);
    expect(groups).toHaveLength(1);
    const g = groups[0]!.properties!;
    expect(g.n).toBe(3);
    expect(g.location_text).toBe("某公園");
    expect(g._past).toBe(0);
    expect(JSON.parse(g.events as string).map((e: { event_id: string }) => e.event_id)).toEqual(["c", "b", "a"]);
    expect(out.icons.get(g._img as string)).toEqual({ counts: { dpp: 2, kmt: 1 }, precision: "venue", allPast: false });
    expect(String(g._img)).toContain("venue-0-dpp2_kmt1");
  });

  it("不同座標不合成；同座標的代表點不併進場館組", () => {
    const out = buildElectionDisplay(fc, t, "all");
    const singles = out.fc.features.filter((f) => !grp(f) && f.properties?._sp !== 1).map((f) => f.properties?.event_id).sort();
    expect(singles).toEqual(["d", "z"]);
  });

  it("篩到只剩 1 場回到單點（陣營／時間／位置）", () => {
    const onlyKmt = electionCampPredicate(0b00010);
    expect(buildElectionDisplay(fc, t, "all", { camp: onlyKmt }).fc.features.some(grp)).toBe(false);
    // 11-01 23:59 之後才算已過：時間軸 11-02 中午時只有 a、b 已舉辦
    const held = buildElectionDisplay(fc, sec("2026-11-02T12:00:00+08:00"), "held");
    const hg = held.fc.features.filter(grp);
    expect(hg).toHaveLength(1);
    expect(hg[0]!.properties!.n).toBe(2);
    expect(hg[0]!.properties!._past).toBe(1);
    expect(buildElectionDisplay(fc, t, "next7").fc.features.some(grp)).toBe(false);
    expect(buildElectionDisplay(fc, t, "all", { location: "approx" }).fc.features.map((f) => f.properties?.event_id)).toEqual(["z"]);
  });

  it("全部已過：_past=1、圖示 key 帶已過旗標", () => {
    const g = buildElectionDisplay(fc, sec("2026-11-30T00:00:00+08:00"), "all").fc.features.find(grp)!.properties!;
    expect(g._past).toBe(1);
    expect(String(g._img)).toContain("venue-1-");
  });
});

describe("2026 選舉活動：確切地點多場拉近展開", () => {
  const t = sec("2026-11-10T12:00:00+08:00");
  const at = (id: string, tier: string, coords: number[], extra: Record<string, unknown> = {}) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: coords },
    properties: { event_id: id, event_name: id, event_date: "2026-11-20", camp: "民主進步黨", scale_tier: tier, location_precision: "address", city: "臺中市", town: "南屯區", ...extra },
  });
  const sp = (f: GeoJSON.Feature) => f.properties?._sp === 1;

  it("相鄰兩點相切：中心距≈兩半徑和＋間距（整數 px 取整誤差內）", () => {
    const radii = [11.25, 5, 5, 5, 5, 5, 5];
    const off = spreadLayout(radii);
    for (let i = 0; i < radii.length; i++) {
      const j = (i + 1) % radii.length;
      const d = Math.hypot(off[i]![0] - off[j]![0], off[i]![1] - off[j]![1]);
      expect(d).toBeGreaterThanOrEqual(radii[i]! + radii[j]! + SPREAD_GAP - 1.5);
      expect(d).toBeLessThanOrEqual(radii[i]! + radii[j]! + SPREAD_GAP + 1.5);
    }
  });

  it("一個大點不把整圈撐開：1 大 6 小的圈半徑比 7 個大點小很多", () => {
    const R = (radii: number[]) => Math.max(...spreadLayout(radii).map(([x, y]) => Math.hypot(x, y)));
    expect(R([11.25, 5, 5, 5, 5, 5, 5])).toBeLessThan(R(Array(7).fill(11.25)) * 0.65);
    // 2 場：上下相切
    expect(spreadLayout([5, 5])).toEqual([[0, -6], [0, 6]]);
  });

  it("同座標 3 場：輸出 3 個展開點＋合成圖示帶 _spr；位移各不相同、在表內", () => {
    const { fc } = normalizeElectionEvents({ features: [at("a", "L", [120.6, 24.1]), at("b", "S", [120.6, 24.1]), at("c", "M", [120.6, 24.1])] });
    const out = buildElectionDisplay(fc, t, "all");
    const pts = out.fc.features.filter(sp);
    expect(pts.map((f) => f.properties?.event_id).sort()).toEqual(["a", "b", "c"]);
    const offs = pts.map((f) => spreadOffsetOf(f.properties));
    expect(offs.every(Boolean)).toBe(true);
    expect(new Set(offs.map(String)).size).toBe(3);
    const g = out.fc.features.find((f) => f.properties?._grp === 1)!.properties!;
    expect(g._spr).toBe(1);
    expect(out.dotIcons.size).toBeGreaterThan(0);
  });

  it("退回規則：超過 8 場不展開；代表點不展開；只剩 1 場沒有展開點", () => {
    const many = normalizeElectionEvents({ features: Array.from({ length: 9 }, (_, i) => at(`m${i}`, "S", [121, 24])) }).fc;
    const o9 = buildElectionDisplay(many, t, "all");
    expect(o9.fc.features.some(sp)).toBe(false);
    expect(o9.fc.features.find((f) => f.properties?._grp === 1)!.properties!._spr).toBeUndefined();
    const approx = normalizeElectionEvents({ features: [at("x", "S", [121, 24], { location_precision: "town_centroid" }), at("y", "S", [121, 24], { location_precision: "town_centroid" })] }).fc;
    expect(buildElectionDisplay(approx, t, "all").fc.features.some(sp)).toBe(false);
    const one = normalizeElectionEvents({ features: [at("solo", "S", [121, 24])] }).fc;
    expect(buildElectionDisplay(one, t, "all").fc.features.some(sp)).toBe(false);
  });

  it("命中：取離游標最近的展開點；z<13 丟掉展開點、z≥13 丟掉已淡出的數字圖示", () => {
    const mk = (id: string, props: Record<string, unknown>) => ({ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: { event_id: id, ...props } }) as unknown as MapboxGeoJSONFeature;
    const feats = [mk("grp", { _grp: 1, _spr: 1 }), mk("up", { _sp: 1, _dx: 0, _dy: -10 }), mk("down", { _sp: 1, _dx: 0, _dy: 10 })];
    const map = (z: number) => ({ project: () => ({ x: 100, y: 100 }), getZoom: () => z }) as unknown as Parameters<typeof pickElectionHits>[0];
    expect(pickElectionHits(map(14), feats, { x: 101, y: 108 }).map((f) => f.properties?.event_id)).toEqual(["down", "up"]);
    expect(pickElectionHits(map(14), feats, { x: 100, y: 93 })[0]!.properties?.event_id).toBe("up");
    // 大小滑桿 2 倍：位移也 2 倍
    expect(pickElectionHits(map(14), feats, { x: 100, y: 121 }, 2)[0]!.properties?.event_id).toBe("down");
    const pair = [mk("near", { _sp: 1, _dx: 0, _dy: 10 }), mk("far", { _sp: 1, _dx: 0, _dy: 20 })];
    expect(pickElectionHits(map(14), pair, { x: 100, y: 120 })[0]!.properties?.event_id).toBe("far");
    expect(pickElectionHits(map(14), pair, { x: 100, y: 120 }, 2)[0]!.properties?.event_id).toBe("near");
    // 拉遠：數字圖示旁的單點畫在上層、先被查到，但點在數字圖示正中央時要開清單
    const mkAt = (id: string, xy: [number, number], props: Record<string, unknown>) => ({ type: "Feature", geometry: { type: "Point", coordinates: xy }, properties: { event_id: id, ...props } }) as unknown as MapboxGeoJSONFeature;
    const proj = { project: ([x, y]: [number, number]) => ({ x: 100 + x, y: 100 + y }), getZoom: () => 12.5 } as unknown as Parameters<typeof pickElectionHits>[0];
    const zoomedOut = [mkAt("single", [-8, 0], {}), mkAt("grp", [0, 0], { _grp: 1, _spr: 1 })];
    expect(pickElectionHits(proj, zoomedOut, { x: 100, y: 100 })[0]!.properties?.event_id).toBe("grp");
    expect(pickElectionHits(proj, zoomedOut, { x: 92, y: 100 })[0]!.properties?.event_id).toBe("single");
    // 位移不受舊查表 ±32 px 限制
    expect(spreadOffsetOf({ _dx: 40, _dy: -45 })).toEqual([40, -45]);
    expect(spreadOffsetOf({ _dx: "1", _dy: 2 })).toBeNull();
    expect(pickElectionHits(map(12.5), feats, { x: 100, y: 108 }).map((f) => f.properties?.event_id)).toEqual(["grp"]);
  });
});

describe("2026 選舉活動：來源名稱", () => {
  it("內部代碼 → 白話名稱 key；未知代碼歸「其他來源」", async () => {
    const { electionSourceNameKey } = await import("../electionEventsTypes");
    const { localeStore } = await import("../../state/localeStore");
    const { t } = localeStore.getSnapshot();
    expect(t(electionSourceNameKey("cna_mcp"))).toBe("中央社");
    expect(t(electionSourceNameKey("observe"))).toBe("市長觀測站");
    expect(t(electionSourceNameKey("permits_npa"))).toBe(t(electionSourceNameKey("permits")));
    expect(t(electionSourceNameKey("manual"))).toBe("人工查證");
    expect(electionSourceNameKey("toString")).toBe("popup.politics.sourceName.other");
    expect(t(electionSourceNameKey("whatever_new"))).toBe("其他來源");
  });
});

describe("2026 選舉活動：聚落名稱（mig 515 settlement_name）", () => {
  it("只有聚落代表點採用 settlement_name；空值與其他精度回 null", async () => {
    const { electionSettlementName } = await import("../electionEventsTypes");
    expect(electionSettlementName({ location_precision: "settlement", settlement_name: " 菁寮 " })).toBe("菁寮");
    expect(electionSettlementName({ location_precision: "settlement", settlement_name: null })).toBeNull();
    expect(electionSettlementName({ location_precision: "town_centroid", settlement_name: "菁寮" })).toBeNull();
  });

  it("定位說明：有聚落名寫聚落名，沒有時寫縣市區", async () => {
    const { electionPrecisionNote } = await import("../../components/featureInfo/politicsPanels");
    const { localeStore } = await import("../../state/localeStore");
    const i18n = localeStore.getSnapshot();
    const base = { location_precision: "settlement", city: "臺南市", town: "後壁區" };
    expect(electionPrecisionNote("settlement", { ...base, settlement_name: "菁寮" }, i18n, "single")).toBe("在菁寮聚落內，點位不是場地本身");
    expect(electionPrecisionNote("settlement", { ...base, settlement_name: "菁寮" }, i18n, "group")).toBe("以下活動都在菁寮聚落內，點位不是場地本身");
    expect(electionPrecisionNote("settlement", { ...base, settlement_name: null }, i18n, "single")).toBe("在臺南市後壁區的聚落內，點位是聚落代表點，不是集合場地本身");
    expect(electionPrecisionNote("town_centroid", { ...base, location_precision: "town_centroid", settlement_name: "菁寮" }, i18n, "single")).toBe("只知道在臺南市後壁區，點位不是活動地點");
  });

  it("多場分組帶上聚落名", () => {
    const { fc } = normalizeElectionEvents({
      features: ["a", "b"].map((id) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [120.35, 23.36] },
        properties: { event_id: id, event_date: "2026-11-20", camp: "民主進步黨", location_precision: "settlement", settlement_name: "菁寮", city: "臺南市", town: "後壁區" },
      })),
    });
    const g = buildElectionDisplay(fc, sec("2026-11-10T00:00:00+08:00"), "all").fc.features[0]!.properties!;
    expect(g._grp).toBe(1);
    expect(g.settlement_name).toBe("菁寮");
  });
});
