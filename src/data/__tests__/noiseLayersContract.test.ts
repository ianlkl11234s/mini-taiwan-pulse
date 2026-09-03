/**
 * 噪音／聲響六層的下游發布契約。
 *
 * 這裡刻意同時守 asset readback 與 registry：前者避免「toggle 有了但資料漂掉」，
 * 後者避免「資產正確但 zoom/filter/source 接錯」。六層語意不同，不建立綜合分數。
 */
import { describe, expect, it } from "vitest";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
} from "node:fs";
import { PMTiles } from "pmtiles";

import { LAYER_MANIFEST } from "../layerManifest";
import { LAYER_PARAMS_SPEC } from "../layerParamsSpec";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";

const ENVIRONMENT = "public/environment";
const NOISE_CAPTURE_ASSET = `${ENVIRONMENT}/noise_capture_grid.pmtiles`;
const NOISE_CONTROL_ASSET = `${ENVIRONMENT}/noise_control_zones.pmtiles`;

class NodeFileSource {
  constructor(private readonly path: string) {}
  getKey() {
    return this.path;
  }
  async getBytes(offset: number, length: number) {
    const fd = openSync(this.path, "r");
    try {
      const buf = Buffer.alloc(length);
      readSync(fd, buf, 0, length, offset);
      return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
    } finally {
      closeSync(fd);
    }
  }
}

interface TileStatsAttribute {
  attribute: string;
  values?: unknown[];
  min?: number;
  max?: number;
}
interface TileStatsLayer {
  layer: string;
  count: number;
  geometry: string;
  attributes: TileStatsAttribute[];
}
interface PmtilesMetadata {
  attribution?: string;
  license?: string;
  source_layer_zoom_contract?: Record<string, [number, number]>;
  tilestats?: { layers?: TileStatsLayer[] };
}

async function metadata(path: string): Promise<PmtilesMetadata> {
  return await new PMTiles(new NodeFileSource(path) as never).getMetadata() as PmtilesMetadata;
}

function loadGeojson(name: string): GeoJSON.Feature[] {
  const path = `${ENVIRONMENT}/${name}`;
  expect(existsSync(path), `${path} 不存在，localhost layer 會空白`).toBe(true);
  const data = JSON.parse(readFileSync(path, "utf8")) as GeoJSON.FeatureCollection;
  expect(data.type).toBe("FeatureCollection");
  return data.features;
}

function expectFields(features: GeoJSON.Feature[], fields: readonly string[], label: string) {
  const missing: string[] = [];
  for (const [i, feature] of features.entries()) {
    const props = feature.properties ?? {};
    for (const field of fields) {
      if (!Object.prototype.hasOwnProperty.call(props, field)) missing.push(`${i}:${field}`);
    }
  }
  expect(missing, `${label} 缺前端硬依賴欄位`).toEqual([]);
}

function countBy(features: GeoJSON.Feature[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const feature of features) {
    const value = String(feature.properties?.[field]);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function fieldsOf(layer: TileStatsLayer): Set<string> {
  return new Set(layer.attributes.map((a) => a.attribute));
}

const OFFICIAL_FIELDS = [
  "feature_id", "station_id", "station_name", "station_type", "county", "address",
  "station_status", "area_type", "period_type", "laeq_window_db", "window_start",
  "window_end", "latest_observation_date", "sample_count", "active_days", "window_days",
  "active_day_ratio", "represented_seconds", "freshness_days", "freshness_status",
  "source_dataset_id", "source_updated_at", "spatial_precision", "built_at",
] as const;

const NOISE_CAPTURE_FIELDS = [
  "grid_id", "scale_m", "laeq_energy_db", "typical_track_laeq_db", "la50_db",
  "measure_seconds", "track_count", "active_days", "daypart_count",
  "measurement_start_date", "measurement_end_date", "freshness_days", "freshness_class",
  "quality_tier", "gps_accuracy_p50", "source_kind", "source_snapshot_at", "built_at",
  "is_provisional",
] as const;

const AVIATION_FIELDS = [
  "zone_id", "county", "town", "village", "village_code", "zone_levels",
  "display_zone_level", "membership_count", "legal_unit", "legal_version",
  "effective_date", "boundary_version", "spatial_precision", "is_measured_contour",
  "source_dataset_id", "source_org", "source_url", "source_updated_at", "source_license",
  "built_at", "area_km2",
] as const;

const CAMERA_FIELDS = [
  "location_id", "location_name", "county", "expected_town", "raw_location",
  "full_address", "source_dataset_id", "geocode_method", "geocode_reference",
  "spatial_precision", "spatial_validation_status", "is_renderable", "boundary_county",
  "boundary_town", "boundary_village", "equipment_status", "represents", "source_org",
  "source_url", "source_updated_at", "built_at",
] as const;

describe("噪音／聲響發布資產", () => {
  it("五個新發布副本存在；裁處沒有第二份 noise 專屬 PMTiles", () => {
    const trackedAssets = [
      "official_noise_monitoring.geojson",
      "aviation_noise_zones.geojson",
      "sound_camera_locations.geojson",
    ];
    expect(trackedAssets.filter((name) => !existsSync(`${ENVIRONMENT}/${name}`))).toEqual([]);

    // PMTiles 走既有 deploy-assets/S3，不進 Git；clean clone 可缺檔，實際發布前另跑
    // pmtiles verify + localhost HTTP readback。本機有檔時，下方 metadata tests 會完整驗證。
    for (const path of [NOISE_CAPTURE_ASSET, NOISE_CONTROL_ASSET]) {
      if (!existsSync(path)) console.warn(`⚠ ${path} 本機不存在（deploy-assets 管理），略過內容驗證`);
    }

    const noisePenaltyCopies = [
      ...readdirSync(ENVIRONMENT).map((name) => `environment/${name}`),
      ...readdirSync("public/geo").map((name) => `geo/${name}`),
    ].filter((name) => /noise.*(?:enforcement|penalt).*\.pmtiles/i.test(name));
    expect(noisePenaltyCopies, "不可複製 noise_enforcement／noise_penalty 第二份大檔").toEqual([]);
  });

  it("official：426 mixed-grain features／320 站，保留 11 null geometry 與 267 unavailable", () => {
    const features = loadGeojson("official_noise_monitoring.geojson");
    expectFields(features, OFFICIAL_FIELDS, "officialNoiseMonitoring");
    expect(features).toHaveLength(426);
    expect(new Set(features.map((f) => f.properties?.station_id)).size).toBe(320);
    expect(features.filter((f) => f.geometry !== null)).toHaveLength(415);
    expect(features.filter((f) => f.geometry === null)).toHaveLength(11);
    expect(countBy(features, "period_type")).toEqual({
      day: 53, evening: 53, night: 53, unavailable: 267,
    });
    expect(countBy(features, "freshness_status")).toEqual({
      fresh: 15, historical: 144, unavailable: 267,
    });

    const unavailable = features.filter((f) => f.properties?.freshness_status === "unavailable");
    expect(unavailable.every((f) => f.properties?.laeq_window_db === null)).toBe(true);
    expect(unavailable.every((f) => f.properties?.sample_count === 0)).toBe(true);
    const measured = features.filter((f) => f.properties?.period_type !== "unavailable");
    expect(measured).toHaveLength(159);
    expect(measured.every((f) => typeof f.properties?.laeq_window_db === "number")).toBe(true);
  });

  it.skipIf(!existsSync(NOISE_CAPTURE_ASSET))(
    "NoiseCapture：三 source-layer 共 5 格，5/5 provisional，沒有放寬 active-day gate",
    async () => {
    const md = await metadata(NOISE_CAPTURE_ASSET);
    const layers = md.tilestats?.layers ?? [];
    const expected = {
      noise_capture_1000m: { count: 1, scale: 1000, zoom: [7, 10] },
      noise_capture_500m: { count: 1, scale: 500, zoom: [11, 12] },
      noise_capture_250m: { count: 3, scale: 250, zoom: [13, 15] },
    } as const;
    expect(layers.map((l) => l.layer).sort()).toEqual(Object.keys(expected).sort());
    expect(layers.reduce((sum, layer) => sum + layer.count, 0)).toBe(5);
    expect(md.source_layer_zoom_contract).toEqual({
      noise_capture_1000m: [7, 10],
      noise_capture_250m: [13, 15],
      noise_capture_500m: [11, 12],
    });
    expect(md.attribution).toContain("NoiseCapture / Noise-Planet contributors");
    expect(md.license).toContain("ODbL-1.0");

    for (const layer of layers) {
      const contract = expected[layer.layer as keyof typeof expected];
      expect(layer.count, `${layer.layer} feature count 漂移`).toBe(contract.count);
      expect(layer.geometry).toBe("Polygon");
      expect([...fieldsOf(layer)].sort()).toEqual([...NOISE_CAPTURE_FIELDS].sort());
      const attrs = Object.fromEntries(layer.attributes.map((a) => [a.attribute, a]));
      expect(attrs.scale_m?.values).toEqual([contract.scale]);
      expect(attrs.is_provisional?.values).toEqual([true]);
      expect(attrs.active_days?.min, `${layer.layer} 不可低於 3 active days`).toBeGreaterThanOrEqual(3);
    }
    },
  );

  it.skipIf(!existsSync(NOISE_CONTROL_ASSET))(
    "noiseControlZones：臺中四類 polygon 與非空 PMTiles 欄位契約",
    async () => {
    const md = await metadata(NOISE_CONTROL_ASSET);
    const layers = md.tilestats?.layers ?? [];
    expect(layers).toHaveLength(1);
    const layer = layers[0]!;
    expect(layer.layer).toBe("noise_control_zones");
    expect(layer.count).toBe(4);
    expect(layer.geometry).toBe("Polygon");
    const fields = fieldsOf(layer);
    for (const field of [
      "zone_id", "county", "zone_class", "zone_name", "legal_version",
      "effective_year_roc", "effective_year", "spatial_precision", "geometry_repaired",
      "source_dataset_id", "source_org", "source_url", "source_license", "source_hash",
      "built_at", "area_km2",
    ]) expect(fields.has(field), `noise_control_zones 缺 ${field}`).toBe(true);
    // v1 announcement_no 四筆全 null，tippecanoe 會省略全 null attribute；UI 必須 fallback。
    expect(fields.has("announcement_no")).toBe(false);
    const attrs = Object.fromEntries(layer.attributes.map((a) => [a.attribute, a]));
    expect(attrs.county?.values).toEqual(["臺中市"]);
    expect(attrs.zone_class?.values).toEqual([1, 2, 3, 4]);
    expect(attrs.geometry_repaired?.values).toEqual([false, true]);
    },
  );

  it("aviation：76 法定村里／103 memberships，全為 admin_join 且不是 DNL contour", () => {
    const features = loadGeojson("aviation_noise_zones.geojson");
    expectFields(features, AVIATION_FIELDS, "aviationNoiseZones");
    expect(features).toHaveLength(76);
    expect(countBy(features, "county")).toEqual({ 桃園市: 31, 高雄市: 45 });
    expect(features.reduce((sum, f) => sum + Number(f.properties?.membership_count ?? 0), 0)).toBe(103);
    expect(features.every((f) => f.geometry !== null)).toBe(true);
    expect(features.every((f) => f.properties?.spatial_precision === "admin_join")).toBe(true);
    expect(features.every((f) => f.properties?.is_measured_contour === false)).toBe(true);
    expect(features.every((f) => f.properties?.effective_date === null)).toBe(true);
  });

  it("camera：333 清單＝267 可畫＋66 pending；pending 保持 null geometry", () => {
    const features = loadGeojson("sound_camera_locations.geojson");
    expectFields(features, CAMERA_FIELDS, "soundCameraLocations");
    expect(features).toHaveLength(333);
    expect(countBy(features, "county")).toEqual({ 彰化縣: 9, 臺南市: 324 });
    expect(countBy(features, "spatial_precision")).toEqual({
      fuzzy: 57, geocoded_address: 75, road_segment: 135, unlocated: 66,
    });
    const renderable = features.filter((f) => f.properties?.is_renderable === true);
    const pending = features.filter((f) => f.properties?.is_renderable === false);
    expect(renderable).toHaveLength(267);
    expect(pending).toHaveLength(66);
    expect(renderable.every((f) => f.geometry?.type === "Point")).toBe(true);
    expect(pending.every((f) => f.geometry === null)).toBe(true);
    expect(pending.every((f) => f.properties?.spatial_precision === "unlocated")).toBe(true);
  });
});

type AnyManifestSource = {
  kind: string;
  sourceId?: string;
  url?: string;
  sourceLayer?: string;
  minzoom?: number;
  maxzoom?: number;
};
type AnyOverlay = {
  id: string;
  sourceUrl: string;
  sourceId: string;
  attribution?: string;
  pmtiles?: { sourceLayer?: string; minzoom: number; maxzoom: number };
  filter?: unknown[] | ((params?: Record<string, number>) => unknown[]);
  rebuildOnParamChange?: string[];
  layers: {
    suffix: string;
    minzoom?: number;
    maxzoom?: number;
    filter?: unknown[] | ((params?: Record<string, number>) => unknown[]);
    paint: (isDark: boolean, params?: Record<string, number>) => Record<string, unknown>;
  }[];
};

const manifest = LAYER_MANIFEST as unknown as Record<string, { source: AnyManifestSource | AnyManifestSource[] }>;
const overlays = OVERLAY_REGISTRY as unknown as AnyOverlay[];
const specs = LAYER_PARAMS_SPEC as unknown as Record<string, {
  kind: string;
  name: string;
  default: unknown;
  options?: readonly { label: string; value: string }[];
  out?: string | null;
  encode?: readonly string[];
}[]>;

function filtersOf(config: AnyOverlay, params: Record<string, number> = {}): unknown[] {
  const filters = [config.filter, ...config.layers.map((layer) => layer.filter)].filter(Boolean);
  return filters.map((filter) => typeof filter === "function" ? filter(params) : filter);
}

describe("噪音／聲響 registry 與 filter 契約", () => {
  const keys = [
    "officialNoiseMonitoring", "noiseCaptureGrid", "noiseControlZones",
    "aviationNoiseZones", "noiseEnforcementEvents", "soundCameraLocations",
  ];

  it("六個獨立 manifest key 都存在；三個 GeoJSON source 不帶 source-layer", () => {
    expect(keys.filter((key) => !manifest[key])).toEqual([]);
    for (const key of ["officialNoiseMonitoring", "aviationNoiseZones", "soundCameraLocations"]) {
      const source = manifest[key]!.source as AnyManifestSource;
      expect(source.kind).toBe("geojson");
      expect(source.sourceLayer, `${key} GeoJSON 不可帶 source-layer`).toBeUndefined();
    }
  });

  it("NoiseCapture 是單一 layer key、共用一個 sourceId/URL、三個 source-layer 與互斥 style zoom gate", () => {
    const configs = overlays.filter((config) => config.id === "noiseCaptureGrid");
    expect(configs).toHaveLength(3);
    expect(new Set(configs.map((c) => c.sourceId))).toEqual(new Set(["noise-capture-grid"]));
    expect(new Set(configs.map((c) => c.sourceUrl))).toEqual(new Set(["./environment/noise_capture_grid.pmtiles"]));
    expect(configs.every((c) => c.attribution?.includes("NoiseCapture / Noise-Planet contributors"))).toBe(true);

    const expected = {
      noise_capture_1000m: [7, 11],
      noise_capture_500m: [11, 13],
      noise_capture_250m: [13, 16],
    } as const;
    for (const config of configs) {
      expect(config.pmtiles?.minzoom).toBe(7);
      expect(config.pmtiles?.maxzoom).toBe(15);
      const gate = expected[config.pmtiles?.sourceLayer as keyof typeof expected];
      expect(gate, `未知 source-layer ${config.pmtiles?.sourceLayer}`).toBeTruthy();
      expect(config.layers).toHaveLength(2); // fill + outline，同尺度 gate
      for (const layer of config.layers) {
        expect([layer.minzoom, layer.maxzoom]).toEqual(gate);
      }
      expect(
        config.layers.some((layer) => JSON.stringify(layer.paint(false)).includes("laeq_energy_db")),
        `${config.pmtiles?.sourceLayer} 至少一個 fill style 必須依 LAeq 分色`,
      ).toBe(true);
    }
  });

  it("official period 是日／晚／夜單選，預設 day；每個 period filter 都保留 unavailable", () => {
    const select = specs.officialNoiseMonitoring?.find((spec) => spec.kind === "select");
    expect(select).toMatchObject({
      name: "officialNoiseMonitoringPeriod",
      default: "day",
      out: "officialNoiseMonitoringPeriodIdx",
      encode: ["day", "evening", "night"],
    });
    expect(select?.options?.map((option) => option.value)).toEqual(["day", "evening", "night"]);

    const config = overlays.find((item) => item.id === "officialNoiseMonitoring");
    expect(config).toBeTruthy();
    expect(config?.rebuildOnParamChange).toContain("circle");
    for (const [idx, period] of ["day", "evening", "night"].entries()) {
      expect(filtersOf(config!, { officialNoiseMonitoringPeriodIdx: idx })).toContainEqual([
        "any",
        ["==", ["get", "period_type"], period],
        ["==", ["get", "freshness_status"], "unavailable"],
      ]);
    }
  });

  it("noiseControl／aviation source contract 對準正式資產；GeoJSON 仍不帶 source-layer", () => {
    const control = manifest.noiseControlZones!.source as AnyManifestSource;
    expect(control).toEqual(expect.objectContaining({
      kind: "pmtiles", url: "./environment/noise_control_zones.pmtiles",
      sourceLayer: "noise_control_zones", minzoom: 6, maxzoom: 15,
    }));
    const aviation = manifest.aviationNoiseZones!.source as AnyManifestSource;
    expect(aviation).toEqual(expect.objectContaining({
      kind: "geojson", url: "./environment/aviation_noise_zones.geojson",
    }));
    expect(aviation.sourceLayer).toBeUndefined();
  });

  it("noiseEnforcementEvents 只重用既有 pollution source/asset，固定 event_medium=noise", () => {
    const source = manifest.noiseEnforcementEvents!.source as AnyManifestSource;
    expect(source).toEqual(expect.objectContaining({
      kind: "pmtiles", sourceId: "pollution-penalty",
      url: "./geo/pollution_penalties.pmtiles", sourceLayer: "pollution_penalties",
      minzoom: 5, maxzoom: 14,
    }));
    const configs = overlays.filter((config) => config.id === "noiseEnforcementEvents");
    expect(configs).toHaveLength(1);
    expect(configs[0]).toEqual(expect.objectContaining({
      sourceId: "pollution-penalty",
      sourceUrl: "./geo/pollution_penalties.pmtiles",
    }));
    expect(JSON.stringify(filtersOf(configs[0]!))).toContain('["==",["get","event_medium"],"noise"]');
  });

  it("sound camera 任何 precision filter 都先守 is_renderable=true", () => {
    const select = specs.soundCameraLocations?.find((spec) => spec.kind === "select");
    expect(select).toMatchObject({
      name: "soundCameraLocationsPrecision",
      default: "all",
      out: "soundCameraLocationsPrecisionIdx",
      encode: ["all", "geocoded_address", "road_segment", "fuzzy"],
    });
    const config = overlays.find((item) => item.id === "soundCameraLocations");
    expect(config).toBeTruthy();
    for (let idx = 0; idx < 4; idx++) {
      const serialized = JSON.stringify(filtersOf(config!, { soundCameraLocationsPrecisionIdx: idx }));
      expect(serialized).toContain("is_renderable");
      expect(serialized).toContain("true");
    }
  });
});
