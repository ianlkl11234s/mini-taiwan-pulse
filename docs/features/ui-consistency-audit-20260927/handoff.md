# Handoff — Mini Taiwan Pulse UI/UX 統一施工

> 給接手這項工作的下一個 session／協作者。本檔目的是讓你不用重跑一次盤點就能接著討論與動工。
> 背景 session 只做了**唯讀盤點 + 草案**，`src/` 內沒有任何檔案被改動。

## 1. 背景

使用者（透過 Layers／Agent 協作面板／popup 的實際使用經驗）回饋三件事：
1. 「與 Agent 協作」面板的活動時間軸用一條白色分隔直線，跟 Layers 面板既有語彙（縮排＋「└」）不同。
2. 字級、字體不一致（標題／按鈕是等寬字，面板內文是一般字，popup 又不同）。
3. 點地圖出現的 popup 每種都長不一樣（Agent 分析結果 popup 深底＋大寫小標＋DATASET 欄；文化設施 popup 色點＋橘色類型字＋欄位；寺廟 popup 兩欄對照表）。

本次任務：**唯讀盤點全站**（不只上述三處），並產出可供下一階段直接動工的草案（不落地到 `src/`）。

## 2. 盤點結論摘要

**核心發現：專案已經有成熟、文件化的 token 系統，問題不是「沒有」而是「三個具體缺口」。**

- SSOT：`src/styles/designTokens.ts` + `docs/design-system.md`（Phase 0–6 已完成，108 個檔案採用），涵蓋 App 主體、全部 41 個 `featureInfo/*Panels.tsx`、AI 助手、Intel/Monitor、衛星面板、Layers/Locations/統計/世界/日本（同一 `IconRailSidebar.tsx`）、Settings、Info、Share、圖例。**這條主線內部一致。**
- 缺口 1：`src/research/*`（與 Agent 協作面板、活動時間軸、Agent 分析結果 popup）是獨立子系統，用 4 支自己的 CSS 檔（`research.css`／`mainMapConnection.css`／`researchActivity.css`）硬寫顏色字體，完全沒 import designTokens。
- 缺口 2：`src/components/member/memberPanel.css`（會員專區）同樣獨立 CSS，`var(--font-cjk, sans-serif)` 全站無人定義，恆常 fallback。
- 缺口 3：就算在已採用 token 的檔案裡，字體角色也用反了——`FeatureInfoPanel.tsx:97` 把整個 popup 容器設成 `FONT_DATA`（等寬），違反 `design-system.md §9.2`「中文 → FONT_CJK」；`LayerSidebar.tsx:487`／`IconRailSidebar.tsx:912` 的 `└ {title}` 群組標題同樣整段套等寬字。
- 全站**沒有載入任何 web font**（無 `@font-face`／無 googleapis／`public/` 無字型檔），`FONT_DATA`／`FONT_CJK`／research 的 `Inter`／popup 的 `SFMono-Regular` 這 4 組 stack 字面不同、fallback 順序不同，在使用者 Mac 上最終各自解析成不同系統字，渲染結果肉眼可辨不同。
- Popup 不一致的根本原因**不只是樣式**：文化設施／寺廟走 `FeatureInfoPanel`（React 固定面板，停靠畫面右下角，不跟隨點擊點，`App.tsx:3007`），Agent 分析結果走真正的 `mapboxgl.Popup`（錨定經緯度、帶尖角，`MainMapConnection.tsx:478`，DOM 用 `document.createElement` 手刻非 React）。這是產品機制差異，統一樣式解決不了。
- `shared.tsx` 沒 export 共用 `Title` 元件，導致 13 個 domain 檔（`culturePanels`/`religionPanels`/`educationPanels`/`funeralPanels`/`fisheryPanels`/`jpMedicalPanels`/`livestockPanels`/`networkStructuresPanels`/`japanPanels`/`sportsPanels`/`urbanPanels`/`tourismPanels`/`welfarePanels`）各自複製貼上同一段程式碼，註解自承「同 urbanPanels 慣例」。
- `SourceFooter`（資料來源標示）覆蓋率低：41 個 `featureInfo/*Panels.tsx` 中 **32 個完全沒用**；`religionPanels.tsx` 單檔 7 個 panel 只有 4 個有掛，寺廟本體（`TemplePanel`）沒有。
- Agent 分析結果 popup 把內部識別碼（`properties.datasetId`）直接印成 `DATASET` 欄位值給使用者看（`MainMapConnection.tsx:454`）。
- 4 套各自手刻的 light theme（`FeatureInfoPanel` 的 `LIGHT_FEATURE`／`.main-map-agent--light`／`.member-panel-light`／`.research-activity-position--light`），數值相近但不共用。
- 截圖**未執行**：`cmux browser surface:30 eval "document.hidden"` 兩次回傳 `true`（分頁非前景），依任務指示改為純程式碼盤點；`mockup.html` 的「現況」欄位是逐一核對 class 名稱／token 字面重現，非憑印象臆測。

完整散值統計（font-family/字級/顏色/rgba/radius/box-shadow 的實際計數、4 套 light theme 對照、Title 重複清單、SourceFooter 覆蓋率）見同資料夾的 `token-census.md`（純資料表，本檔不重複列，重點數字已摘入上方）；規則與違反處對照表見 `proposal.md` §7。

## 3. 已產出的提案

- **`proposal.md`**：設計語言草案——字體角色收斂為 2 種（`--font-cjk` 正文／`--font-data` 純數據）+ 1 個 research 品牌大標例外；沿用既有 7 階字級／6 階圓角／7 階間距／4 階陰影，不新開 scale；新增 `CONTROL.*` 互動態背景群組（`design-system.md §8` 原本標記「未來題目」，本提案建議現在開）；popup／面板標頭／分隔線時間軸／按鈕的統一結構規則，逐條附「目前違反處 file:line」。
- **`tokens-draft.css`**：CSS 變數草案，暗色為主，數值 1:1 鏡射 `designTokens.ts`，額外補 `--font-cjk`／`--font-data`（供 `memberPanel.css` 既有的 `var(--font-cjk)` 直接吃到）、4 套 light theme 收斂成一組 `--light-*`、新增 `--control-*`。**純草案，尚未接進任何 `.css`／`.tsx`。**
- **`mockup.html`**：單一靜態 HTML（inline CSS，不依賴建置），現況 vs 建議並排：Agent 分析結果／文化設施／寺廟 3 種 popup 統一（分析結果範例用示意代號，非真實內部識別碼）、面板標頭（member vs agent 兩種現況 → 一種建議）、分隔線／時間軸（`└` vs 白線 → 統一 `border-left`）、圖例（現況已一致，僅作參考）、額外的示意泡泡圖（學校數×補習班密度，5 站示意資料，依 dataviz skill 規格：單色相序列色階、薄描邊、僅前 5 名直接標籤、圖例常駐）。

## 4. 待決問題清單（需要使用者拍板）

1. **Popup 錨定方式**：文化設施／寺廟（固定右下角面板）vs Agent 分析結果（錨定地圖點擊點的 `mapboxgl.Popup`）要不要統一成同一種機制？這是本次盤點發現的**最大結構差異**，純 CSS/token 統一無法解決，需要先決定要不要動這塊互動邏輯（影響 `FeatureInfoPanel.tsx` 與 `MainMapConnection.tsx` 兩條完全不同的渲染路徑）。
2. **分隔線／時間軸語彙**：`proposal.md §6.3` 建議統一走 `border-left`（淘汰 `└` 字元），理由是不依賴等寬字元對齊、較穩定；但這是既有視覺習慣的取捨，需使用者確認方向，或反過來統一成 `└`。
3. **是否載入 web font**：目前 `FONT_DATA`／`FONT_CJK`／`Inter` 全部沒有實際載入字型檔，都是系統字 fallback。要不要實際載入（會增加首屏成本），還是乾脆把 token 名稱改成反映現實的系統字 stack（不再暗示「JetBrains Mono」「Inter」這些其實沒生效的字體）？
4. **是否現在開 `CONTROL.*` token 群組**：`design-system.md §8` 原本刻意把互動態背景列為「未來題目，不在 Phase 0–6 scope」。本提案建議現在開（理由見 `proposal.md §5`），但這牴觸既有文件的既定決策，需要使用者確認要不要「重開」這個已經拍板過的範圍。
5. **`/research` 獨立頁（standalone research.html，淺色系 + Georgia/Songti TC 品牌調性）是否納入統一範圍**：本提案傾向保留其獨立品牌調性（只要求嵌入主站的 `MainMapConnection`／活動卡部分跟主站一致），但這是刻意排除還是應該一併處理，需使用者確認。
6. **`SourceFooter` 缺席的 32 個檔案，是否全部要補**：還是部分圖層本來就沒有可標示的來源（例如衍生計算欄位），需要一份例外清單而非無腦全補。

## 4a. 拍板結果（2026-09-27 使用者確認）

| # | 決定 | 影響 |
|---|---|---|
| 1 | **全部改成右下停靠**：Agent 分析結果改進 `FeatureInfoPanel` 停靠面板，拿掉 `mapboxgl.Popup` 錨定與尖角 | Phase E 改 `MainMapConnection.tsx` 的 popup 建構路徑 |
| 2 | **(B) `border-left` 直線**，淘汰 Layers 群組標題的 `└` | Phase E |
| 3 | **不載入 web font**，`--font-cjk`／`--font-data` 改寫成實際生效的系統字 stack | Phase A |
| 4 | **現在開 `CONTROL.*`**，同步更新 `design-system.md §8` 決策紀錄 | Phase F |
| 5 | **`/research` 獨立頁一併統一**（改走主站暗色情報風格，不保留 Georgia/宋體品牌調性） | Phase F 範圍擴大 |
| 6 | **`SourceFooter` 全部補**，沒有來源顯示「來源資訊待補」 | Phase D |
| — | 捷運站排名泡泡圖：**先不做個案**，之後與通用圖表函式庫一起設計 | 移出本輪 |

**Popup 視覺方向**：保留分隔線的條理，但行距要比 mockup §1「建議」版更緊，走精簡情報風格（參考現行寺廟 popup 的密度）。密度候選版見 `popup-density-variants.html`，**使用者選定 B 版（細線緊湊）**，規格已回寫 `proposal.md §6.1`。

**相關後續**：泡泡圖與通用圖表函式庫的規劃見 [`docs/features/general-analysis/PLAN-round3-20260927.md`](../general-analysis/PLAN-round3-20260927.md) 下一步建議 §1（依賴本次 popup／面板／token 規範拍板後再動工）。

**第二輪拍板**：每個 Phase 一個 PR（共 6 個）；停靠後在點擊處加選取圈（全站圖層共用）；eyebrow 用「圖層群組 · 圖層名」；設計稿一律暗／淡色並排。待選項（選取圈樣式、footer、Layers 群組、面板標頭、按鈕）見 `ui-unification-sheet.html`。

**第三輪拍板（`ui-unification-sheet.html`）**：

| 區 | 選定 | 規格要點 |
|---|---|---|
| 1 popup 暗／淡 | ✔ | B 版；淡色用 `LIGHT_FEATURE` 值 |
| 2 選取圈 | **R2 呼吸脈衝** | 實線 24px 圈（2px accent）＋同心圈 1.8s 擴散到 58px 淡出；`prefers-reduced-motion` 時改靜態 36px 淡圈；popup 關閉即移除；全站圖層共用 |
| 3 來源 footer | **F2** | 第一行「機關 · Tier N · 原始下載頁 ↗」；第二行授權＋抓取時間（等寬）；有 provenance 時 `<details>` 收合「溯源 N 筆」；無來源顯示「資料來源 · 來源資訊待補」（warn 色） |
| 4 Layers 群組 | **L2** | 群組標題 CJK 10px semibold `--text-muted`，標題右側拉 1px `--border-soft` 細線到底；子項目縮排 14px；淘汰「└」 |
| 5 活動時間軸 | ✔ | 保留 `border-left`（`--border-mid`），時間戳 `--font-data`，外框同 popup（8px 圓角、`--surface-strong`） |
| 6 面板標頭 | **H2** | eyebrow 9px `--text-dim` ＋ 13px bold 標題，下方 `--border-panel`，padding 10×14 |
| 7 按鈕 | **C2** | 一般：`--control-bg`＋`--control-border`；主要：`--accent-faint` 底＋accent 框＋accent 字；focus 2px accent outline；disabled opacity .55 |
| 8 research.html | ✔ | 暗色情報風，左欄面板＋右地圖，三段改 eyebrow＋`border-left` |

**第四輪拍板（`ui-controls-sheet.html`，2026-09-27）**：

| 區 | 選定 | 規格要點 |
|---|---|---|
| 1 工具列 | **T2 工具列底板** | 右側單一底板（`--surface-strong`、1px `--border-panel`、圓角 7、padding 3）；項目高 26、圓角 4；順序：即時／歷史分段 ｜ 底圖 ｜ 分享（圖示）、說明（圖示）、AI、**拍攝模式**（C2 主要按鈕）｜ 帳號。拿掉 Monitor BETA 按鈕（左側 rail「監測模式」保留）；第二排併入；操作提示移進「說明」 |
| 1 左上 | 品牌字標維持 `FONT_DATA` 粗體（刻意例外），18 → 20px，與右側工具列垂直置中；計數列「flights · ships · 台灣好行」整行拿掉；座標改「25.0464, 121.5318 · z12.5 · 仰角 0° · 方位 0°」 |
| 1b 拍攝模式 | **P2 滑過才出現** | 離開提示「離開拍攝模式 Esc」平常隱藏，滑鼠移動淡入、靜止 2 秒淡出；副標改 CJK |
| 1c 底圖 | **B3 純圖示** | 地圖圖示＋右下色點；展開靠右的 7 格縮圖（中文名）＋「顯示地名」開關 |
| 2 即時情報 | ✔ | H2 標頭、中文不用等寬字、徽章兩種公式（分類淡底／程度外框）、分段分頁、左線時間軸；計數口徑不在本輪 |
| 3 圖層控制 | **V2＋S1** | 標籤＋數值一行、滑桿全寬在下；2px 軌道＋10px 圓點；標籤中文；開關迷你切換；Hide→眼睛圖示；chevron 統一 |
| — | design system | repo 文件（`docs/design-system.md`）＋參考頁＋自動檢查（測試） |
| 4 資料來源 | **D1 列內展開** | 左側 rail 新增「資料來源」（資料庫圖示，Locations 之後）；拿掉右下浮動 ⓘ 與置中詳細視窗；面板外殼同 Layers（H2、搜尋、主題／L2 群組）；統計改篩選分段；點列在清單內展開上游資料卡（同時只展開一筆）；「LEGEND」改「圖例」 |
| — | PR 切法 | G（工具列）、H（即時情報）、I（圖層控制）、K（資料來源）、J（design system）各自 commit、各自 PR |

**第五輪拍板（第二輪統一，`round2-sheet.html`，2026-09-28）**：使用者選 1-LT1、2-Z1、3、4、5-S1（移除設定）、6-M1、7、8。

| 區 | 選定 | 規格要點 | 實作 |
|---|---|---|---|
| 1 Layers 主題標題 | **LT1** | 主題中文 13px semibold、英文 10px text-dim 不大寫、計數固定等寬 10px dim（不依狀態變色）；大分類只留中文 9.5px letterSpacing 1.2＋右側細線（同 L2 線色）；`splitThemeTitle()` 為唯一拆分入口 | Phase N `efff01d4` |
| 2 面板重疊 | **Z1** | `Z_INDEX`／`--z-*`：mapOverlay 10／floatingPanel 20／toolbar 25／popover 30／modal 40／toast 50；左側浮動面板互斥（Agent、地震回放、即時情報、衛星、會員；關地震回放＝關圖層）；時間軸維持 10（地圖控制列，在浮動面板之下）；同層靠 DOM 順序；特例（LoadingScreen 9999、資料更新中遮罩／LoadingIndicator 1000、提示訊息 3000、host 錯誤 10000、Admin 10001）登記於 design-system §5.25 | Phase O `8b4a6f43`；Phase Q 收尾（modal／對話浮層／會員面板歸層、提示訊息保留 3000） |
| 3 說明視窗 | ✔ | H2 標頭、lucide X、語言分段「中文／EN」、卡片 CONTROL.bg＋BORDER.soft、kbd 等寬 9.5px；移除 uppercase 與 ▶ | Phase P `1370a736` |
| 4 分享視窗 | ✔ | H2 標頭；欄位 `grid 1fr auto`、複製鈕固定 74px（文字切換不跳動）；成功 2 秒主要樣式 | Phase P `3f8b9741` |
| 5 設定 | **S1 移除** | 移除 rail 上只會跳「設定功能規劃中」的齒輪；規則：不放沒有功能的占位按鈕，有需求再加 | Phase N `4a643ac6` |
| 6 手機標頭 | **M1** | 高 44；MTP＋座標；外露 AI／拍攝模式／⋯／帳號，按鈕 30×30 圓角 6；「⋯」選單 190px | Phase O `a22daf14` |
| 7 其他原生滑桿 | ✔ | 共用 `controls/Slider`（`.ctl-range`）；Agent 分析結果透明度與圖層控制 `LayerParamControls` 也收斂到同一元件，`.lpc-range` 刪除；guard `native-range` 白名單只剩 `Slider.tsx` | Phase P `8c7f9fd5`；Phase Q |
| 8 Inter 殘留 | ✔ | 全部改 `FONT_CJK`（guard `web-font` 基準歸零） | Phase N `099cf4c6`；Phase Q（App 私人圖層提示） |

Phase Q 另新增 guard `raw-z-index`（≥10 的寫死層級數字只能減少），並把以上規格寫進 `docs/design-system.md` §5.5、§5.25–§5.29 與參考頁。已知未處理：手機時間軸條淡色時仍是暗色底；`Z_INDEX.toast` 暫無使用者（提示訊息需高於 1000 遮罩）；ChatPanel／手機會員面板暫放 modal 層（表上缺側欄槽位）——見 design-system §10.3。

## 5. 建議施工順序與驗收方式

沿用 `docs/design-system.md` 既有的「每 Phase 一個獨立 PR」慣例，不一次大改：

1. **Phase A（低風險，先做）**：`tokens-draft.css` 補完 `--font-cjk`／`--font-data` 定義 → `memberPanel.css` 的 `var(--font-cjk)` 立刻生效，不用動其他邏輯。驗收：`npx tsc -b` 綠燈（純 CSS 變數不影響 TS）+ 肉眼比對會員面板字體有變化。
2. **Phase B**：修正字體角色誤用——`FeatureInfoPanel.tsx:97` 容器字體改 `--font-cjk`（或移除，讓子節點各自宣告）；`LayerSidebar.tsx`／`IconRailSidebar.tsx` 的 `└ {title}` 拆成符號（mono）+ 文字（CJK）兩段。驗收：跑 `npm test`（含 `layerConsistency`）+ 手動點開 3–5 個不同圖層 popup 比對中文是否還在等寬字下顯示。
3. **Phase C**：`shared.tsx` export 共用 `Title`，13 個檔案改 import，刪除本地重複版本（外科手術式修改，逐檔小 PR 或一次性 codemod + 逐檔跑對應 `__tests__`）。
4. **Phase D**：`SourceFooter` 補齊或建立例外清單（先請使用者拍板待決問題 6）。
5. **Phase E（需先拍板待決問題 1、2）**：popup 錨定方式統一 + 分隔線／時間軸語彙統一——這兩項牽動互動邏輯與既有測試（`researchActivity.test.ts`、`resultOverlay.test.ts`、`layerConsistency.test.ts` 等），建議放最後、且獨立 PR。
6. **Phase F**：`research/` 與 `member/` 兩支 CSS 接上 `tokens-draft.css` 的完整變數集（面板 chrome／按鈕／light theme），逐步淘汰各自硬寫的 rgba/hex 字面。

每個 Phase 完成後跑 `npx tsc -b` + `npm test`（含 `layerConsistency`），並比照 `docs/design-system.md §6` 的遷移狀態表格式登記進度。

## 5a. Q3 補充：var 命名本身就是保險

待決問題 3（要不要真的載入 web font）是二選一問題，但 `--font-cjk`／`--font-data` 這兩個**變數名稱**不管答案是哪個都該先定下來——用變數間接引用，之後不管是「真的載入 JetBrains Mono/Inter」還是「乾脆承認都是系統字、把 fallback stack 寫得更誠實」，消費端（`memberPanel.css` 等）都不用再改一次。先定名稱、字面值可以晚點再拍板。

## 6. 相關檔案路徑

- Token SSOT：`src/styles/designTokens.ts`、`src/components/intel/intelTokens.ts`、`docs/design-system.md`
- Feature popup：`src/components/FeatureInfoPanel.tsx`、`src/components/featureInfo/{shared,featureTheme,registry,culturePanels,religionPanels}.tsx`
- Agent 分析結果 popup：`src/research/MainMapConnection.tsx`（DOM 建構於 ~L440-478）、`src/research/mainMapConnection.css`、`src/research/researchResultPopup.ts`
- 活動時間軸：`src/research/ResearchActivityCard.tsx`、`src/research/researchActivity.css`
- 會員專區：`src/components/member/MemberPanel.tsx`、`src/components/member/memberPanel.css`
- Layers/Locations/統計/世界/日本：`src/components/IconRailSidebar.tsx`、`src/components/LayerSidebar.tsx`
- Monitor：`src/components/intel/monitor/*`
- AI 助手：`src/components/chat/ChatPanel.tsx`（本次盤點中最乾淨的一個面板，可當範本）
- 其他：`src/components/{InfoModal,ShareModal,DataSourceModal,LegendPanel,TimelineControls}.tsx`、`src/components/admin/AdminPanel.tsx`、`src/components/satelliteConsole/*`
- 本次交付物：`proposal.md`、`tokens-draft.css`、`mockup.html`（同資料夾）

## 7. 已知限制

- 未截圖驗證實際渲染（瀏覽器分頁非前景，依指示未強行操作）。`mockup.html` 的「現況」欄位雖逐一核對程式碼結構，仍建議接手者實機開一次 `http://127.0.0.1:3734` 核對再動工。
- `SourceFooter` 覆蓋率統計是**檔案層級**粗量（`grep -L`），非逐一確認每個 `export function` 是否都該有 footer；細節需要施工時逐一過。
- 顏色/rgba/字級的量化統計含 `LAYER_COLORS`（圖層代表色，刻意排除在 token scale 外），數字僅供量級參考，非直接的 token 化建議標的。
