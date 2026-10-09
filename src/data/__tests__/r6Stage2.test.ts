/**
 * R6 段 2（2026-10-06）：數值只畫在立體裡的層，新做 Mapbox 平面版＋圖例。
 * - 機組即時出力 powerGenerationUnit：平面圓點（色＝燃料、大小＝出力 MW）
 * - 水庫即時水情 waterReservoirs：平面圓點（色＝警示等級、大小＝有效容量）＋蓄水率標籤
 * - 五類廢棄物設施 wf*：平面圓點（類別色）＋LG-1 圖例
 * - 區域用電 powerRegionDemand：側欄無入口（orphan）→ 跳過，不加平面版
 * 每層一個「立體效果」toggle，預設關；關閉時 Three.js 不畫、不下載。
 */
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error — style-spec CJS entry has no exported typings; test-only evaluator.
import { expression as styleExpression } from "mapbox-gl/dist/style-spec/index.cjs";
import { getParamsSpec, paramControlCategory, type LayerParamSpec } from "../layerParamsSpec";
import { LAYER_MANIFEST } from "../layerManifest";
import { anyThreeLayerVisible, WASTE_FACILITY_STEREO_KEYS, type ThreeStereoToggles } from "../../hooks/useThreeJsLayers";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { GIS_LAYERS } from "../../map/gisClickRegistry";
import { LEGEND_REGISTRY } from "../../components/LegendPanel";
import { DARK_LEGEND, LEGEND_SIZE_RING_WIDTH, LegendThemeCtx, LIGHT_LEGEND } from "../../components/legend/legendKit";
import {
  POWER_OUTPUT_RADIUS, powerOutputRadius, reservoirAlertCss, reservoirCapacityRadius, reservoirFlatAlert,
  RESERVOIR_ALERT_LEGEND, RESERVOIR_NODATA_COLOR, RESERVOIR_WATER_COLOR,
} from "../../map/r6FlatEncodings";
import {
  ALERT_COLOR_HEX, alertLevelFromPct, reservoirFeatureProps, reservoirStatusesToFC, type ReservoirStatus,
} from "../reservoirStatusLoader";
import { WASTE_FACILITY_COLORS } from "../wasteLoader";
import { WASTE_FACILITY_FLAT_KEYS, WASTE_MAPBOX_KEYS, wasteFlatOpacity } from "../../map/wasteMapboxLayers";
import { feedDynamicSource } from "../../map/dynamicSourceFeed";
import { plantsToHitFC } from "../../hooks/usePowerGenerationBeamLayer";
import { FUEL_COLORS } from "../energyLoader";
import type { LayerVisibility } from "../../types";

const STAGE2_TOGGLES: ReadonlyArray<[layerKey: string, param: string]> = [
  ["powerGenerationUnit", "powerGenerationUnit3D"],
  ["waterReservoirs", "waterReservoirs3D"],
  ["wfIncinerator", "wfIncinerator3D"],
  ["wfLandfill", "wfLandfill3D"],
  ["wfLandfillCoastal", "wfLandfillCoastal3D"],
  ["wfTransfer", "wfTransfer3D"],
  ["wfMedical", "wfMedical3D"],
];

const findSpec = (key: string, name: string): LayerParamSpec | undefined =>
  getParamsSpec(key)?.find((s) => s.name === name);

/** 用 Mapbox style-spec 真的求值一個 data expression */
function evalExpr(expr: unknown, properties: Record<string, unknown>, zoom = 8): unknown {
  const parsed = styleExpression.createExpression(expr);
  expect(parsed.result, JSON.stringify(parsed.value)).toBe("success");
  return parsed.value.evaluate({ zoom }, { properties });
}

const overlays = (id: string) => OVERLAY_REGISTRY.filter((c) => c.id === id);
const layerOf = (id: string, sourceId: string, suffix: string) => {
  const cfg = overlays(id).find((c) => c.sourceId === sourceId);
  return { cfg, layer: cfg?.layers.find((l) => l.suffix === suffix) };
};

describe("R6 段 2：立體效果 toggle", () => {
  it.each(STAGE2_TOGGLES)("%s 有 label「立體效果」的 toggle（%s），預設關、歸顏色組、只走 ref", (key, name) => {
    const spec = findSpec(key, name);
    expect(spec, `${key}.${name} 不存在`).toBeDefined();
    expect(spec).toMatchObject({ kind: "toggle", label: "立體效果", default: false, out: null });
    expect(paramControlCategory(spec!)).toBe("color");
    expect((getParamsSpec(key) ?? []).filter((s) => s.kind === "toggle" && s.label === "立體效果")).toHaveLength(1);
  });

  it("只對 Three.js 有意義的滑桿跟著立體效果出現", () => {
    expect(findSpec("powerGenerationUnit", "powerGenerationHeight")?.showWhen).toEqual({ param: "powerGenerationUnit3D", equals: true });
    expect(findSpec("waterReservoirs", "reservoirPillarHeight")?.showWhen).toEqual({ param: "waterReservoirs3D", equals: true });
    expect(findSpec("wfIncinerator", "wfIncineratorRingSize")?.showWhen).toEqual({ param: "wfIncinerator3D", equals: true });
  });

  it("manifest params kinds 與規格同步（預設值下可見的控件：立體效果關時 Three.js 專用滑桿不算）", () => {
    for (const [key] of STAGE2_TOGGLES) {
      const kinds = (getParamsSpec(key) ?? []).filter((s) => !s.showWhen).map((s) => s.kind);
      const params = (LAYER_MANIFEST as Record<string, { params: { count: number; kinds: string[] } | null }>)[key]!.params;
      expect(params, key).toEqual({ count: kinds.length, kinds });
    }
  });

  it("區域用電（orphan，側欄無入口）跳過：不加立體效果、不加平面層", () => {
    expect(LAYER_MANIFEST.powerRegionDemand.section).toBeNull();
    expect(getParamsSpec("powerRegionDemand") ?? []).toEqual([]);
    expect(overlays("powerRegionDemand")).toEqual([]);
  });
});

const ALL_OFF: ThreeStereoToggles = {
  fireStations3D: false, beamVisible: false,
  thsrPillarVisible: false, traPillarVisible: false, metroPillarVisible: false,
  airportPillarVisible: false, portPillarVisible: false,
  tempExtruded: false, wfMonitoring3D: false,
  wfIncinerator3D: false, wfLandfill3D: false, wfLandfillCoastal3D: false, wfTransfer3D: false, wfMedical3D: false,
  railTrainVisible: false, railTrain3D: false, railTrack3D: false, wasteTruck3D: false,
};
const visOnly = (key: keyof LayerVisibility) =>
  new Proxy({ [key]: true }, { get: (t, k) => (t as Record<string | symbol, boolean>)[k] ?? false }) as unknown as LayerVisibility;

describe("R6 段 2：3D bundle 只在立體效果開時載入", () => {
  it.each(WASTE_FACILITY_FLAT_KEYS)("%s 開、立體效果關 → 不載 bundle；開 → 載", (key) => {
    const toggle = WASTE_FACILITY_STEREO_KEYS[key];
    expect(anyThreeLayerVisible(visOnly(key), ALL_OFF)).toBe(false);
    expect(anyThreeLayerVisible(visOnly(key), { ...ALL_OFF, [toggle]: true })).toBe(true);
  });
});

describe("R6 段 2：機組即時出力平面圓點", () => {
  const { cfg, layer } = layerOf("powerGenerationUnit", "energy-power-generation-hit", "circle");

  it("registry 有可見 circle 子層，排在透明 hit 之前，hit 保留", () => {
    expect(layer?.type).toBe("circle");
    const suffixes = cfg!.layers.map((l) => l.suffix);
    expect(suffixes.indexOf("circle")).toBeLessThan(suffixes.indexOf("hit"));
  });

  it("色＝feature.color（hook 寫入 FUEL_COLORS），大小＝出力 MW、乘大小滑桿、不隨縮放", () => {
    const paint = layer!.paint(true, { powerGenerationScale: 1, powerGenerationOpacity: 0.7 });
    expect(evalExpr(paint["circle-color"], { color: FUEL_COLORS.coal })).toBe(FUEL_COLORS.coal);
    expect(JSON.stringify(paint["circle-radius"])).not.toContain('"zoom"');
    for (const mw of [0, 100, 1000, 3000, POWER_OUTPUT_RADIUS.refMw, 9000]) {
      expect(evalExpr(paint["circle-radius"], { output_mw: mw })).toBeCloseTo(powerOutputRadius(mw), 6);
    }
    const big = layer!.paint(true, { powerGenerationScale: 2, powerGenerationOpacity: 0.5 });
    expect(evalExpr(big["circle-radius"], { output_mw: 1000 })).toBeCloseTo(powerOutputRadius(1000, 2), 6);
    expect(big["circle-opacity"]).toBe(0.5);
  });

  it("出力半徑：面積 ∝ MW，0 → rMin、≥ refMw 封頂", () => {
    expect(powerOutputRadius(0)).toBe(POWER_OUTPUT_RADIUS.rMin);
    expect(powerOutputRadius(POWER_OUTPUT_RADIUS.refMw)).toBe(POWER_OUTPUT_RADIUS.rMax);
    expect(powerOutputRadius(10 * POWER_OUTPUT_RADIUS.refMw)).toBe(POWER_OUTPUT_RADIUS.rMax);
    expect(powerOutputRadius(null)).toBe(POWER_OUTPUT_RADIUS.rMin);
  });

  it("hook 的 feature 帶 popup 欄位與燃料色", () => {
    const fc = plantsToHitFC([{ plant_name: "台中", fuel_type: "coal", capacity_mw: 5500, output_mw: 3200, output_load_rate: 0.58, observed_at_ts: 0, lon: 120.48, lat: 24.21 }]);
    expect(fc.features[0]!.properties).toMatchObject({ name: "台中", output_mw: 3200, color: FUEL_COLORS.coal });
  });

  it("點擊仍走 hit 層（兩種模式同一個 powerPlant 面板）", () => {
    expect(GIS_LAYERS.find((g) => g.layers.includes("energy-power-generation-hit-hit"))?.type).toBe("powerPlant");
  });
});

const status = (over: Partial<ReservoirStatus> = {}): ReservoirStatus => ({
  reservoir_id: "10201", name: "石門水庫", region: null, lat: 24.81, lng: 121.24,
  effective_capacity_wan: 19_000, snapshot_at: "2026-10-06T02:00:00Z", water_level_m: 240.5,
  effective_storage_wan_m3: 12_000, storage_ratio_pct: 63.2, alert_level: "normal",
  inflow_cms: null, total_outflow_cms: null, basin_rainfall_mm: null, ...over,
});

describe("R6 段 2：水庫即時水情平面圓點", () => {
  const { cfg, layer } = layerOf("waterReservoirs", "water-reservoir-status", "circle");

  it("第 3 個 waterReservoirs config：dynamicData、吃整層透明度、排在壩體之後（疊在上面）", () => {
    expect(cfg).toMatchObject({ dynamicData: true, opacityParam: "waterReservoirsOpacity" });
    const ids = overlays("waterReservoirs").map((c) => c.sourceId);
    expect(ids).toEqual(["water-reservoir-poly", "water-reservoir-dams", "water-reservoir-status"]);
  });

  it("警示等級門檻與 3D 一致；缺值在平面版是「無資料」，3D 舊行為不變", () => {
    expect([10, 20, 50, 95].map((p) => reservoirFlatAlert(p))).toEqual(["critical", "warning", "normal", "high"]);
    expect([10, 20, 50, 95].map((p) => alertLevelFromPct(p))).toEqual(["critical", "warning", "normal", "high"]);
    expect(reservoirFlatAlert(null)).toBe("nodata");
    expect(alertLevelFromPct(null)).toBe("normal");
  });

  it("色＝與 3D 水柱同一常數；paint 表達式逐級對得上，缺值灰", () => {
    const paint = layer!.paint(true, { waterReservoirsScale: 1 });
    for (const key of ["critical", "warning", "normal", "high"] as const) {
      expect(reservoirAlertCss(key)).toBe(`#${ALERT_COLOR_HEX[key]!.toString(16).padStart(6, "0")}`);
      expect(evalExpr(paint["circle-color"], { alert: key })).toBe(reservoirAlertCss(key));
    }
    expect(evalExpr(paint["circle-color"], { alert: "nodata" })).toBe(RESERVOIR_NODATA_COLOR);
    expect(RESERVOIR_ALERT_LEGEND.map((r) => r.key)).toEqual(["critical", "warning", "normal", "high", "nodata"]);
  });

  it("大小＝有效容量立方根、乘大小滑桿、不隨縮放", () => {
    const paint = layer!.paint(true, { waterReservoirsScale: 1.5 });
    expect(JSON.stringify(paint["circle-radius"])).not.toContain('"zoom"');
    for (const wan of [0, 1_000, 19_000, 60_000]) {
      expect(evalExpr(paint["circle-radius"], { effective_capacity_wan: wan })).toBeCloseTo(reservoirCapacityRadius(wan, 1.5), 4);
    }
  });

  it("蓄水率標籤：四捨五入加 %，缺值不標", () => {
    const label = layerOf("waterReservoirs", "water-reservoir-status", "label").layer!;
    const layout = typeof label.layout === "function" ? label.layout(true) : label.layout!;
    expect(evalExpr(layout["text-field"], { storage_ratio_pct: 63.2 })).toBe("63%");
    expect(evalExpr(layout["text-field"], { storage_ratio_pct: null })).toBe("");
  });

  it("popup 欄位：平面與 3D 共用，容量用萬 m³ 原值、帶蓄水率與 compare_id", () => {
    const props = reservoirFeatureProps(status());
    expect(props).toMatchObject({
      kind: "reservoir", name: "石門水庫", compare_id: 10201, effective_capacity_wan: 19_000,
      storage_ratio_pct: 63.2, alert: "normal", water_level_m: 240.5, snapshot_at: "2026-10-06T02:00:00Z",
    });
    expect(props).not.toHaveProperty("capacity_m3");
    expect(reservoirFeatureProps(status({ storage_ratio_pct: null })).alert).toBe("nodata");
    const fc = reservoirStatusesToFC([status(), status({ reservoir_id: "x", lat: Number.NaN })]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.geometry).toEqual({ type: "Point", coordinates: [121.24, 24.81] });
  });

  it("點擊：平面圓點排在壩體之前，開 waterDam 面板", () => {
    const idx = (id: string) => GIS_LAYERS.findIndex((g) => g.layers.includes(id));
    expect(GIS_LAYERS[idx("water-reservoir-status-circle")]?.type).toBe("waterDam");
    expect(idx("water-reservoir-status-circle")).toBeLessThan(idx("water-reservoir-dams-core"));
  });
});

describe("R6 段 2：五類廢棄物設施平面圓點", () => {
  it("wasteMapboxLayers 納入五類，色號＝WASTE_FACILITY_COLORS（圖例同一常數）", () => {
    for (const k of WASTE_FACILITY_FLAT_KEYS) expect(WASTE_MAPBOX_KEYS).toContain(k);
    expect(WASTE_FACILITY_COLORS).toMatchObject({
      incinerator: "#ff6b1a", landfill: "#92400e", landfill_coastal: "#0891b2", transfer_station: "#a855f7", medical_waste: "#ec4899",
    });
  });

  it("2026-10-09：焚化爐橘＝3D 底圈／火苗色；側欄識別色（manifest color）＝paint＝圖例同一常數", () => {
    const typeOf = { wfIncinerator: "incinerator", wfLandfill: "landfill", wfLandfillCoastal: "landfill_coastal", wfTransfer: "transfer_station", wfMedical: "medical_waste" } as const;
    for (const k of WASTE_FACILITY_FLAT_KEYS) expect(LAYER_MANIFEST[k].color, k).toBe(WASTE_FACILITY_COLORS[typeOf[k]]);
    expect(WASTE_FACILITY_COLORS.incinerator).toBe("#ff6b1a");
    const five = WASTE_FACILITY_FLAT_KEYS.map((k) => WASTE_FACILITY_COLORS[typeOf[k]]);
    expect(new Set(five).size).toBe(5);
    expect(five).not.toContain("#ef4444"); // STATUS 錯誤紅不挪用（K-3）
  });

  it("透明度以滑桿預設正規化：預設＝0.85（P-3），既有 8 類公式不變", () => {
    expect(wasteFlatOpacity("wfLandfill", 0.45)).toBeCloseTo(0.85, 6);
    expect(wasteFlatOpacity("wfIncinerator", 0.85)).toBeCloseTo(0.85, 6);
    expect(wasteFlatOpacity("wfIncinerator", 1)).toBe(1);
    expect(wasteFlatOpacity("wfMonitoring", 0.7)).toBeCloseTo(0.595, 6);
  });
});

describe("2026-10-09：水庫容量圖例改水系色空心圈", () => {
  const legendHtml = (isDark: boolean) => {
    const entry = LEGEND_REGISTRY.find((e) => e.id === "waterReservoirs")!;
    const el = (entry.render as (...a: unknown[]) => ReactElement)({});
    return renderToStaticMarkup(createElement(LegendThemeCtx.Provider, { value: isDark ? DARK_LEGEND : LIGHT_LEGEND }, el));
  };

  it("大小圈＝空心、描邊＝水庫面同色（暗／淡各自）；無資料維持灰實心點", () => {
    for (const isDark of [true, false]) {
      const html = legendHtml(isDark);
      const water = isDark ? RESERVOIR_WATER_COLOR.dark : RESERVOIR_WATER_COLOR.light;
      expect(html.match(new RegExp(`border:${LEGEND_SIZE_RING_WIDTH}px solid ${water}`, "g"))).toHaveLength(3);
      expect(html.match(/background:transparent/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(html).toContain(`background:${RESERVOIR_NODATA_COLOR}`);
    }
  });

  it("水系色＝水庫面 fill 同一常數", () => {
    const { layer } = layerOf("waterReservoirs", "water-reservoir-poly", "fill");
    expect(layer!.paint(true, {})["fill-color"]).toBe(RESERVOIR_WATER_COLOR.dark);
    expect(layer!.paint(false, {})["fill-color"]).toBe(RESERVOIR_WATER_COLOR.light);
    expect([RESERVOIR_WATER_COLOR.dark, RESERVOIR_WATER_COLOR.light]).not.toContain(RESERVOIR_NODATA_COLOR);
  });
});

describe("R6 段 2：圖例登記", () => {
  it("水庫、五類設施改有圖例，且 LEGEND_REGISTRY 有對應 entry；機組沿用燃料色圖例", () => {
    expect(LAYER_MANIFEST.waterReservoirs.legend).toBe("waterReservoirs");
    for (const k of WASTE_FACILITY_FLAT_KEYS) expect(LAYER_MANIFEST[k].legend).toBe("wfIncinerator");
    expect(LAYER_MANIFEST.powerGenerationUnit.legend).toBe("powerPlants");
    const ids = new Set(LEGEND_REGISTRY.map((e) => e.id));
    for (const id of ["waterReservoirs", "wfIncinerator", "powerPlants"]) expect(ids.has(id), id).toBe(true);
  });
});

describe("R6 段 2：dynamicData source 補推資料", () => {
  function fakeMap() {
    const handlers: Array<() => void> = [];
    let source: { setData: ReturnType<typeof vi.fn> } | undefined;
    return {
      map: {
        on: (_e: string, h: () => void) => handlers.push(h),
        off: vi.fn(),
        getSource: () => source,
      },
      addSource: () => { source = { setData: vi.fn() }; handlers.forEach((h) => h()); return source; },
      fire: () => handlers.forEach((h) => h()),
    };
  }
  const fc = { type: "FeatureCollection" as const, features: [] };

  it("source 晚建：建立時補推；同一實例不重推；source 重建（換底圖）再補推", () => {
    const m = fakeMap();
    const feed = feedDynamicSource(m.map as never, "s");
    feed.set(fc); // source 還沒建
    const first = m.addSource();
    expect(first.setData).toHaveBeenCalledTimes(1);
    m.fire();
    expect(first.setData).toHaveBeenCalledTimes(1);
    const second = m.addSource();
    expect(second.setData).toHaveBeenCalledWith(fc);
    feed.set(fc);
    expect(second.setData).toHaveBeenCalledTimes(2);
    feed.dispose();
    expect(m.map.off).toHaveBeenCalled();
  });
});
