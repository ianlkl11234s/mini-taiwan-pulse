import { describe, expect, it } from "vitest";
import { LAYER_MANIFEST, MANIFEST_KEYS } from "../layerManifest";
import { LAYER_PARAMS_SPEC, type LayerParamSpec } from "../layerParamsSpec";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";

const OPACITY_BACKLOG: string[] = [];

const CONFIRMED_POINT_SIZE_BACKLOG: string[] = [];

const MAPBOX_POINT_SIZE_BACKLOG: string[] = [];

/** 海事邊界的寬度同時縮放線與 basepoint，故不再新增重複的「大小」控制。 */
const POINT_SIZE_POLICY_EXCEPTIONS = ["maritimeBoundary"] as const;

const NO_PARAMS_BACKLOG = [
  "activeFaults", "aqiStations", "medICUBeds", "powerRegionDemand",
  "powerStatusHud", "submarineCables", "wasteCleaningSquads", "wasteRoute", "wasteScheduleNote",
  "wasteStop", "windPlan",
].sort();

function hasOpacityControl(specs: readonly LayerParamSpec[]): boolean {
  return specs.some((spec) =>
    spec.kind === "slider" && (spec.name.toLowerCase().includes("opacity") || spec.labelPrefix.includes("透明度")),
  );
}

function hasPointSizeControl(specs: readonly LayerParamSpec[]): boolean {
  return specs.some((spec) =>
    spec.kind === "slider" && (
      spec.name.toLowerCase().includes("scale")
      || spec.name.toLowerCase().includes("radius")
      || spec.name.toLowerCase().includes("size")
    ),
  );
}

describe("Layer UX policy baseline", () => {
  it("opacity 缺口維持顯式基線，不能新增靜默遺漏", () => {
    const missing = Object.entries(LAYER_PARAMS_SPEC)
      .filter(([, specs]) => !hasOpacityControl(specs))
      .map(([key]) => key)
      .sort();

    expect(missing).toEqual(OPACITY_BACKLOG);
  });

  it("最後五個 layer 的 Mapbox 子層都登記同一個 opacity multiplier", () => {
    const expected = {
      newsEvents: "newsEventsOpacity",
      ports: "portOpacity",
      stationsMetro: "metroOpacity",
      stationsTHSR: "thsrOpacity",
      stationsTRA: "traOpacity",
    } as const;

    for (const [id, opacityParam] of Object.entries(expected)) {
      const configs = OVERLAY_REGISTRY.filter((overlay) => overlay.id === id);
      expect(configs, `${id} 必須有 OverlayConfig`).not.toHaveLength(0);
      expect(configs.every((overlay) => overlay.opacityParam === opacityParam),
        `${id} 的每個 Mapbox config 都必須乘同一個 opacity`,
      ).toBe(true);
    }

    const news = OVERLAY_REGISTRY.find((overlay) => overlay.id === "newsEvents")!;
    const countPaint = news.layers.find((layer) => layer.suffix === "count")!.paint(true, {});
    expect(countPaint["text-opacity"]).toBe(1);
  });

  it("params: null 的 opacity 缺口維持顯式基線", () => {
    const missing = MANIFEST_KEYS
      .filter((key) => LAYER_MANIFEST[key].params === null)
      .map(String)
      .sort();

    expect(missing).toEqual(NO_PARAMS_BACKLOG);
  });

  it("popup 缺口由既有完整性 ledger 顯式凍結，不能以 null 靜默擴張", () => {
    const missing = MANIFEST_KEYS.filter((key) => LAYER_MANIFEST[key].popup === null);
    expect(missing).toHaveLength(32);
  });

  it("已確認的點位缺口確實沒有大小控件，補齊時必須同步縮小基線", () => {
    for (const key of CONFIRMED_POINT_SIZE_BACKLOG) {
      const specs = LAYER_PARAMS_SPEC[key as keyof typeof LAYER_PARAMS_SPEC];
      expect(specs, `${key} 必須仍有參數規格`).toBeDefined();
      expect(hasPointSizeControl(specs!)).toBe(false);
    }
  });

  it("Overlay registry 的 point layer 都有大小控件，或列在顯式基線", () => {
    const missing = [...new Set(
      OVERLAY_REGISTRY
        .filter((overlay) => overlay.layers.some((layer) => layer.type === "circle" || layer.type === "symbol"))
        .filter((overlay) => {
          if (POINT_SIZE_POLICY_EXCEPTIONS.includes(overlay.id as typeof POINT_SIZE_POLICY_EXCEPTIONS[number])) return false;
          const specs = LAYER_PARAMS_SPEC[overlay.id as keyof typeof LAYER_PARAMS_SPEC] ?? [];
          return !hasPointSizeControl(specs);
        })
        .map((overlay) => overlay.id),
    )].sort();

    expect(missing).toEqual(MAPBOX_POINT_SIZE_BACKLOG);
  });

  it("本批點位大小控件會實際改變 Mapbox 的 circle radius", () => {
    const pointSizeParams = {
      landingStations: "landingScale",
      anfrWirelessSites: "anfrWirelessSitesScale",
      osmCommunicationSites: "osmCommunicationSitesScale",
      ripeAtlasProbes: "ripeAtlasProbesScale",
      canopyGiants: "canopyGiantsScale",
      forestTreatmentWorks: "forestTreatmentWorksScale",
      forestFlatParks: "forestFlatParksScale",
      forestDamLakes: "forestDamLakesScale",
      forestAlishanRail: "forestAlishanRailScale",
      internetExchangePoints: "internetExchangePointsScale",
      evChargingStations: "evChargingScale",
      erHospital: "erHospitalScale",
      librarySeats: "librarySeatsScale",
      lightning: "lightningScale",
      lightningCwa: "lightningCwaScale",
      parkingOffstreet: "parkingOffstreetScale",
      parkingOnstreet: "parkingOnstreetScale",
      waterReservoirs: "waterReservoirsScale",
      powerGenerationUnit: "powerGenerationScale",
      industrialRefinery: "industrialRefineryScale",
      industrialStorageTank: "industrialStorageTankScale",
      industrialPowerPlant: "industrialPowerPlantScale",
    } as const;

    for (const [id, param] of Object.entries(pointSizeParams)) {
      const circles = OVERLAY_REGISTRY
        .filter((entry) => entry.id === id)
        .flatMap((overlay) => overlay.layers.filter((entry) => entry.type === "circle"));
      expect(circles, `${id} 必須有 circle renderer`).not.toHaveLength(0);
      for (const layer of circles) {
        const radiusAtOne = layer.paint(false, { [param]: 1 })["circle-radius"];
        const radiusAtTwo = layer.paint(false, { [param]: 2 })["circle-radius"];
        expect(radiusAtTwo, `${id}/${layer.suffix} 大小控件必須影響半徑`).not.toEqual(radiusAtOne);
      }
    }
  });

  it("海事邊界以單一寬度控制同步縮放線與 basepoint", () => {
    const overlay = OVERLAY_REGISTRY.find((entry) => entry.id === "maritimeBoundary");
    expect(overlay).toBeDefined();
    const line = overlay!.layers.find((entry) => entry.suffix === "line")!;
    const point = overlay!.layers.find((entry) => entry.suffix === "point")!;
    expect(line.paint(false, { maritimeBoundaryWidth: 2 })["line-width"])
      .not.toEqual(line.paint(false, { maritimeBoundaryWidth: 1 })["line-width"]);
    expect(point.paint(false, { maritimeBoundaryWidth: 2 })["circle-radius"])
      .not.toEqual(point.paint(false, { maritimeBoundaryWidth: 1 })["circle-radius"]);
  });
});
