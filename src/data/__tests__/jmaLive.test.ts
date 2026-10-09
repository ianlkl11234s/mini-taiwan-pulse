/**
 * 日本氣象廳即時 4 層：NULL 語意、警報對市町村界、表達式合法性（Mapbox style-spec 靜態驗證）。
 * view 尚未有資料時也要能跑：全部用合成列，不打網路。
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error — style-spec 的 CJS 入口無型別宣告（mapbox-gl 未導出），僅測試用
import { validate } from "mapbox-gl/dist/style-spec/index.cjs";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { JMA_AMEDAS_MODES, jmaVolcanoLevel, jmaWarningLevel, normalizeJmaIntensity } from "../jmaTypes";
import { amedasProps, buildJmaWarningsSnapshot, designatedCityName, quakeProps, rowsToPointFC } from "../jmaLiveLoaders";
import { jmaWarningsColorExpr, jmaWarningsFilter } from "../../hooks/useJmaWarningsLayer";

function errors(layer: Record<string, unknown>, source: Record<string, unknown>): string[] {
  const style = { version: 8, sources: { [layer.source as string]: source }, layers: [layer] };
  return (validate(style) as { message: string }[]).map((e) => e.message);
}

const GEOJSON = { type: "geojson", data: { type: "FeatureCollection", features: [] } };
const VECTOR = { type: "vector", tiles: ["https://example.invalid/{z}/{x}/{y}.pbf"] };

describe("AMeDAS：NULL 不可當 0", () => {
  it("缺值保留 null、0 保留 0、積雪計旗標照抄", () => {
    const p = amedasProps({ station_id: "1", temp: 12.3, snow: null, precip1h: 0, has_snow_gauge: true, wind: "" });
    expect(p.temp).toBe(12.3);
    expect(p.snow).toBeNull();
    expect(p.precip1h).toBe(0);
    expect(p.wind).toBeNull();
    expect(p.has_snow_gauge).toBe(true);
  });

  it("座標 NULL 的站不畫、不合成座標，計入 noCoord", () => {
    const { fc, noCoord } = rowsToPointFC([{ lat: 35, lon: 139 }, { lat: null, lon: 139 }], () => ({}));
    expect(fc.features).toHaveLength(1);
    expect(noCoord).toBe(1);
  });

  it("四種模式的 paint 與 filter 都是合法 style；積雪模式只留有積雪計的站", () => {
    const config = OVERLAY_REGISTRY.find((c) => c.id === "jmaAmedas")!;
    const spec = config.layers[0]!;
    JMA_AMEDAS_MODES.forEach((mode, idx) => {
      const params = { jmaAmedasModeIdx: idx };
      const filter = typeof spec.filter === "function" ? spec.filter(params) : spec.filter;
      if (mode.value === "snow") expect(JSON.stringify(filter)).toContain("has_snow_gauge");
      for (const isDark of [true, false]) {
        const layer = { id: "t", type: "circle", source: config.sourceId, filter, paint: spec.paint(isDark, params) };
        expect(errors(layer, GEOJSON), mode.value).toEqual([]);
      }
    });
  });
});

describe("警報・注意報：class20 對市町村界", () => {
  const raw = [
    { control_datetime: "2026-10-09T00:00:00Z", area_code: "1410011", area_name: "横浜市北部", area_level: "class20", kind_code: "10", kind_name: "大雨注意報", status: "発表" },
    { control_datetime: "2026-10-09T00:00:00Z", area_code: "1410012", area_name: "横浜市南部", area_level: "class20", kind_code: "03", kind_name: "大雨警報", status: "継続" },
    { control_datetime: "2026-10-09T00:00:00Z", area_code: "1310100", area_name: "千代田区", area_level: "class20", kind_code: "10", kind_name: "大雨注意報", status: "解除" },
    { control_datetime: "2026-10-09T00:00:00Z", area_code: "2811000", area_name: "神戸市中央区", area_level: "class20", kind_code: "14", kind_name: "雷注意報", status: "発表" },
    { control_datetime: "2026-10-09T00:00:00Z", area_code: "011000", area_name: "宗谷地方", area_level: "class10", kind_code: "10", kind_name: "大雨注意報", status: "発表" },
    { control_datetime: "2026-10-09T00:00:00Z", area_code: "0121400", area_name: "稚内市", area_level: "class20", kind_code: "99", kind_name: null, status: "発表" },
  ];

  it("解除不上色；同區取最高級；政令市分區整市對；非市町村層級列為未上色", () => {
    const snap = buildJmaWarningsSnapshot(raw);
    expect(snap.areas.has("13101")).toBe(false);
    expect(snap.areas.get("14100")?.level).toBe("warning");
    expect(snap.cityNameKeys.get("14横浜市")?.code5).toBe("14100");
    expect(snap.areas.get("28110")?.level).toBe("advisory");
    expect([...snap.cityNameKeys.keys()]).not.toContain("28神戸市");
    expect(snap.areas.get("01214")?.level).toBe("unknown");
    expect(snap.unmatched.map((r) => r.area_code)).toEqual(["011000"]);
  });

  it("政令市判定只吃『X市（東西南北部）』，區名不算", () => {
    expect(designatedCityName("浜松市北部", "22130")).toBe("浜松市");
    expect(designatedCityName("札幌市", "01100")).toBe("札幌市");
    expect(designatedCityName("神戸市中央区", "28110")).toBeNull();
    expect(designatedCityName("目黒区", "13110")).toBeNull();
    expect(designatedCityName("横須賀市", "14201")).toBeNull();
  });

  it("kind_name 判級：特別警報 > 危険警報 > 警報 > 注意報，名稱缺 → unknown", () => {
    expect(jmaWarningLevel("大雨特別警報")).toBe("special");
    expect(jmaWarningLevel("レベル4大雨危険警報")).toBe("danger");
    expect(jmaWarningLevel("暴風警報")).toBe("warning");
    expect(jmaWarningLevel("雷注意報")).toBe("advisory");
    expect(jmaWarningLevel(null)).toBe("unknown");
  });

  it("填色與 filter 在空快照與有資料時都是合法 style", () => {
    for (const snap of [null, buildJmaWarningsSnapshot([]), buildJmaWarningsSnapshot(raw)]) {
      const filter = jmaWarningsFilter(snap);
      const color = jmaWarningsColorExpr(snap);
      const fill = { id: "f", type: "fill", source: "s", "source-layer": "jp_admin_boundaries", filter, paint: { "fill-color": color, "fill-opacity": 0.5 } };
      const line = { id: "l", type: "line", source: "s", "source-layer": "jp_admin_boundaries", filter, paint: { "line-color": color } };
      expect(errors(fill, VECTOR)).toEqual([]);
      expect(errors(line, VECTOR)).toEqual([]);
    }
  });
});

describe("地震與火山", () => {
  it("震度正規化：5弱→5-、6強→6+、空字串→null", () => {
    expect(normalizeJmaIntensity("5弱")).toBe("5-");
    expect(normalizeJmaIntensity("6+")).toBe("6+");
    expect(normalizeJmaIntensity("")).toBeNull();
    expect(normalizeJmaIntensity(null)).toBeNull();
    expect(quakeProps({ magnitude: null, max_intensity: "3" }).magnitude).toBeNull();
  });

  it("火山レベル：原文（含全形）優先，代碼 11–15 次之，否則未導入", () => {
    expect(jmaVolcanoLevel("レベル２（火口周辺規制）", null)).toBe("2");
    expect(jmaVolcanoLevel(null, "13")).toBe("3");
    expect(jmaVolcanoLevel("火口周辺危険", "22")).toBe("none");
  });
});
