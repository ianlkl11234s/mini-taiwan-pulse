/**
 * JMA 時間軸點位與區域（P4）：時間桶、涵蓋檢查、季節狀態、梅雨地方對照、樣式合法性。
 * 全部用合成列，不打網路。
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error — style-spec 的 CJS 入口無型別宣告（mapbox-gl 未導出），僅測試用
import { validate } from "mapbox-gl/dist/style-spec/index.cjs";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import {
  JMA_RAINY_AMAMI_CODES, JMA_RAINY_REGION_PREFS, envWbgtLevel, jmaDiffClass, jmaHourBucketIso, jmaJstDateKey,
  jmaMinuteBucketIso, jmaPhenologyCode, jmaRainyPhase, jmaSignedDays,
} from "../jmaPointTypes";
import {
  amedasProps, buildJmaRainySnapshot, buildPhenologyFC, daysPastNormal, jmaCoverageGate, jmaTimeRequest,
  parseJmaCoverage, seasonalLabel, snowcapProps, wbgtProps,
} from "../jmaLiveLoaders";
import { jmaRainyColorExpr, jmaRainyFilter, jmaRainyRegionForCode } from "../../hooks/useJmaRainySeasonLayer";

const ts = (iso: string) => Date.parse(iso) / 1000;

function errors(layer: Record<string, unknown>, source: Record<string, unknown>): string[] {
  const style = { version: 8, glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf", sources: { [layer.source as string]: source }, layers: [layer] };
  return (validate(style) as { message: string }[]).map((e) => e.message);
}
const GEOJSON = { type: "geojson", data: { type: "FeatureCollection", features: [] } };
const VECTOR = { type: "vector", tiles: ["https://example.invalid/{z}/{x}/{y}.pbf"] };

describe("時間桶", () => {
  it("整點桶向下取整；10 分桶向下取整", () => {
    expect(jmaHourBucketIso(ts("2026-10-14T03:59:59Z"))).toBe("2026-10-14T03:00:00.000Z");
    expect(jmaMinuteBucketIso(ts("2026-10-14T03:29:59Z"), 10)).toBe("2026-10-14T03:20:00.000Z");
  });

  it("日本日期跨午夜：UTC 14:59 仍是當天、15:00 已是隔天（不可用台北日）", () => {
    expect(jmaJstDateKey(ts("2026-10-14T14:59:59Z"))).toBe("2026-10-14");
    expect(jmaJstDateKey(ts("2026-10-14T15:00:00Z"))).toBe("2026-10-15");
    // 台北 23:30＝日本 00:30 → 日本已是隔天
    expect(jmaJstDateKey(ts("2026-10-14T15:30:00Z"))).toBe("2026-10-15");
  });

  it("live／history 切換：±60 秒內走即時 view，往回拉換成桶", () => {
    const now = ts("2026-10-15T12:34:00Z");
    expect(jmaTimeRequest("jmaAmedas", now - 30, now)).toMatchObject({ cacheKey: "live", history: false, coverageLayer: null });
    const past = jmaTimeRequest("jmaAmedas", ts("2026-10-12T05:40:00Z"), now);
    expect(past).toMatchObject({ cacheKey: "2026-10-12T05:00:00.000Z", history: true, coverageLayer: "amedas", emptyIsUncovered: true });
    // 同一小時內拖動 → 同一桶（不重查）
    expect(jmaTimeRequest("jmaAmedas", ts("2026-10-12T05:05:00Z"), now).cacheKey).toBe(past.cacheKey);
    expect(jmaTimeRequest("jmaQuakes", ts("2026-10-12T05:47:00Z"), now)).toMatchObject({ cacheKey: "2026-10-12T05:40:00.000Z", emptyIsUncovered: false });
    expect(jmaTimeRequest("jmaWarnings", ts("2026-10-12T05:47:00Z"), now).emptyIsUncovered).toBe(false);
    // WBGT live 也走 RPC，0 列＝季外未涵蓋
    expect(jmaTimeRequest("jmaWbgt", now, now)).toMatchObject({ cacheKey: "live", emptyIsUncovered: true });
  });

  it("季節類用日本日期當桶，現在模式也一樣（跨日自動換桶）；火山永遠是快照", () => {
    const now = ts("2026-10-15T16:00:00Z"); // JST 10-16 01:00
    expect(jmaTimeRequest("jmaSakura", now, now)).toMatchObject({ cacheKey: "2026-10-16", history: false, coverageLayer: null });
    expect(jmaTimeRequest("jmaSnowcap", ts("2026-03-01T00:00:00Z"), now)).toMatchObject({ cacheKey: "2026-03-01", history: true, coverageLayer: "snowcap" });
    expect(jmaTimeRequest("jmaVolcanoes", ts("2026-01-01T00:00:00Z"), now)).toMatchObject({ cacheKey: "live", coverageLayer: null });
  });
});

describe("涵蓋檢查（未涵蓋 ≠ 沒有）", () => {
  const cov = parseJmaCoverage([
    { layer: "amedas", coverage_from: "2026-10-09T06:00:00+00:00", coverage_to: "2026-10-15T17:00:00+00:00", last_record_at: "2026-10-15T17:00:00+00:00" },
    { layer: "bad" },
  ]).get("amedas");
  const now = ts("2026-10-15T17:40:00Z");

  it("早於 coverage_from → before；晚於現在 → future；中間 → ok", () => {
    expect(jmaCoverageGate(cov, ts("2026-10-08T23:00:00Z"), now)).toBe("before");
    expect(jmaCoverageGate(cov, ts("2026-10-12T05:00:00Z"), now)).toBe("ok");
    expect(jmaCoverageGate(cov, now + 3600, now)).toBe("future");
  });

  it("不拿 coverage_to 擋：最新整點之後、現在之前的時刻仍查（RPC 給上一個整點）", () => {
    expect(jmaCoverageGate(cov, ts("2026-10-15T17:30:00Z"), now)).toBe("ok");
  });

  it("coverage 取不到時不擋（交給 RPC 回 0 列）", () => {
    expect(jmaCoverageGate(undefined, ts("2020-01-01T00:00:00Z"), now)).toBe("ok");
  });
});

describe("AMeDAS 歷史列：積雪站三態", () => {
  it("RPC 列的積雪計旗標與 null／0／>0 原樣保留（無積雪計由 filter 不畫）", () => {
    expect(amedasProps({ has_snow_gauge: false, snow: null }).has_snow_gauge).toBe(false);
    expect(amedasProps({ has_snow_gauge: true, snow: null }).snow).toBeNull();
    expect(amedasProps({ has_snow_gauge: true, snow: 0 }).snow).toBe(0);
    expect(amedasProps({ has_snow_gauge: true, snow: "12" }).snow).toBe(12);
  });
});

describe("WBGT 4 段（環境省日常生活指針）", () => {
  it("門檻 25／28／31；null 不分級", () => {
    expect(envWbgtLevel(6)).toBe("caution");
    expect(envWbgtLevel(24.9)).toBe("caution");
    expect(envWbgtLevel(25)).toBe("warning");
    expect(envWbgtLevel(28)).toBe("severe");
    expect(envWbgtLevel(31)).toBe("danger");
    expect(envWbgtLevel(null)).toBeNull();
    expect(wbgtProps({ wbgt: null }).level).toBeNull();
    expect(wbgtProps({ wbgt: "29.2" })).toMatchObject({ wbgt: 29.2, level: "severe" });
  });
});

describe("季節類", () => {
  it("與平年差分組與標籤", () => {
    expect(jmaDiffClass(-8)).toBe("much_early");
    expect(jmaDiffClass(-3)).toBe("early");
    expect(jmaDiffClass(2)).toBe("normal");
    expect(jmaDiffClass(7)).toBe("much_late");
    expect(jmaDiffClass(null)).toBeNull();
    expect(jmaSignedDays(-2)).toBe("−2");
    expect(seasonalLabel("observed", "2026-03-24", -2, "2026-03-26")).toBe("3/24 −2");
    expect(seasonalLabel("not_yet", null, null, "2026-10-03")).toBe("(10/3)");
  });

  it("未觀測且 as-of 已過平年日 → 已晚 N 日；已觀測或未到平年 → null", () => {
    expect(daysPastNormal("not_yet", "2026-10-03", "2026-10-15")).toBe(12);
    expect(daysPastNormal("not_yet", "2026-10-20", "2026-10-15")).toBeNull();
    expect(daysPastNormal("observed", "2026-10-03", "2026-10-15")).toBeNull();
  });

  it("初冠雪：未觀測不給差值顏色；已觀測依 days_vs_normal 分組", () => {
    const notYet = snowcapProps({ state: "not_yet", normal_date: "2026-10-03", days_vs_normal: null }, "2026-10-15");
    expect(notYet).toMatchObject({ diff_class: null, days_past_normal: 12, label: "(10/3)" });
    const seen = snowcapProps({ state: "observed", first_snowcap_date: "2026-10-02", normal_date: "2026-10-03", days_vs_normal: -1 }, "2026-10-15");
    expect(seen).toMatchObject({ diff_class: "normal", label: "10/2 −1" });
  });

  it("物候：每個圖層只留自己的現象；select 索引對現象碼", () => {
    const rows = [
      { station_no: "1", lon: 130, lat: 33, phenomenon_code: "004", state: "observed", obs_date: "2026-03-24", diff_normal_days: -2, normal_date: "2026-03-26" },
      { station_no: "1", lon: 130, lat: 33, phenomenon_code: "015", state: "not_yet", normal_date: "2026-11-20" },
      { station_no: "2", lon: null, lat: 33, phenomenon_code: "013", state: "not_yet" },
    ];
    const sakura = buildPhenologyFC(rows, "jmaSakura", "2026-10-15");
    expect(sakura.value.features.map((f) => f.properties?.phenomenon_code)).toEqual(["004"]);
    const autumn = buildPhenologyFC(rows, "jmaAutumnLeaves", "2026-10-15");
    expect(autumn.status).toMatchObject({ rows: 2, drawn: 1, noCoord: 1 });
    expect(jmaPhenologyCode("jmaAutumnLeaves", undefined)).toBe("015");
    expect(jmaPhenologyCode("jmaSakura", 1)).toBe("005");
  });
});

describe("梅雨：地方 → 縣碼", () => {
  it("北海道以外 46 都府縣各屬一個地方（鹿児島屬九州南部、奄美另以市町村切出）", () => {
    const all = Object.values(JMA_RAINY_REGION_PREFS).flat();
    expect(new Set(all).size).toBe(all.length);
    const expected = Array.from({ length: 46 }, (_, i) => String(i + 2).padStart(2, "0"));
    expect([...all].sort()).toEqual(expected);
    expect(JMA_RAINY_REGION_PREFS["九州北部"]).toContain("35"); // 山口
    expect(JMA_RAINY_REGION_PREFS["東海"]).toContain("24"); // 三重
    expect(JMA_RAINY_AMAMI_CODES.every((c) => c.startsWith("46"))).toBe(true);
  });

  it("奄美市町村 → 奄美；鹿児島其他 → 九州南部；北海道 → null", () => {
    expect(jmaRainyRegionForCode("46222")).toBe("奄美");
    expect(jmaRainyRegionForCode("46201")).toBe("九州南部");
    expect(jmaRainyRegionForCode("01100")).toBeNull();
  });

  it("as-of 階段：入梅前／梅雨中／出梅／特定不能", () => {
    expect(jmaRainyPhase("not_yet", "not_yet")).toBe("before");
    expect(jmaRainyPhase("observed", "not_yet")).toBe("in");
    expect(jmaRainyPhase("observed", "observed")).toBe("after");
    expect(jmaRainyPhase("observed", "unspecified")).toBe("unspecified");
    const snap = buildJmaRainySnapshot([{ region: "中国", onset_state: "observed", end_state: "observed" }, { region: "謎" }], "2026-08-01");
    expect(snap.regions.get("中国")?.phase).toBe("after");
    expect(snap.unmapped).toEqual(["謎"]);
  });

  it("填色與 filter 在空快照與有資料時都是合法 style", () => {
    const snap = buildJmaRainySnapshot([
      { region: "中国", onset_state: "observed", end_state: "observed" },
      { region: "奄美", onset_state: "observed", end_state: "not_yet" },
    ], "2026-06-20");
    for (const s of [null, snap]) {
      const layer = { id: "t", type: "fill", source: "s", "source-layer": "l", filter: jmaRainyFilter(s), paint: { "fill-color": jmaRainyColorExpr(s) } };
      expect(errors(layer, VECTOR)).toEqual([]);
    }
  });
});

describe("新點層樣式合法（Mapbox style-spec 靜態驗證）", () => {
  it("jmaLightning／jmaWbgt／jmaSnowcap／jmaAutumnLeaves／jmaSakura 每個子層 paint 與 filter 合法", () => {
    const flat = OVERLAY_REGISTRY.flat();
    for (const id of ["jmaLightning", "jmaWbgt", "jmaSnowcap", "jmaAutumnLeaves", "jmaSakura"]) {
      const config = flat.find((c) => c.id === id);
      expect(config, id).toBeTruthy();
      for (const idx of [0, 1, 3]) {
        const params = { [`${id}PhenomenonIdx`]: idx };
        for (const spec of config!.layers) {
          const filter = typeof spec.filter === "function" ? spec.filter(params) : spec.filter;
          const layer: Record<string, unknown> = {
            id: `${id}-${spec.suffix}`, type: spec.type, source: "s",
            paint: spec.paint(false, params),
            ...(spec.layout ? { layout: spec.layout } : {}),
            ...(filter ? { filter } : {}),
          };
          expect(errors(layer, GEOJSON), `${id}/${spec.suffix}`).toEqual([]);
        }
      }
    }
  });
});

describe("WBGT 出典", () => {
  it("WBGT 層 source attribution 是環境省，不是氣象廳 PDL", () => {
    const config = OVERLAY_REGISTRY.flat().find((c) => c.id === "jmaWbgt")!;
    expect(config.attribution).toContain("環境省");
  });
});
