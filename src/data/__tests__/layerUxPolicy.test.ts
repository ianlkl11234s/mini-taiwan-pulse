import { describe, expect, it } from "vitest";
import { LAYER_MANIFEST, MANIFEST_KEYS } from "../layerManifest";
import { LAYER_PARAMS_SPEC, type LayerParamSpec } from "../layerParamsSpec";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";

const OPACITY_BACKLOG = [
  "newsEvents", "ports", "stationsMetro", "stationsTHSR", "stationsTRA",
].sort();

const CONFIRMED_POINT_SIZE_BACKLOG = [
  "erHospital", "evChargingStations", "fireLatest", "internetExchangePoints",
  "librarySeats", "parkingOffstreet", "parkingOnstreet",
].sort();

const MAPBOX_POINT_SIZE_BACKLOG = [
  "erHospital", "evChargingStations", "industrialPowerPlant", "industrialRefinery",
  "industrialStorageTank", "internetExchangePoints", "librarySeats", "lightning", "lightningCwa",
  "maritimeBoundary", "parkingOffstreet", "parkingOnstreet", "powerGenerationUnit", "waterReservoirs",
].sort();

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
    } as const;

    for (const [id, param] of Object.entries(pointSizeParams)) {
      const overlay = OVERLAY_REGISTRY.find((entry) => entry.id === id);
      expect(overlay, `${id} 必須有 OverlayConfig`).toBeDefined();
      for (const layer of overlay!.layers.filter((entry) => entry.type === "circle")) {
        const radiusAtOne = layer.paint(false, { [param]: 1 })["circle-radius"];
        const radiusAtTwo = layer.paint(false, { [param]: 2 })["circle-radius"];
        expect(radiusAtTwo, `${id}/${layer.suffix} 大小控件必須影響半徑`).not.toEqual(radiusAtOne);
      }
    }
  });
});
