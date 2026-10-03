# 圖層面板統一

## 使用者決定（2026-10-03，[`picks.html`](./picks.html)）

範圍：台灣、日本、統計、世界四個入口，加上手機版、資料來源、Agent 分析結果、衛星、我的——**所有圖層清單與設定面板統一成同一套**。

| 題 | 決定 | 與建議不同處 |
|---|---|---|
| P1 圖層列結構 | A：精簡列，計數格兼當載入狀態；說明・來源在展開區最後 | — |
| P2 雙語名稱 | A：同一行：中文＋外文小字＋來源標籤；manifest 改結構化 `{zh, alt, qualifier}` | — |
| P3 主題副標 | **B：日本主題補日文** | 建議為補英文 |
| P4 大分類與預設展開 | **A：所有面板都有大分類** | 建議為主題多的面板才有 |
| P5 設定區順序 | **B：資料在上：資料篩選→顏色→透明度→大小→說明** | 建議為顏色→透明度在上 |
| P6 統計設定整合 | **A：新增「連動選單」控制項，統計完全走共用規格；一次到位** | 建議為先 B 後 A |
| P7 手機版 | B：同一套元件，分頁改成與桌機一致的四個入口 | — |
| P8 其他清單收編 | A：資料來源、分析結果、衛星、我的全部改用同一套列元件 | — |
| P9 搜尋 | B：各面板搜自己，結果末提示「其他面板還有 N 筆」 | — |

連帶影響：配色提案（`../layer-color-picker/PROPOSAL.md` §0）的「顏色」列位置改照 P5：在資料篩選之後、透明度之前。

---

# 圖層面板統一：現況盤點

> 狀態：⏳ 盤點完成、等使用者在 [`picks.html`](./picks.html) 逐題選（2026-10-03）。
> 起因：配色提案 [`../layer-color-picker/PROPOSAL.md`](../layer-color-picker/PROPOSAL.md) §0 Q5 使用者選 C，並要求「台灣、日本、統計、世界，理論上所有圖層設定面板都統一」。
> 行號以 `origin/master`（f7e69e1b）為準；截圖取自 3752 原型（含 master 全部功能＋熱區顏色列原型）。

## 白話摘要

- 桌機的台灣、日本、統計、世界四個面板**是同一個元件**（`LayersPanel`），只差餵進去的主題清單與兩三個開關。看起來不一樣，主要是**資料**造成的：名稱是一整串字、日本主題沒有英文、各層設定項目順序不同。
- 手機是**另一份程式**：只有「圖層／統計」兩個分頁，日本與世界混在圖層分頁；圖層分頁用空心圓點當開關、統計分頁用正常開關；名稱用另一個欄位 `labelMobile`（筆數寫死在名稱裡）。
- 另有四份**各自寫的清單**（資料來源、Agent 分析結果、衛星群組、我的），列的長相、開關都不同。
- 統計的設定是一塊手寫區（非同步、連動的 6 個 select），不走共用控制項規格。

## 1. 元件與程式位置（已抽查）

| 項目 | 位置 | 說明 |
|---|---|---|
| 桌機四面板 | `src/components/IconRailSidebar.tsx` 441／464／487／512 | 4 次 `<LayersPanel>`；差在 `themes`、`title`、`showMacroGroups`（只有台灣）、`statisticsModeControl`、`allOffKeys`（只有統計） |
| `LayersPanel` 本體 | 同檔 920 | 全部關閉鈕（文字「All Off」）、搜尋、主題迴圈、搜尋結果列（另一種列：色點＋粗體名＋說明＋主題＋星號） |
| 私有元件 | 同檔 `LayerRow` 748、`ThemeBanner` 817、`SubGroupLabel` 873、`MacroGroupLabel` 897 | 只在本檔，手機用不到 |
| 共用元件包裝 | 同檔 `PanelHeader` 680、`ToggleSwitch` 692 | 包裝 `sidebar/PanelHeader.tsx`、`sidebar/LayerToggleSwitch.tsx` |
| 展開設定 | 同檔 `ExpandedControls` 1179 | 順序寫死：航班模式鈕 → `StatisticsDetails` → `PropertyValueStatisticsDetails` → 歷史航跡 → `ParamControlList` |
| 手機 | `src/components/LayerSidebar.tsx` `SidebarContent` 217 | 主題總開關手刻 28×14（約 450）；圖層列色點當開關（566–579）；名稱 `labelMobile ?? label`（525）；統計列用正常開關（605） |
| 醫療統計群組 | `src/components/sidebar/MedicalStatisticsGroupControls.tsx` | chevron 在名稱後（85）、「指標」select 在列外（91）、子項無開關 |
| 統計設定 | `src/components/sidebar/StatisticsDetails.tsx` 241 | 手寫 select 332–383（指標、期別、維度，非同步連動） |
| 資料來源 | `src/components/sidebar/DataSourcePanel.tsx` | 自己的列；`splitLabel` 77（尾段純 ASCII 才拆）；主題標題 302 |
| Agent 分析結果 | `src/research/MainMapConnection.tsx` 736–804 | 群組用原生 checkbox（742；跟隨視角 731 也是） |
| 我的 | `src/components/member/MemberPanel.tsx` 87 | 收藏／已開啟：名稱＋「關閉圖層」「收藏」兩顆按鈕 |
| 衛星群組 | `src/components/satelliteConsole/CNGroupSection.tsx` | 色點＋名稱＋徽章＋計數＋開關（開關在 chevron 前、用強調色） |
| 站主限定 | `lockedKeys` → `LayerRow` 鎖頭、半透明 | 例：日本「歷史航班軌跡 Japan」 |
| 空品產品切換 | `src/App.tsx` 2993 | `AqiProductSwitcher` 浮在圖例上方，不在側欄 |
| 拆字函式 | `layerCatalog.ts` `splitThemeTitle` 2085（第一個空格切）vs `DataSourcePanel.tsx` `splitLabel` 77（尾段 ASCII 才切） | 兩支規則不相容；spec §5.5 指定前者為唯一入口 |
| 名稱資料 | `src/data/layerManifest.ts` `label: string`（288），`labelMobile?`（290） | 525 筆 `label: "`；`labelMobile` 約 140 餘筆 |
| 主題資料 | `layerCatalog.ts` `ThemeDef` 124、`JAPAN_TAB_THEME_TITLES` 205（14 個）、`LAYER_MACRO_GROUPS` 1990、`THEME_MACRO_GROUPS`（統計主題已有對應） | |
| 測試 | `src/components/sidebar/__tests__/layerConsistency.test.ts` 440–473 | 讀兩個 sidebar **原始碼字串**比對（`<ParamControlList controls={controls} />`、`StatisticsDetails` 掛載字串） |

## 2. 差異（截圖確認）

| 項目 | 台灣 | 日本 | 統計 | 世界 | 手機 |
|---|---|---|---|---|---|
| 面板標題 | Layers（只有英文） | 日本 Japan | 統計 Statistics | 世界 World | 分頁「圖層」「統計」 |
| 大分類 | 有 | 無 | 無（`THEME_MACRO_GROUPS` 已有對應，未開） | 無 | 台灣主題有 |
| 主題副標 | 英文 | **無** | 英文 | 英文 | 同桌機 |
| 主題預設 | 收合 | **全部展開** | **全部展開** | 收合 | 收合 |
| 圖層名稱 | 中文＋英文一串 | 中文＋日文＋（來源），常換兩行 | 只有中文 | 中文＋英文，常換兩行 | `labelMobile`，筆數寫死、無英文 |
| 列開關 | 黑白列開關 | 同 | 同 | 同 | 圖層分頁空心圓點；統計分頁開關 |
| icon 關閉時 | 灰 | 灰 | **彩色** | 灰 | — |
| 設定順序（例） | 主祀類別→登記→透明度→大小 | 顏色→透明度→大小 | 資料篩選→位置口徑→來源→透明度 | 回溯→透明度 | 同桌機 |
| 面板頂部 | 全部關閉・搜尋 | 同 | ＋單一／可重疊 | 同 | 我的・搜尋 |
| 搜尋範圍 | 本面板 | 本面板 | 本面板 | 本面板 | 本分頁 |

其他：

- 列上沒有說明／來源入口、沒有載入狀態（只有全站載入條 §5.30）；計數要該層有提供才顯示，本次截到的層都沒有。
- 圖例入口不在側欄（右下收合鈕）。
- 手機面板最高約半個螢幕（420px），點把手在 收合→小→420 之間循環。
- 「全部關閉」鈕文字是英文「All Off」，違 spec §6.1（中文標籤）。
- 失業率說明露出內部代碼 `COUNTY_MOI_1140318`，違 spec §6.3。
- 衛星群組列開關用強調色，違 spec §5.10（整層開關要黑白）。
- 部分統計列（例「全年總薪資中位數」）沒有 chevron，同主題內有的能展開有的不能。

## 3. 相關規格

spec §5.1（面板外殼）、§5.5（主題列 LT1、大分類、L2 群組）、§5.8–5.13（分段、select、開關兩階、控制區 V2、多選、滑桿）、§5.22（資料來源 D1）、§5.30（載入狀態條）、§5.32（圖例）、§6.1／§6.3（文案）、§10.2「Layers 面板 ✅ 符合」「資料來源 ⚠️ 部分」、§10.3「Layers rail palette 仍 inline hex」「`LayerSidebar` 開關色」。

## 4. 題目（見 picks.html）

| 題 | 問什麼 | 建議 |
|---|---|---|
| P1 | 列結構、說明入口、載入狀態 | A 精簡列，計數格兼載入轉圈；說明・來源放展開區最後 |
| P2 | 雙語名稱 | A 同一行：中文＋外文小字＋來源標籤（manifest 改 `{zh, alt, qualifier}`） |
| P3 | 日本主題副標 | A 補英文；台灣面板標題改「台灣 Taiwan」 |
| P4 | 大分類與預設展開 | B 主題多的面板才有大分類；全部預設收合 |
| P5 | 設定順序 | A 顏色→透明度→其他外觀→資料篩選→說明（承接配色 Q5） |
| P6 | 統計設定整合 | 先 B（保留區塊、統一外觀位置），之後 A（新控制項型別） |
| P7 | 手機 | B 同一套元件，分頁改四個入口 |
| P8 | 其他清單收編 | A 全部改同一套列元件 |
| P9 | 搜尋 | B 各自搜＋提示其他面板筆數 |

## 5. 實作切分

| 段 | 內容 | 主要檔案 | 風險 |
|---|---|---|---|
| A 不動資料 | 抽 `LayerRow`／`ThemeBanner`／`SubGroupLabel`／`MacroGroupLabel` 到 `sidebar/`；手機改用；收編四份清單；預設收合；搜尋提示 | `IconRailSidebar.tsx`、`LayerSidebar.tsx`、`DataSourcePanel.tsx`、`MainMapConnection.tsx`、`CNGroupSection.tsx`、`MemberPanel.tsx`、`lib/layerSearch.ts` | 低；`layerConsistency.test.ts` 440–473 字串比對必紅，要同步改 |
| B 資料結構 | manifest 名稱結構化（525 筆，腳本轉＋人工例外）；`splitThemeTitle`／`splitLabel` 退場並改 spec §5.5；日本主題英文與大分類；`buildParamControls` 依類別排序＋guard | `layerManifest.ts`、`layerCatalog.ts`、`state/layerParamsControls.ts`、`lib/layerSearch.ts`、Agent 搜尋、場景存檔 | 中；名稱被搜尋與 Agent 讀取，要驗 Agent 回答不露欄位名 |
| C 統計 | `StatisticsDetails` 篩選包成固定一塊、說明併入「說明・來源」、清內部代碼；醫療群組併入；之後才做非同步連動 select 型別 | `StatisticsDetails.tsx`、`MedicalStatisticsGroupControls.tsx`、`layerParamsSpec.ts`、`LayerParamControls.tsx`、`research/layerControls.ts` | B 案低；A 案高（非同步、Agent 白名單、場景存檔） |

## 6. 未截到

- Agent 分析結果清單：需要配對 Agent 才有內容，只截到未配對的空狀態；選擇頁的列名是示意。
- 空品產品切換器、圖例：未開對應圖層，未截。
- 淡色只截到清單視圖（台灣、日本、統計），展開設定只有暗色截圖。
