// 日本車站靜態 GeoJSON loader（比照 jpReligionLoader 的 lazy fetch + cachedOnce 慣例）。
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";
import { classifyJpStationType, jpStationPax } from "./jpStationTypes";

const BASE = `${import.meta.env.BASE_URL ?? "/"}world`;
const CACHE_TTL_MS = 30 * 60_000;

/** 每個 feature.properties 補上色用純量欄位：jp_type（主類）、jp_pax（運量 fallback）。 */
function withColorFields(data: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  for (const feature of data.features) {
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    props.jp_type = classifyJpStationType(props.operator_types);
    props.jp_pax = jpStationPax(props);
    feature.properties = props;
  }
  return data;
}

function fetchJpStationsUncached(): Promise<GeoJSON.FeatureCollection> {
  const url = `${BASE}/jp_stations.geojson`;
  return withLoading(
    "jp-stations",
    "日本車站",
    fetch(url).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<GeoJSON.FeatureCollection>;
    }).then(withColorFields),
  );
}

const fetchJpStationsCached = cachedOnce(fetchJpStationsUncached, CACHE_TTL_MS);

/** 首次開啟才由 hook 呼叫；module-level cache 避免重複下載。 */
export function fetchJpStations(): Promise<GeoJSON.FeatureCollection> {
  return fetchJpStationsCached();
}
