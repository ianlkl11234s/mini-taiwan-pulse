# 土壤液化圖層（owner-only）

狀態（2026-09-29）：8 個圖層改讀私人 PMTiles，只有站主帳號看得到；授權仍是 `RIGHTS_HOLD_REUSE_TERMS_UNCONFIRMED`，解除前不得公開。

上游資料契約：`taipei-gis-analytics/docs/handoff/soil-liquefaction.md`（產物、sha256、source-layer、缺值語意）。

## 接線

| 部分 | 位置 |
|---|---|
| 契約常數（endpoint、key、source-layer、色票、分級門檻） | `src/data/soilLiquefactionTypes.ts` |
| 站主驗證 | `src/hooks/useSoilLiquefactionPrivateAccess.ts`（照 jpWater） |
| 圖層 | `src/hooks/useSoilLiquefactionLayers.ts`、`src/layers/hosts/hazardHosts.tsx` |
| 鎖定／失權關閉 | `src/App.tsx`（同 jpWater 的鎖定集合） |
| popup | `src/components/featureInfo/soilLiquefactionPanels.tsx` |
| sidecar | `server/coral-private/coral-private-server.mjs` `SOIL_LIQUEFACTION_*`；本機根目錄可用 `SOIL_LIQUEFACTION_PRIVATE_ROOT` 覆寫 |
| 私人上傳（只在明確授權時手動執行） | `scripts/deploy/upload-soil-liquefaction-private.mjs <analytics>/output/soil_liquefaction_private` |

## 上線順序

1. analytics 分支 push／merge（pipeline 04 與 handoff）。
2. 站主授權後執行私人上傳腳本（會檢查 bucket policy、receipt、sha256、讀回比對、匿名 403）。
3. Pulse PR（`gh pr merge --merge`）→ 部署。若部署早於上傳，只有土壤液化家族 warm 失敗、站主看到「sidecar unavailable」，其他私人家族不受影響。

## 語意規則

- 未調查（`not_investigated`）用缺值斜線＋獨立圖例＋popup，不等於低潛勢。
- 弱層厚度 0 = 此深度段無弱層（不填色、可點）；欄位缺席 = 缺值（斜線）。弱層只有 z8 以上。
- 監測站只有位置，不是即時觀測值。
- 重產 PMTiles 後要同步更新 sidecar 的 `SOIL_LIQUEFACTION_ASSETS` size／sha256。
