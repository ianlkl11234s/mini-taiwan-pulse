// 日本車站靜態 GeoJSON loader（比照 jpReligionLoader 的 lazy fetch + cachedOnce 慣例）。
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

const BASE = `${import.meta.env.BASE_URL ?? "/"}world`;
const CACHE_TTL_MS = 30 * 60_000;

function fetchJpStationsUncached(): Promise<GeoJSON.FeatureCollection> {
  const url = `${BASE}/jp_stations.geojson`;
  return withLoading(
    "jp-stations",
    "日本車站",
    fetch(url).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<GeoJSON.FeatureCollection>;
    }),
  );
}

const fetchJpStationsCached = cachedOnce(fetchJpStationsUncached, CACHE_TTL_MS);

/** 首次開啟才由 hook 呼叫；module-level cache 避免重複下載。 */
export function fetchJpStations(): Promise<GeoJSON.FeatureCollection> {
  return fetchJpStationsCached();
}
