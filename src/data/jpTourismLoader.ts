import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

export type JpTourismDataset =
  | "accommodation-canonical" | "accommodation-jta" | "accommodation-local" | "accommodation-osm"
  | "natural-parks" | "nature-conservation" | "wildlife-protection"
  | "world-natural-heritage-historical" | "world-heritage-unesco" | "ramsar" | "marine-ebsa";

interface DatasetBase {
  file: string;
  label: string;
  /** false = local research only; production must neither request nor publish the asset. */
  production: boolean;
}

export interface JpTourismGeoJsonDataset extends DatasetBase {
  kind: "geojson";
  propertyDefaults?: Record<string, unknown>;
}

export interface JpTourismPmtilesDataset extends DatasetBase {
  kind: "pmtiles";
  sourceLayer: string;
  minzoom: number;
  maxzoom: number;
}

export type JpTourismDatasetConfig = JpTourismGeoJsonDataset | JpTourismPmtilesDataset;

const BASE = `${import.meta.env.BASE_URL ?? "/"}world`;
const CACHE_TTL_MS = 30 * 60_000;

export const JP_TOURISM_DATASETS: Record<JpTourismDataset, JpTourismDatasetConfig> = {
  "accommodation-canonical": {
    kind: "pmtiles", file: "jp_accommodation_canonical_20260910.pmtiles", label: "日本旅宿去重總覽",
    sourceLayer: "jp_accommodation_canonical", minzoom: 3, maxzoom: 14, production: true,
  },
  "accommodation-jta": {
    kind: "geojson", file: "jp_accommodation_jta_20260331.geojson", label: "日本觀光廳登錄旅宿", production: true,
  },
  "accommodation-local": {
    kind: "geojson", file: "jp_accommodation_local_20260910.geojson", label: "日本地方旅館業許可", production: true,
  },
  "accommodation-osm": {
    kind: "pmtiles", file: "jp_accommodation_osm_20260910.pmtiles", label: "日本 OSM 住宿",
    sourceLayer: "jp_accommodation_osm", minzoom: 3, maxzoom: 14, production: true,
  },
  "natural-parks": {
    kind: "pmtiles", file: "jp_natural_parks_ksj_2010.pmtiles", label: "日本自然公園 historical",
    sourceLayer: "jp_natural_parks_ksj_2010", minzoom: 4, maxzoom: 12, production: false,
  },
  "nature-conservation": {
    kind: "pmtiles", file: "jp_nature_conservation_ksj_2015.pmtiles", label: "日本自然保全地域 historical",
    sourceLayer: "jp_nature_conservation_ksj_2015", minzoom: 4, maxzoom: 12, production: false,
  },
  "wildlife-protection": {
    kind: "pmtiles", file: "jp_wildlife_protection_moe_202504.pmtiles", label: "日本鳥獸保護區",
    sourceLayer: "jp_wildlife_protection_moe_202504", minzoom: 4, maxzoom: 12, production: false,
  },
  "world-natural-heritage-historical": {
    kind: "geojson", file: "jp_world_natural_heritage_ksj_2011.geojson", label: "日本世界自然遺產 historical", production: false,
  },
  "world-heritage-unesco": {
    kind: "geojson", file: "jp_world_heritage_unesco_current.geojson", label: "日本 UNESCO 世界遺產", production: true,
    propertyDefaults: {
      source_name: "UNESCO World Heritage Centre",
      license: "CC BY-SA 4.0",
      license_status: "CC_BY_SA_4_0",
      geometry_status: "REPRESENTATIVE_POINT",
      geometry_caveat: "代表點，不是 UNESCO property boundary",
    },
  },
  ramsar: {
    kind: "geojson", file: "jp_ramsar_moe_current.geojson", label: "日本 Ramsar 濕地", production: false,
    propertyDefaults: { license_status: "LICENSE_UNVERIFIED", geometry_status: "HOLD_GEOMETRY" },
  },
  "marine-ebsa": {
    kind: "pmtiles", file: "jp_marine_ebsa_moe_coastal_20150101.pmtiles", label: "日本沿岸 EBSA",
    sourceLayer: "jp_marine_ebsa_coastal", minzoom: 4, maxzoom: 12, production: true,
  },
};

export function isJpTourismDatasetAvailable(dataset: JpTourismDataset): boolean {
  return JP_TOURISM_DATASETS[dataset].production || !import.meta.env.PROD;
}

export function jpTourismAssetUrl(dataset: JpTourismDataset): string {
  return `${BASE}/${JP_TOURISM_DATASETS[dataset].file}`;
}

function fetchGeoJsonUncached(dataset: JpTourismDataset): Promise<GeoJSON.FeatureCollection> {
  const config = JP_TOURISM_DATASETS[dataset];
  if (config.kind !== "geojson") throw new Error(`${dataset} 是 PMTiles，不可整包 fetch`);
  if (!isJpTourismDatasetAvailable(dataset)) throw new Error(`${dataset} 僅供本地 research，不在 production 發布`);
  return withLoading(
    `jp-tourism-${dataset}`,
    config.label,
    fetch(jpTourismAssetUrl(dataset)).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const collection = await response.json() as GeoJSON.FeatureCollection;
      if (config.propertyDefaults) {
        collection.features = collection.features.map((feature) => ({
          ...feature,
          properties: { ...config.propertyDefaults, ...(feature.properties ?? {}) },
        }));
      }
      return collection;
    }),
  );
}

const cached = Object.fromEntries(
  (Object.keys(JP_TOURISM_DATASETS) as JpTourismDataset[])
    .filter((dataset) => JP_TOURISM_DATASETS[dataset].kind === "geojson")
    .map((dataset) => [dataset, cachedOnce(() => fetchGeoJsonUncached(dataset), CACHE_TTL_MS)]),
) as Partial<Record<JpTourismDataset, () => Promise<GeoJSON.FeatureCollection>>>;

export function fetchJpTourismDataset(dataset: JpTourismDataset): Promise<GeoJSON.FeatureCollection> {
  const fetcher = cached[dataset];
  if (!fetcher) return Promise.reject(new Error(`${dataset} 是 PMTiles，不可整包 fetch`));
  return fetcher();
}
