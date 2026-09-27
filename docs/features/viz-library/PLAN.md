# 統一視覺化函式庫：施工計劃

定案見 [DECISIONS.md](./DECISIONS.md)。本檔是施工分工與驗收。

## 架構決定（2026-09-28）

- **共用規格檔**：`mcp/src/warehouse/vizSpec.json` 是 SSOT；mini 保存位元組相同的副本
  `mini/src/research/contracts/viz-spec.json`。內容：暗／淡色碼、各樣式預設值、數字格式規則與測試向量、驗證門檻。
  **只有主 agent 可以改**；兩邊各有契約測試（sha256 比對＋讀規格驗算）。
- **server 輸出格式**：`ResultStyle` 新增 `ramp`（色階名）與 `palette: { dark: string[]; light: string[] }`、
  `nullStyle: "hatch"`；舊的 `colors` 暫時保留、等於 `palette.dark`，下一版移除。mini 依底圖暗／淡取色。
- **註冊表**：每種樣式一份定義（參數驗證、server 端計算、圖例規格、popup 欄位）。mcp `STYLE_REGISTRY`、mini `WAREHOUSE_STYLE_RENDERERS`，
  key 集合要一致（契約測試檢查）。
- **數字格式 U1**：兩邊各實作 `formatVizNumber(value, kind)`，都要通過規格檔 `numberFormat.vectors`。
- 盤點發現（2026-09-28）：兩邊原本沒有任何 style 契約機制，色碼各自寫死（mcp `resultStyle.ts:23-28`、mini `warehouseResultStyle.ts:23,115,128`）；
  數字格式只有 `Intl.NumberFormat("zh-TW")` 兩份（`researchResultPopup.ts:3`、`warehouseResultStyle.ts:134`）；分析結果圖例走 `WarehouseStyleLegend.tsx`，不經 `LEGEND_REGISTRY`。

## 分工（每個 repo 一個 worker，可並行）

| 階段 | mcp worker | mini worker |
|---|---|---|
| A | 規格載入＋色盤驗證測試、`formatVizNumber`、`resultStyle.ts` 改註冊表、choropleth/heatmap 換新色、輸出 `ramp/palette/nullStyle` | 規格載入＋契約測試、`formatVizNumber`、`warehouseResultStyle.ts` 改註冊表、依底圖取暗／淡色、缺值斜線 pattern、popup 與圖例用 U1 |
| B | 新增 `proportional`；`bivariate` 改 V3（填色＋泡泡） | 對應渲染（circle-radius √、75%、細框、大的先畫、前 5 名標名稱）、V3 |

禁改（兩邊）：`vizSpec.json`／`viz-spec.json`、`src/styles/designTokens.ts`、`LegendPanel.tsx`、`layerManifest.ts`、`layerParamsSpec.ts`、
任何 `docs/`。需要改規格 → 回報需求，由主 agent 改。

## 驗收

- mcp：`npm run typecheck && npm test` 全綠；新測試涵蓋色盤驗證、數字格式向量、註冊表 key、各樣式輸出。
- mini：`npx tsc -b`（不可 `--noEmit`）＋ `npm test` 全綠（含 `layerConsistency`）。
- 契約：兩份規格 sha256 相同；mcp 與 mini 的樣式 key 集合一致。
- 瀏覽器：另開 vite（不用 3734），暗／淡底圖各截圖 choropleth、heatmap、proportional、V3。
- PR：mcp 先、mini 後；mini CI 綠燈後一般 merge；merge 後更新 `.worktrees/analysis-prod`。

## 之後的 PR（本輪不做）

互動（H1 滑過、X1 淡化、O1 疊加、圖例精簡版）、流向 F3、H3 格點、立體柱、多層等時圈、脈衝 R2、面板小圖表、時間序列動畫、分析卡匯出。
