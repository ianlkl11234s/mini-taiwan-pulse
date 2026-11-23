import { readOwnerJson } from "../lib/ownerData";
import { loadingRegistry } from "../lib/loadingRegistry";
import { OWNER_DATA_ASSETS, type OwnerDataAssetName } from "./ownerDataAssets";
import { indexShardRoads, type AddressOwnerFile, type IndexedShard } from "../lib/addressSearch";

/**
 * 門牌搜尋站主版：owner-data 私人檔 `address-owner-<縣市碼>`（每縣市一片），只在站主登入時才抓。
 * 經 readOwnerJson（同源 sidecar、站主 JWT），自己登記 loadingRegistry；登出由呼叫端 clearOwnerAddressCache()。
 * 站主版是公開版的補充：讀不到（還沒上傳、sidecar 沒開、網路錯）一律安靜退回只查公開版，
 * loading 結束不記為失敗（不跳右上「載入失敗」），下次搜尋再試。
 */
const ownerCache = new Map<string, Promise<Map<string, IndexedShard> | null>>();
let ownerGeneration = 0;

export function ownerAddressAsset(countyCode: string): OwnerDataAssetName | null {
  const name = `address-owner-${countyCode}`;
  return name in OWNER_DATA_ASSETS ? name as OwnerDataAssetName : null;
}

/** 站主版某縣市：town 顯示名 → 分片。讀不到（含非站主 401／403）一律回 null，不丟錯。 */
export function loadOwnerAddressCounty(countyCode: string, label: string): Promise<Map<string, IndexedShard> | null> {
  const asset = ownerAddressAsset(countyCode);
  if (!asset) return Promise.resolve(null);
  let p = ownerCache.get(countyCode);
  if (!p) {
    const gen = ownerGeneration;
    const taskId = `address-owner-${countyCode}`;
    loadingRegistry.start(taskId, label);
    p = readOwnerJson<AddressOwnerFile>(asset).then(
      (file) => {
        loadingRegistry.end(taskId);
        if (gen !== ownerGeneration) return null;
        return new Map(Object.entries(file.towns).map(([town, roads]) => [town, indexShardRoads(roads)]));
      },
      () => {
        loadingRegistry.end(taskId);
        if (gen === ownerGeneration) ownerCache.delete(countyCode);
        return null;
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

