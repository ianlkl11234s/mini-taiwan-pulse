// 日本宗教設施靜態 GeoJSON loader。GSI 是 PMTiles，由 layer hook 直接接 source。
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

export type JpReligionGeoJsonSource = "osm" | "wikidata";

const BASE = `${import.meta.env.BASE_URL ?? "/"}world`;
const CACHE_TTL_MS = 30 * 60_000;

function fetchGeoJsonUncached(
  source: JpReligionGeoJsonSource,
  label: string,
): Promise<GeoJSON.FeatureCollection> {
  const url = `${BASE}/jp_religion_${source}.geojson`;
  return withLoading(
    `jp-religion-${source}`,
    label,
    fetch(url).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<GeoJSON.FeatureCollection>;
    }),
  );
}

const fetchJpReligionOsmCached = cachedOnce(
  () => fetchGeoJsonUncached("osm", "日本宗教設施 OpenStreetMap"),
  CACHE_TTL_MS,
);

const fetchJpReligionWikidataCached = cachedOnce(
  () => fetchGeoJsonUncached("wikidata", "日本宗教設施 Wikidata"),
  CACHE_TTL_MS,
);

/** 首次開啟才由 hook 呼叫；module-level cache 避免重複下載 10.9 MB。 */
export function fetchJpReligionOsm(): Promise<GeoJSON.FeatureCollection> {
  return fetchJpReligionOsmCached();
}

/** 首次開啟才由 hook 呼叫；module-level cache 避免重複下載 5.9 MB。 */
export function fetchJpReligionWikidata(): Promise<GeoJSON.FeatureCollection> {
  return fetchJpReligionWikidataCached();
}
