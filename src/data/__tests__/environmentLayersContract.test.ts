import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DRINKING_WATER_ZONE_TYPES, RIVER_RPI_CLASSES, SEWAGE_UNCERTAIN_QUALITIES, WATER_QUALITY_STATION_TYPES,
  riverRpiClassFilter, waterQualityStationTypeFilter,
} from "../environmentLayerTypes";
import { LAYER_MANIFEST } from "../layerManifest";

type Collection = { features: Array<{ properties: Record<string, unknown>; geometry: { type: string } }> };
const read = (name: string) => JSON.parse(readFileSync(resolve("public/environment", name), "utf8")) as Collection;

describe("水質與污水靜態圖層資產", () => {
  it("RPI 四級完整覆蓋上游等級，且等級篩選不會吃掉其他等級", () => {
    const features = read("river_rpi_stations.geojson").features;
    expect(features).toHaveLength(311);
    const classes = new Set(features.map((feature) => feature.properties.latest_class).filter(Boolean));
    expect([...classes].every((value) => RIVER_RPI_CLASSES.some((row) => row.value === value))).toBe(true);
    expect(riverRpiClassFilter(0)).toEqual(["all"]);
    expect(riverRpiClassFilter(4)).toEqual(["==", ["get", "latest_class"], "嚴重污染"]);
  });

  it("水質測站三類型與無讀值都有對應呈現", () => {
    const features = read("water_quality_stations.geojson").features;
    expect(features).toHaveLength(1842);
    expect(new Set(features.map((feature) => feature.properties.station_type))).toEqual(new Set(WATER_QUALITY_STATION_TYPES.map((row) => row.value)));
    expect(features.some((feature) => feature.properties.latest_sample_date == null)).toBe(true);
    expect(waterQualityStationTypeFilter(2)).toEqual(["==", ["get", "station_type"], "groundwater"]);
  });

  it("污水處理廠位置不確定者恰為 14 處", () => {
    const features = read("sewage_treatment_plants.geojson").features;
    expect(features).toHaveLength(82);
    expect(features.filter((feature) => (SEWAGE_UNCERTAIN_QUALITIES as readonly unknown[]).includes(feature.properties.geocode_quality))).toHaveLength(14);
  });

  it("飲用水水源水質保護區（環境部）與水利署管制區分開、不同色", () => {
    const features = read("drinking_water_protection_zones.geojson").features;
    expect(features).toHaveLength(134);
    expect(new Set(features.map((feature) => feature.properties.zone_type))).toEqual(new Set(DRINKING_WATER_ZONE_TYPES.map((row) => row.value)));
    const ours = LAYER_MANIFEST.drinkingWaterProtectionZones;
    const wra = LAYER_MANIFEST.waterProtectionZones;
    expect(ours.source).not.toEqual(wra.source);
    expect(ours.color).not.toBe(wra.color);
    expect(ours.label).toContain("環境部");
  });
});
