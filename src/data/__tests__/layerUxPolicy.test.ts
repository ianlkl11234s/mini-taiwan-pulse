import { describe, expect, it } from "vitest";
import { LAYER_MANIFEST, MANIFEST_KEYS } from "../layerManifest";
import { LAYER_PARAMS_SPEC, type LayerParamSpec } from "../layerParamsSpec";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";

const OPACITY_BACKLOG = [
  "aqiMicroSensors", "busLive", "busIntercityLive", "freewayCongestion", "newsEvents",
  "ports", "stationsMetro", "stationsTHSR", "stationsTRA", "wasteSchedule", "wasteTruck",
].sort();

const CONFIRMED_POINT_SIZE_BACKLOG = [
  "anfrWirelessSites", "erHospital", "evChargingStations", "fireLatest",
  "internetExchangePoints", "librarySeats", "osmCommunicationSites",
  "parkingOffstreet", "parkingOnstreet", "ripeAtlasProbes",
].sort();

const MAPBOX_POINT_SIZE_BACKLOG = [
  "anfrWirelessSites", "canopyGiants", "erHospital", "evChargingStations", "forestAlishanRail",
  "forestDamLakes", "forestFlatParks", "forestTreatmentWorks", "industrialPowerPlant",
  "industrialRefinery", "industrialStorageTank", "internetExchangePoints", "landingStations",
  "librarySeats", "lightning", "lightningCwa", "maritimeBoundary", "osmCommunicationSites",
  "parkingOffstreet", "parkingOnstreet", "powerGenerationUnit", "ripeAtlasProbes", "waterReservoirs",
].sort();

const NO_PARAMS_BACKLOG = [
  "activeFaults", "aqiStations", "landingStations", "medICUBeds", "powerRegionDemand",
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
});
