import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAYER_PARAMS_SPEC } from "../../data/layerParamsSpec";
import { EXTRUSION, RASTER } from "../mapStyleScale";
import { OVERLAY_REGISTRY } from "../overlayRegistry";

type Param = { name?: string; default?: unknown; min?: unknown; max?: unknown };
type Paint = Record<string, unknown>;

function slider(key: string, name: string): Param {
  return ((LAYER_PARAMS_SPEC as Record<string, readonly Param[]>)[key] ?? [])
    .find((param) => param.name === name) ?? {};
}

function extrusion(id: string, sourceId?: string) {
  const config = OVERLAY_REGISTRY.find((item) => item.id === id && (sourceId === undefined || item.sourceId === sourceId));
  return config?.layers.find((layer) => layer.suffix === "extrusion");
}

function paint(layer: ReturnType<typeof extrusion>, dark: boolean, params: Record<string, number>): Paint {
  return layer!.paint(dark, params) as Paint;
}

describe("R3b G4 / T3 / F4 style contract", () => {
  it("九個 raster slider 共用 .7 與 .3–1 的 SSOT", () => {
    const keys = [
      ["jpWaterFloodHazard", "jpWaterFloodHazardOpacity"], ["dustForecast", "dustForecastOpacity"],
      ["canopyHeight", "canopyHeightOpacity"], ["jpCanopyHeight", "jpCanopyHeightOpacity"],
      ["urbanHeat", "urbanHeatOpacity"], ["precipRaster", "precipRasterOpacity"],
      ["cwaCloudImagery", "cwaCloudOpacity"], ["cwaRadarImagery", "cwaRadarOpacity"],
      ["aqiImagery", "aqiImageryOpacity"],
    ];
    for (const [key, name] of keys) {
      expect(slider(key!, name!), `${key}/${name}`).toMatchObject({
        default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax,
      });
    }
  });

  it("registry raster 一律 nearest，避免量化值在像素邊界混色", () => {
    for (const id of ["urbanHeat", "canopyHeight", "jpCanopyHeight"]) {
      const layer = OVERLAY_REGISTRY.find((item) => item.id === id)!.layers.find((item) => item.type === "raster")!;
      expect(layer.paint(false, {})["raster-resampling"], id).toBe("nearest");
    }
  });

  it("三個 registry extrusion 在亮暗主題均以 .85 正規化、clamp、gradient，關閉時為零", () => {
    const cases: Array<[string, string | undefined, Record<string, number>, Record<string, number>]> = [
      ["propertyValueGrid", undefined, { propertyValueGridExtruded: 1 }, { propertyValueGridExtruded: 1, propertyValueGridOpacity: 2 }],
      ["buildingsGba", undefined, { buildingsGbaModeIdx: 2 }, { buildingsGbaModeIdx: 2, buildingsGbaOpacity: 2 }],
      ["jpBuildingHeight", "jp-building-height", { jpBuildingHeightModeIdx: 1 }, { jpBuildingHeightModeIdx: 1, jpBuildingHeightOpacity: 2 }],
    ];
    for (const [id, sourceId, enabled, clamped] of cases) for (const dark of [false, true]) {
      const layer = extrusion(id, sourceId);
      const off = paint(layer, dark, {});
      const on = paint(layer, dark, enabled);
      const max = paint(layer, dark, clamped);
      expect(off["fill-extrusion-opacity"], `${id} off`).toBe(0);
      expect(on["fill-extrusion-opacity"], `${id} default`).toBe(EXTRUSION.opacity);
      expect(max["fill-extrusion-opacity"], `${id} clamp`).toBe(1);
      expect(on["fill-extrusion-vertical-gradient"], `${id} gradient`).toBe(true);
      expect(on["fill-extrusion-height"], `${id} physical height`).not.toBe(1);
    }
    expect(slider("propertyValueGrid", "propertyValueGridElevationScale").default).toBe(EXTRUSION.heightMultiplier);
    expect(JSON.stringify(paint(extrusion("propertyValueGrid"), false, { propertyValueGridExtruded: 1 })["fill-extrusion-height"])).toContain("40");
  });

  it("五個 POI label 保留門檻，visitor 調為 13、toilets 仍為 16", () => {
    const expected = { publicWasteBaskets: 15, materialRecyclingPoints: 14, playgrounds: 14, visitorCentres: 13, publicToilets: 16 };
    for (const [id, minzoom] of Object.entries(expected)) {
      expect(OVERLAY_REGISTRY.find((item) => item.id === id)?.layers.find((item) => item.suffix === "label")?.minzoom, id).toBe(minzoom);
    }
  });

  it("三個動態 count badge 保留 overlap；GFW 仍以 vessel_count step 決定字級", () => {
    const global = readFileSync(new URL("../../hooks/useGlobalEventsLayer.ts", import.meta.url), "utf8");
    const micro = readFileSync(new URL("../../hooks/useMicroSensorsLayer.ts", import.meta.url), "utf8");
    const gfw = readFileSync(new URL("../../hooks/useGfwHourlyGridLayer.ts", import.meta.url), "utf8");
    expect(global).toContain("...badgeLabelLayout()");
    expect(global).toContain("...labelHaloPaint(isDarkTheme)");
    for (const source of [micro, gfw]) {
      expect(source).toContain('"text-allow-overlap": true');
      expect(source).toContain('"text-ignore-placement": true');
    }
    expect(micro).toContain("...labelHaloPaint(isDark)");
    expect(gfw).toContain('"text-halo-width": LABEL.haloWidth');
    expect(gfw).toContain('["step", ["get", "vessel_count"], 10, 10, 11, 50, 12]');
  });

  it("MicroSensors 主題切換只走 paint，不重建 cluster source 或 GeoJSON", () => {
    const micro = readFileSync(new URL("../../hooks/useMicroSensorsLayer.ts", import.meta.url), "utf8");
    expect(micro).toContain("const themeRef = useRef(isDark)");
    expect(micro).toContain("ensureLayers(m, themeRef.current, cluster");
    expect(micro).not.toContain("[mapRef, visible, isDark, cluster, mapTick]");
    expect(micro).toContain('map.setPaintProperty(LAYER_CLUSTER_COUNT, "text-halo-color"');
  });
});
