# soil-liquefaction — 土壤液化圖層（站主限定）

> **狀態**：shipped（owner-only；2026-09-29 上線）
> **相關 PR**：#407、#408（上線）、#453（缺少潛勢分級顯示「無資料」）、#463（未登入者看不到）
> **授權**：`RIGHTS_HOLD_REUSE_TERMS_UNCONFIRMED`，解除前不得公開

## 一句話說明

8 個土壤液化圖層讀取私人 PMTiles，僅站主帳號可見。資料為私人，本文件不記錄儲存位置細節。

## 圖層

manifest 內含 `soilLiquefactionPotential`；完整 8 層清單以 `src/data/soilLiquefactionTypes.ts` 為準。

## 主要檔案

- `src/data/soilLiquefactionTypes.ts`：契約常數（endpoint、source-layer、色票、分級門檻）。
- `src/hooks/useSoilLiquefactionLayers.ts`、`src/hooks/useSoilLiquefactionPrivateAccess.ts`：圖層與站主驗證。
- `src/layers/hosts/hazardHosts.tsx`、`src/components/featureInfo/soilLiquefactionPanels.tsx`：host 與 popup。
- `server/coral-private/coral-private-server.mjs`：私人資產 sidecar。
- `scripts/deploy/upload-soil-liquefaction-private.mjs`：私人上傳（僅明確授權時手動執行）。

## 資料夾內文件

| 文件 | 用途 |
|---|---|
| [handoff.md](./handoff.md) | 接線位置、上線順序、語意規則（未調查 ≠ 低潛勢、弱層厚度 0 與缺值差異） |

## 資料契約

上游：`taipei-gis-analytics/docs/handoff/soil-liquefaction.md`（產物、sha256、source-layer、缺值語意）。

## 驗收方式

上傳腳本會檢查 receipt、sha256、讀回比對與匿名存取被拒；未登入者不得看到圖層。
