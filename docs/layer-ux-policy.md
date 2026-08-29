# Layer UX policy

本文件是 Layer UX 的產品政策 SSOT。`layerManifest.ts`、`layerParamsSpec.ts`、
`gisClickRegistry.ts` 與各自的契約測試仍各自管理實作細節；本文件定義它們共同
必須滿足的使用者體驗，不以「目前已接了什麼」反推規則。

## 基本政策

| 能力 | 預設要求 | 不適用的唯一情況 |
|---|---|---|
| 不透明度 | 每個 sidebar 可見的 layer 都可調整 | 沒有獨立可見輸出的 internal-only key |
| 點位大小 | 每個可點選、以點位呈現的 layer 都可調整 | 純文字標籤或沒有點幾何的 layer |
| 分類篩選 | 有穩定、可理解分類欄位的 layer 都提供多選 | 資料沒有可篩的分類維度 |
| 點選資訊 | 有資料 feature 的 point、line、polygon、grid 都可點選 | 沒有 feature/value 可讀的裝飾特效或上游已著色且無數值通道的 raster |
| Escape | Esc 關閉最上層暫態 UI | 不適用；此為全域行為 |

## 控件語言

- UI 一律使用繁中：`不透明度`、`點位大小`、`類別`、`全選`、`全關`。
- 內部參數 key 維持既有 English camelCase，例如 `fooOpacity`、`fooScale`。
- 分類篩選使用同一個多選面板：預設全選、逐類 checkbox、全選與全關。
- 公車保留既有群組預設；其他採多選的分類 layer 預設全選。

## Layer 顯示名稱

- layer label 採「中文主名 + 可選英文／正式縮寫輔名」；英文只用於資料來源、正式產品名
  或必要技術術語，不能取代或重複中文主名。
- `labelMobile` 是較短的同義名稱：保留中文主名，移除英文輔名、資料筆數與 emoji；不可
  比 desktop label 更長或改變語意。
- Theme 採「中文 English」；subgroup 優先中文，必要時才附英文。版本、日期、`legacy`、
  `test` 等開發資訊不出現在一般 layer 名稱，應移至 description 或開發介面。

## Escape 優先序

`Modal → FeatureInfo popup/選取狀態 → flight follow → capture mode`。

## 目前基線（2026-08-29）

- 初始 21 個 opacity 缺口已全數補齊：Mapbox layer 統一以 `opacityParam` 乘上
  原本 paint alpha；自訂 renderer（即時運具、垃圾車、車站／港口光柱）也各自保留
  主題基準並乘上相同倍率。預設值均為 1，不改變原始畫面。
- 另有 12 個 `params: null` 的既有豁免；後續逐筆改為 internal-only、補控件，或移除。
- Overlay registry 已可機械辨識 Mapbox `circle`／`symbol` 點層；23 個缺少大小控件，
  另有 `fireLatest` 等 custom scene 點位也已列入明確基線。尚未被 registry 描述的
  custom renderer 會在補控件前補上 geometry metadata，不能用名稱猜測。
- 現有 popup 豁免 ledger 有 57 筆，其中 32 個 layer 目前宣告 `popup: null`；其餘是
  Three.js／hover 等非 GIS 點選路徑。兩者都必須逐筆確認是否符合「可點選資訊」政策，
  不能只把 manifest 欄位當作使用者行為。
- 分類多選共用 scalar state + numeric bitmask 的 Mapbox bridge：`religionTemples`、動物服務據點、
  受保護樹木、河濱喬木、台北公園、文化設施／地方文化館、旅宿、全國行道樹、台北樹穴、
  北市／新北與非都市土地分區皆已接線（預設全選、支援全關）。
- bitmask 僅適用穩定且可並存的分類，最多 30 類；超過上限不可遷移，避免 JavaScript 32-bit
  sign bit 造成分類誤判。mode、status、year、precision、metric 等互斥控制維持單選。

## 稽核原則

1. 缺口不以 `null` 解除；必須補實作或寫入可驗證的語意理由。
2. 基線缺口用契約測試列出，避免新增缺口；補完一筆就從基線清單移除。
3. 點位與可點選 feature 的 metadata 是下一步的必要輸入，不能以 layer 名稱猜測。
