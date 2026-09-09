---
name: accessibility-analysis
description: 設計、驗證或整合「到最近服務多遠、服務範圍、可達性沙漠」的空間分析；用於 POI、路網距離、等時圈或格網 coverage，而非單純點位展示。
user_invocable: true
---

# 可達性分析

先定義問題、距離與資料狀態，再選模式與交付範圍。Pipeline、PMTiles 發佈與前端整合可以分開進行，沒有完成的環節不可宣稱已在 app 顯示或已部署。

## 先確認的語意

1. **問題與度量**：明確寫出最近距離、旅行時間、站數 coverage 或服務範圍；註明直線／路網、交通方式、單位、cutoff、路網與 POI 的 as-of。
2. **模式**：最近服務沿路網用 A；每站服務區用 B；跨服務比較或沙漠用 C。需要比較才讀 [模式對照](references/mode-comparison.md)。
3. **資料品質**：新增 bucket 必讀 [資料與幾何語意](references/data-semantics.md)。多重身分 POI 要進所有適用 bucket；「其他」以可檢查的 whitelist 收錄，不以反向條件擴張。
4. **範圍**：決定本次只產 pipeline、只接 UI，還是兩端都做。資料來源、license、coverage、未連通區、無 geometry 與失敗資料要在輸出與 UI 中可辨識。

## 選擇工作路徑

### A. 路網距離

回答「在這條路或這個格點，最近服務多遠」。保留 `dist_m` 原值與 band，並把超過 cutoff、無最近節點、缺 geometry 或無資料分開表示；不要把它們填成 0、最遠 band 或 coverage 之外。

### B. 等時圈／服務面

回答「在交通規則與門檻下可達的範圍」。polygon 是計算模型的輸出，不能推論未計算區域沒有服務；記錄 mode、時間門檻、路網與 hull／grid 方法。

### C. 格網／H3 coverage

回答跨服務比較、沙漠或統計。cell 的 centroid／代表點是計算採樣點，不是服務位置；coverage、有效 POI 數、no-data 與未連通 cell 要各自保留，不能合成一個分數或 0。

## Pipeline 與資料驗收

- Mode A 需要可改的起點範本時讀 [`scripts/pipeline-template.py`](scripts/pipeline-template.py)；不要把範例的 POI、bucket、bands 或固定數字直接帶到新資料。
- 要跑或救援長 pipeline 時讀 [troubleshooting](references/troubleshooting.md)；公開 mirror、PBF、OSRM 與 PostGIS 的取捨讀 [mirror fallback](references/mirror-fallback.md)。這些是歷史操作經驗，先做當前健康／資源檢查，不預設可用。
- 產物前後驗證 POI 選取規則、各 bucket 數量、距離單位、cutoff、geometry validity、coverage 與 no-data 計數。保留來源、方法與版本，讓下游可以重算。

## PMTiles 與前端整合

先讀 [整合契約](references/integration-contract.md)。以當前 `src/data/layerManifest.ts`、`src/data/layerParamsSpec.ts`、其測試與相關 spec 派生需要的註冊，而不是複製固定檔案清單。PMTiles 的檔名、`sourceLayer`、保留 properties、min/max zoom、paint、legend、popup 與 asset publication 是一份契約；每一端都要有對應證據。

實際接線時，保留距離／coverage 的資料狀態與 units；缺屬性、空 tile、HTTP／range 失敗或 UI 未註冊不能呈現成成功。依變更跑相稱的 manifest／params／layer tests、typecheck、資產 readback 與 browser 檢查，並分別報告結果。

## 邊界

- 不以單純 POI 點位分布冒充可達性分析；那類工作走 layer-onboarding。
- 不自行 apply migration、發佈資產、部署、commit 或 push；同一 task 已有授權可沿用。
- 發現新且可重現的資料選取、距離、geometry 或 PMTiles 契約問題時，更新相應 reference；不要把一次性服務或 UI 路徑寫成所有未來 layer 的固定 SOP。
