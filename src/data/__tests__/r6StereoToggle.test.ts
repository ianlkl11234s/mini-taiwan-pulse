/**
 * R6 段 1（2026-10-05）：非移動物件圖層的 Three.js 效果改為選配。
 * - 每層一個 label「立體效果」的 toggle、預設關、out:null（參數名沿用既有，會員場景相容）
 * - 3D bundle 的載入判斷看各層 toggle（開車站但光柱關不下載 bundle）
 * - 溫度波立體關時改畫 Mapbox 溫度網格，temperatureGrid 自己的行為不變
 * - 段 1 的 lazy 立體模組不進背景預載清單
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getParamsSpec, paramControlCategory, type LayerParamSpec } from "../layerParamsSpec";
import { anyThreeLayerVisible, type ThreeStereoToggles } from "../../hooks/useThreeJsLayers";
import { resolveTemperatureGridDisplay } from "../../map/temperatureGridLayerFactory";
import * as lazy from "../../map/lazyThreeLayers";
import type { LayerVisibility } from "../../types";

/** 段 1 每層 → 它的立體效果參數名 */
const R6_STAGE1_TOGGLES: ReadonlyArray<[layerKey: string, param: string]> = [
  ["earthquakesGlobal", "earthquakesGlobal3D"],
  ["fireStations", "fireStations3D"],
  ["lighthouses", "beamVisible"],
  ["osmPowerLines", "osmPowerLines3D"],
  ["buildingsGba", "buildingsGbaBloom"],
  ["stationsTHSR", "thsrPillarVisible"],
  ["stationsTRA", "traPillarVisible"],
  ["stationsMetro", "metroPillarVisible"],
  ["airports", "airportPillarVisible"],
  ["ports", "portPillarVisible"],
  ["temperatureWave", "tempExtruded"],
  ["wfMonitoring", "wfMonitoring3D"],
];

const findSpec = (key: string, name: string): LayerParamSpec | undefined =>
  getParamsSpec(key)?.find((s) => s.name === name);

describe("R6 段 1：立體效果 toggle 規格", () => {
  it.each(R6_STAGE1_TOGGLES)("%s 有 label「立體效果」的 toggle（%s），預設關、歸顏色組", (key, name) => {
    const spec = findSpec(key, name);
    expect(spec, `${key}.${name} 不存在`).toBeDefined();
    expect(spec).toMatchObject({ kind: "toggle", label: "立體效果", default: false });
    expect(paramControlCategory(spec!)).toBe("color");
  });

  it("每層恰好一個「立體效果」toggle", () => {
    for (const [key] of R6_STAGE1_TOGGLES) {
      const n = (getParamsSpec(key) ?? []).filter((s) => s.kind === "toggle" && s.label === "立體效果").length;
      expect(n, key).toBe(1);
    }
  });

  it("只走 Three.js ref 的 toggle 不進 overlayParams（metroPillarVisible 既有 out 例外保留）", () => {
    for (const [key, name] of R6_STAGE1_TOGGLES) {
      const spec = findSpec(key, name)!;
      if (name === "metroPillarVisible") expect(spec.out).toBe("metroPillar3d");
      else expect(spec.out, `${key}.${name}`).toBeNull();
    }
  });

  it("buildingsGba 的立體效果只在夜景燈光模式（3）出現", () => {
    expect(findSpec("buildingsGba", "buildingsGbaBloom")?.showWhen).toEqual({ param: "buildingsGbaModeIdx", equals: "3" });
  });

  it("Bloom 測試層（powerPlantGlow、substationEhvGlow）維持原樣，不加立體效果", () => {
    for (const key of ["powerPlantGlow", "substationEhvGlow"]) {
      expect((getParamsSpec(key) ?? []).some((s) => s.kind === "toggle" && s.label === "立體效果"), key).toBe(false);
    }
  });
});

const ALL_OFF: ThreeStereoToggles = {
  fireStations3D: false, beamVisible: false,
  thsrPillarVisible: false, traPillarVisible: false, metroPillarVisible: false,
  airportPillarVisible: false, portPillarVisible: false,
  tempExtruded: false, wfMonitoring3D: false,
  // R6 段 2
  wfIncinerator3D: false, wfLandfill3D: false, wfLandfillCoastal3D: false, wfTransfer3D: false, wfMedical3D: false,
};
/** 完整的 LayerVisibility：只有指定 key 為 true，其餘一律 false */
const visOf = (on: Partial<Record<keyof LayerVisibility, boolean>>) =>
  new Proxy(on, { get: (t, k) => (t as Record<string | symbol, boolean>)[k] ?? false }) as unknown as LayerVisibility;
const visOnly = (key: keyof LayerVisibility) => visOf({ [key]: true });

describe("R6 段 1：anyThreeLayerVisible 看各層立體效果", () => {
  const cases: ReadonlyArray<[keyof LayerVisibility, keyof ThreeStereoToggles]> = [
    ["fireStations", "fireStations3D"],
    ["lighthouses", "beamVisible"],
    ["stationsTHSR", "thsrPillarVisible"],
    ["stationsTRA", "traPillarVisible"],
    ["stationsMetro", "metroPillarVisible"],
    ["airports", "airportPillarVisible"],
    ["ports", "portPillarVisible"],
    ["temperatureWave", "tempExtruded"],
    ["wfMonitoring", "wfMonitoring3D"],
  ];

  it.each(cases)("%s 開、立體效果關 → false；立體效果開 → true", (layer, toggle) => {
    expect(anyThreeLayerVisible(visOnly(layer), ALL_OFF)).toBe(false);
    expect(anyThreeLayerVisible(visOnly(layer), { ...ALL_OFF, [toggle]: true })).toBe(true);
  });

  it("立體效果開但圖層關 → false", () => {
    const allOn = Object.fromEntries(Object.keys(ALL_OFF).map((k) => [k, true])) as unknown as ThreeStereoToggles;
    expect(anyThreeLayerVisible(visOf({}), allOn)).toBe(false);
  });

  it("移動物件不受影響（照舊觸發 bundle）；廢棄物設施段 2 起也看立體效果（見 r6Stage2.test.ts）", () => {
    for (const key of ["flights", "ships", "rail", "busLive", "wasteTruck"] as const) {
      expect(anyThreeLayerVisible(visOnly(key), ALL_OFF), key).toBe(true);
    }
  });
});

describe("R6 段 1：溫度波平面改用 Mapbox 溫度網格", () => {
  const base = { gridOpacity: 0.6, waveOpacity: 0.85 };

  it("溫度波開、立體效果關 → 顯示網格，透明度跟溫度波", () => {
    expect(resolveTemperatureGridDisplay({ ...base, gridOn: false, waveOn: true, tempExtruded: false }))
      .toEqual({ visible: true, opacity: 0.85 });
  });

  it("溫度波開、立體效果開 → 不顯示網格（Three.js 溫度波）", () => {
    expect(resolveTemperatureGridDisplay({ ...base, gridOn: false, waveOn: true, tempExtruded: true }).visible).toBe(false);
  });

  it("temperatureGrid 自己開著時行為不變（可見、用自己的透明度），不受溫度波參數影響", () => {
    for (const waveOn of [false, true]) {
      for (const tempExtruded of [false, true]) {
        expect(resolveTemperatureGridDisplay({ ...base, gridOn: true, waveOn, tempExtruded }))
          .toEqual({ visible: true, opacity: 0.6 });
      }
    }
    expect(resolveTemperatureGridDisplay({ ...base, gridOn: false, waveOn: false, tempExtruded: false }).visible).toBe(false);
  });
});

describe("R6 段 1：立體模組不背景預載", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("背景預載清單不會載入立體效果模組（段 1：夜景 bloom／輸電線 glow／地震漣漪；段 2：機組光柱／水庫水位計）", async () => {
    const all = [
      lazy.reservoirLayerModule, lazy.realEstatePointsModule, lazy.gfwV4TrackLayerModule,
      lazy.historicalFlightTrailsModule, lazy.buildingsNightBloomModule, lazy.powerRegionBarsModule,
      lazy.substationEhvGlowModule, lazy.powerPlantGlowModule, lazy.osmPowerLinesGlowModule,
      lazy.powerGenerationBeamModule, lazy.earthquakeRippleModule,
    ];
    const spies = new Map(all.map((m) => [m, vi.spyOn(m, "load").mockResolvedValue({} as never)]));
    await Promise.all(lazy.LAZY_THREE_LAYER_LOADERS.map((load) => load()));
    for (const m of lazy.R6_STEREO_ON_DEMAND_MODULES) expect(spies.get(m as never)).not.toHaveBeenCalled();
    // 其餘（含 Bloom 測試層）照舊預載
    const rest = all.filter((m) => !lazy.R6_STEREO_ON_DEMAND_MODULES.includes(m as never));
    for (const m of rest) expect(spies.get(m)).toHaveBeenCalledTimes(1);
    expect(lazy.R6_STEREO_ON_DEMAND_MODULES).toEqual([
      lazy.buildingsNightBloomModule, lazy.osmPowerLinesGlowModule, lazy.earthquakeRippleModule,
      lazy.powerGenerationBeamModule, lazy.reservoirLayerModule,
    ]);
  });
});
