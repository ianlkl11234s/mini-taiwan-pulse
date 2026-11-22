import { withLoading } from "../lib/loadingRegistry";
import { fetchOwnerJson } from "../lib/ownerData";
import { OWNER_DATA_ASSETS, type OwnerDataAssetName } from "./ownerDataAssets";
import {
  indexShardRoads, type AddressManifest, type AddressOwnerFile, type AddressRoadsFile,
  type AddressShardFile, type IndexedShard,
} from "../lib/addressSearch";

/**
 * 門牌搜尋索引（地址搜尋第二階段）懶載入。
 *
 * - 公開分片：`<base>/manifest.json`、`roads.json`、`t/<縣市碼>-<n>.json`（建置腳本：tw-address-geocoder
 *   `pipelines/20_build_address_search_index.py`）。base 由 `VITE_ADDRESS_INDEX_BASE` 指定，本機預覽
 *   指到本機靜態目錄；未設定時用正式 CDN 路徑。分片不進 public/、lock 或 deploy-assets。
 * - 站主版：owner-data 私人檔 `address-owner-<縣市碼>`，只在站主登入時才抓；登出由呼叫端 clearOwnerAddressCache()。
 * - 每個請求都走 loadingRegistry；失敗清掉快取讓下次重試，呼叫端要顯示錯誤，不可當成「查無」。
 */
export const DEFAULT_ADDRESS_INDEX_BASE = "https://data.itsmigu.com/address-index/v1";

export function addressIndexBase(): string {
  return String(import.meta.env.VITE_ADDRESS_INDEX_BASE || DEFAULT_ADDRESS_INDEX_BASE).replace(/\/+$/, "");
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

// ── 站主版 ──────────────────────────────────────────────────────────

const ownerCache = new Map<string, Promise<Map<string, IndexedShard> | null>>();
let ownerGeneration = 0;

export function ownerAddressAsset(countyCode: string): OwnerDataAssetName | null {
  const name = `address-owner-${countyCode}`;
  return name in OWNER_DATA_ASSETS ? name as OwnerDataAssetName : null;
}

/** 站主版某縣市：town 顯示名 → 分片。非站主（401／403）回 null，不算錯誤。 */
export function loadOwnerAddressCounty(countyCode: string, label: string): Promise<Map<string, IndexedShard> | null> {
  const asset = ownerAddressAsset(countyCode);
  if (!asset) return Promise.resolve(null);
  let p = ownerCache.get(countyCode);
  if (!p) {
    const gen = ownerGeneration;
    p = fetchOwnerJson<AddressOwnerFile>(asset, `address-owner-${countyCode}`, label).then(
      (file) => {
        if (gen !== ownerGeneration) return null;
        return new Map(Object.entries(file.towns).map(([town, roads]) => [town, indexShardRoads(roads)]));
      },
      (err: unknown) => {
        ownerCache.delete(countyCode);
        const status = (err as { status?: number } | null)?.status;
        if (status === 401 || status === 403) return null;
        throw err;
      },
    );
    ownerCache.set(countyCode, p);
  }
  return p;
}

/** 撤權（登出、換帳號）時清掉站主分片快取；進行中的請求回來也會被丟棄。 */
export function clearOwnerAddressCache(): void {
  ownerGeneration += 1;
  ownerCache.clear();
}

/** 測試用 */
export function resetAddressIndexCache(): void {
  cache.clear();
  clearOwnerAddressCache();
}
