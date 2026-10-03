# 圖層面板統一＋熱區／網格配色：實作計畫

> 依據：[`AUDIT.md`](./AUDIT.md)（P1–P9 決定）、[`../layer-color-picker/PROPOSAL.md`](../layer-color-picker/PROPOSAL.md) §0（Q1–Q6、17 組色階）。狀態：⏳ 待使用者同意開工（2026-10-03）。

## 0. 開工前

- **先合併 #498（R5 熱區）**：它改了 `LegendPanel`、`overlayRegistry`、`layerParamsSpec` 預設值，後面每一段都會動到同樣的檔。
- **提案先進 master**：`docs/layer-color-proposal` 分支（提案、選擇頁、盤點）開一支 docs-only PR，決定先落地再寫程式。
- 原型 `proto/layer-color`（dev server 3752）使用者確認不用後關閉並移除。

## 1. 階段與順序

順序依相依性：A 與 D 可平行（檔案不重疊），B 改 manifest 必須單獨進行，C 風險最高放最後。每一段一支 PR。

| 段 | 內容 | 主要檔案 | 風險 |
|---|---|---|---|
| **A 共用外殼（不動資料）** | 從 `IconRailSidebar.tsx` 抽出 `LayerRow`／`ThemeBanner`／`SubGroupLabel`／`ExpandedControls` 到 `components/sidebar/`；手機改用同一套、分頁改四個入口（P7）；資料來源、分析結果、衛星、我的改用同一套列（P8）；計數格兼載入狀態，接 `loadingRegistry`（P1）；搜尋末尾提示其他面板筆數（P9）；修 All Off 英文、衛星開關位置與顏色 | `IconRailSidebar.tsx`、`LayerSidebar.tsx`、`DataSourcePanel.tsx`、`MainMapConnection.tsx`、`CNGroupSection.tsx`、`MemberPanel.tsx`、`MedicalStatisticsGroupControls.tsx` | 低；`layerConsistency.test.ts` 440–473 比對 sidebar 原始碼字串，必須一起改寫 |
| **D 熱區／網格配色** | 新控制項型別 `palette`（同時是 C 段新型別的範本）；`palettes.ts` 收 17 組；全部熱區預設改用驗證過的新 magma（Q4 A）；顏色列放在資料篩選之後、透明度之前（P5）；清單改浮出（修裁切）；多層熱區同開時各自降透明度（Q6 B）；修 §8 稽核 5 項；spec 補「色盤選單」元件；25 個網格改讀解析器；3 個 YlOrRd 網格改 YlOrBr | `layerParamsSpec.ts`、`layerParamsControls.ts`、`LayerParamControls.tsx`、`mapStyleScale.ts`、`overlayRegistry.ts`（熱區／網格段）、`LegendPanel.tsx`、`research/layerControls.ts`、`memberSceneAdapter.ts` | 中；網格色逐層寫死，工作量大 |
| **B 資料結構** | manifest 名稱改結構化 `{zh, alt, qualifier}`（約 525 筆，P2），`label` 保留為由兩者組成的字串，讓搜尋、Agent、存檔不用改；兩支拆字函式退場；移除 `labelMobile` 裡的筆數；日本主題補日文副標（P3）；所有面板加大分類（P4）；控制項順序規則（P5）加測試鎖住、改 spec §5.11 | `layerManifest.ts`、`layerCatalog.ts`、`layerParamsSpec.ts`、spec | 中；用程式批次轉換＋人工檢查兩支拆字函式判斷不同的名稱 |
| **C 統計（一次到位）** | 新控制項型別「連動選單」：選項非同步載入、上游改變時下游重算（P6 A）；`StatisticsDetails` 改走共用規格；醫療統計群組變成 `ThemeDef` 的群組變體；場景存檔、前端白名單；**跨 repo**：`mini-pulse-gis-mcp` 的圖層控制工具說明加新型別；修說明露出內部代碼 | `StatisticsDetails.tsx`、`regionalStatisticsStore`、`layerParamsSpec.ts`、`layerControls.ts`、`memberSceneAdapter.ts`、MCP `server.ts` | **高**；MCP PR 合併前 Agent 調不了統計，要明說這段空窗；驗收含「MCP 重連後用 Agent 切統計期別」 |

平行規則：A 與 D 分開 worktree，A 只改面板與清單元件，D 只改控制項、色盤與圖層 paint；兩邊都**不碰** `layerManifest.ts`（B 專屬）。

## 2. 每段驗收

`npx tsc -b`、`npm test` 全套、`designSystemGuard`、spec §8 人工清單逐項、瀏覽器暗／淡＋390px、All Off 後逐面板檢查；前後對照頁照 R3b／R5 做法。

## 3. 開工前要使用者決定

1. **大分類怎麼分（P4 A）**：目前只有台灣有大分類。日本 14 個主題草案：

   | 大分類 | 主題 |
   |---|---|
   | 行政與人口 | 行政區、人口 |
   | 交通與旅宿 | 交通、旅宿 |
   | 醫療與照護 | 醫療設施、長照服務、醫療圈 |
   | 社會 | 治安、教育、宗教 |
   | 自然與環境 | 自然保護、世界遺產、水資源、高度與地表 |

   統計與世界的分法在 B 段開工前另做選擇頁。
2. **日文副標和中文一樣時（P3 B）**：日本 14 個主題中，交通、自然保護、治安、教育、人口、宗教、水資源 7 個的日文寫法與中文相同，世界遺産、医療施設、医療圏 3 個只差字形。一樣時要隱藏副標，還是照樣顯示？
3. **3 個 YlOrRd 網格改 YlOrBr**：預設，可改。

## 4. 文件

設計系統 README 加兩列：R7 熱區／網格配色、R8 圖層面板統一（⏳），指向本計畫與兩份提案。
