// 全球垃圾殘骸 loader（Outerview，CC-BY-4.0）
// 靜態 public/world/trash_debris.geojson（~25,000 Point，properties: id / region）。
// 點位密度反映 Mapillary 街景覆蓋，非真實垃圾分佈。
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

const SOURCE_URL = `${import.meta.env.BASE_URL ?? "/"}world/trash_debris.geojson`;

async function fetchWorldTrashDebrisUncached(): Promise<GeoJSON.FeatureCollection> {
  const t0 = performance.now();
  const fc = await withLoading(
    "world-trash-debris",
    "全球垃圾殘骸 Outerview",
    fetch(SOURCE_URL).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<GeoJSON.FeatureCollection>;
    }),
  );
  console.log(
    `[WorldTrashDebris] Loaded ${fc.features?.length ?? 0} points in ${(performance.now() - t0).toFixed(0)}ms`,
  );
  return fc;
}

// 靜態檔，載一次 cache（TTL 30min，比照靜態/慢變資料）。
const fetchWorldTrashDebrisCached = cachedOnce(fetchWorldTrashDebrisUncached, 30 * 60_000);

export function fetchWorldTrashDebris(): Promise<GeoJSON.FeatureCollection> {
  return fetchWorldTrashDebrisCached();
}
