import { fetchOwnerJson } from "../lib/ownerData";
import { OWNER_DATA_ASSETS, type OwnerDataAssetName } from "./ownerDataAssets";
import { indexShardRoads, type AddressOwnerFile, type IndexedShard } from "../lib/addressSearch";

/**
 * 門牌搜尋站主版：owner-data 私人檔 `address-owner-<縣市碼>`（每縣市一片），只在站主登入時才抓。
 * 經 fetchOwnerJson（同源 sidecar、站主 JWT、loadingRegistry）；登出由呼叫端 clearOwnerAddressCache()。
 */
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

