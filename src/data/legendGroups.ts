/**
 * 圖例群組派生（AR-22 Phase 4b）
 * ══════════════════════════════════════════════════════════════════
 *
 * `LEGEND_REGISTRY` 的 `keys` 從**手寫**改成由 manifest 的 `legend` 欄位**反查**。
 * 一筆圖例 entry 只宣告「我是哪個 legend 群組」（`id`），成員名單由本檔算出來。
 *
 * 之前：同一件事寫兩遍 —— manifest 寫 `legend: "schools"`、LegendPanel 又手寫一份
 * 17 個 key 的陣列，靠契約測試逼兩份相等。新增一層要記得改兩處，漏了才會紅。
 * 現在：manifest 是唯一表達，寫一處。
 *
 * ── ⚠️ 派生的代價（SSOT 的本質，不是 bug）─────────────────────────
 *   manifest 把 legend id 填錯，從「測試會紅」變成「**自我實現**」——
 *   填 `legend: "fireStations"` 的層就真的會跟消防栓共用那份圖例，兩邊一致所以不紅。
 *   對帳測試守得住的只剩「id 存不存在」「entry 有沒有成員」，守不住「填的是不是**對的**
 *   那個 id」。這是把 SSOT 收成一份必然付的價，換到的是「不會再有兩份不同步」。
 *   完整說明見 `src/data/__tests__/layerManifest.test.ts` 的 legend 段。
 *
 * ── ⚠️ 必須掃全 348 個 key（含 orphan）───────────────────────────
 *   legend 家族**雙向**跨越「在不在 THEMES」（批 8 交接第 1 點）：
 *   orphan 沿用 THEMES 成員的 id（`islandPowerGrid` → `offshoreWindZones`），
 *   也有 THEMES 成員沿用 orphan 的 id（`powerGenerationUnit` → `powerPlants`）。
 *   10 個 orphan 裡有 7 個是非 null legend —— 只掃 `section !== null` 兩個方向都會漏。
 */
import type { LayerVisibility } from "../types";
import { LAYER_MANIFEST, MANIFEST_KEYS } from "./layerManifest";
import { onRecordExtended } from "../countries/slots";

/**
 * legend id → 該群組的全部 layer key。
 * 順序 = manifest 的宣告順序（`MANIFEST_KEYS` 即 `LAYER_MANIFEST` 的 key 順序）。
 */
function buildKeysByLegendId(): Map<string, (keyof LayerVisibility)[]> {
  const out = new Map<string, (keyof LayerVisibility)[]>();
  for (const key of MANIFEST_KEYS) {
    const id = LAYER_MANIFEST[key].legend;
    if (id === null) continue;
    const bucket = out.get(id);
    if (bucket) bucket.push(key);
    else out.set(id, [key]);
  }
  return out;
}
let KEYS_BY_LEGEND_ID = buildKeysByLegendId();
// 國家包載入（B1 P5a）：manifest 多了 key，重建（MANIFEST_KEYS 已在 layerManifest 的訂閱裡先累加）
onRecordExtended("layerManifest", () => { KEYS_BY_LEGEND_ID = buildKeysByLegendId(); });

/**
 * 某個 legend 群組的成員 key（manifest 宣告順序）。
 * 查無此 id 回空陣列 —— 呼叫端不會炸，但那筆圖例會永遠不顯示，
 * 由 `layerManifest.test.ts` 的「registry 每個 id 至少一個成員」斷言擋下。
 */
export function legendKeys(id: string): readonly (keyof LayerVisibility)[] {
  return KEYS_BY_LEGEND_ID.get(id) ?? [];
}

/** manifest 宣告過的全部 legend id（去重，首次出現順序） */
/** manifest 宣告過的全部 legend id（去重，首次出現順序；含已載入的國家包） */
export function legendGroupIds(): readonly string[] {
  return [...KEYS_BY_LEGEND_ID.keys()];
}
