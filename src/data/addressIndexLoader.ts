import { withLoading } from "../lib/loadingRegistry";
import {
  indexShardRoads, type AddressManifest, type AddressRoadsFile, type AddressShardFile, type IndexedShard,
} from "../lib/addressSearch";

/**
 * 門牌搜尋索引（地址搜尋第二階段）懶載入。
 *
 * - 公開分片：`<base>/manifest.json`、`roads.json`、`t/<縣市碼>-<n>.json`（建置腳本：tw-address-geocoder
 *   `pipelines/20_build_address_search_index.py`）。檔案放 `public/address-index/v1/`（不進 git），
 *   登記在 deploy/public-assets.lock.json、上傳 S3 deploy-assets/address-index/v1/，正式站由 Worker 從 R2 供應；
 *   本機 dev 讀 public/，路徑與其他 lock 資產一樣用 BASE_URL 相對路徑。
 * - 站主版在 addressOwnerLoader.ts（owner-only 守門範圍，不讀 env、不寫外部網址）。
 * - 每個請求都走 loadingRegistry；失敗清掉快取讓下次重試，呼叫端要顯示錯誤，不可當成「查無」。
 */
export function addressIndexBase(): string {
  return `${String(import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "")}/address-index/v1`;
}

const cache = new Map<string, Promise<unknown>>();

function cachedJson<T>(key: string, taskId: string, label: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = withLoading(taskId, label, load()).catch((err: unknown) => {
      cache.delete(key);
      throw err;
    });
    cache.set(key, p);
  }
  return p;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`門牌索引載入失敗 ${res.status}`);
  return await res.json() as T;
}

export function loadAddressManifest(label: string): Promise<AddressManifest> {
  return cachedJson("manifest", "address-index-manifest", label, async () => {
    const m = await getJson<AddressManifest>(`${addressIndexBase()}/manifest.json`);
    if (m?.version !== 1 || !m.counties) throw new Error("門牌索引格式不符");
    return m;
  });
}

export function loadAddressRoads(manifest: AddressManifest, label: string): Promise<AddressRoadsFile> {
  return cachedJson("roads", "address-index-roads", label, () => getJson<AddressRoadsFile>(`${addressIndexBase()}/${manifest.roads.file}`));
}

export function loadAddressShard(manifest: AddressManifest, countyCode: string, town: string, label: string): Promise<IndexedShard | null> {
  const file = manifest.counties[countyCode]?.towns[town]?.file;
  if (!file) return Promise.resolve(null);
  return cachedJson(`shard:${file}`, `address-index-${file}`, label, async () => {
    const shard = await getJson<AddressShardFile>(`${addressIndexBase()}/${file}`);
    return indexShardRoads(shard.roads);
  });
}

/** 測試用 */
export function resetAddressIndexCache(): void {
  cache.clear();
}
