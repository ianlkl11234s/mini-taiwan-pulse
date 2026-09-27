# Mini Taiwan Pulse — 設計語言統一提案（草案）

> 不改動 `src/` 既有程式碼。本檔是給下一階段施工的規則草案，搭配 `tokens-draft.css`（變數）與 `mockup.html`（視覺對照）閱讀。
> 原則：**延伸既有 `src/styles/designTokens.ts`，不另開一套 scale**——這條主線已在 108 個檔案上驗證過，缺口只在 `research/`、`member/` 兩個子系統與少數字體角色誤用。

## 0. 為什麼不是「重建設計系統」

`docs/design-system.md` 已完整定義 `SURFACE`/`COLORS`/`BORDER`/`RADIUS`/`FONT_SIZE`/`FONT_WEIGHT`/`ELEVATION`/`SPACING`/`FONT_CJK`/`FONT_DATA`，Phase 0–6 已上線。本提案**只做兩件事**：
1. 把 `research/` 與 `member/` 兩個獨立 CSS 子系統接上同一份數值（用 CSS 變數鏡射，因為它們是 `.css` 檔，無法直接 `import` TS 常數）。
2. 修正字體角色被用反的地方，並補齊被跳過的統一結構（popup footer、共用 Title、活動時間軸語彙）。

## 1. 字體角色（收斂為 2 種 + 1 例外）

| 角色 | Token | Stack | 用途 | 禁止 |
|---|---|---|---|---|
| 正文 | `--font-cjk` | `"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif` | 所有中文標籤、地址、機構名、句子、popup/面板本文 | 不得用在整個 popup/面板容器上再讓子節點無腦繼承——只在「真的是句子」的節點上設 |
| 數據 | `--font-data` | `"JetBrains Mono","SF Mono",ui-monospace,Menlo,monospace` | 純數字、時間戳、ID、代碼片段、`└` 群組符號本身 | 不得套在含中文字的容器上（如 popup 外殼、panel header 整段） |
| （例外）品牌大標 | 維持 inline 一次性，不進 token | `Georgia, serif` / `"Songti TC", serif` | 僅 `/research` 獨立頁品牌區使用，若該頁納入統一範圍則淘汰 | — |

**違反現況**：
- `FeatureInfoPanel.tsx:97` `fontFamily: FONT_DATA` 套在整個 popup 容器 → 改成只在數值/時間欄位設，容器改 `--font-cjk` 或不設（繼承 body）。
- `LayerSidebar.tsx:487`、`IconRailSidebar.tsx:912` 的 `└ {title}` 整段 `FONT_DATA` → `└` 符號本身可保留 mono，`{title}` 文字節點應獨立套 `--font-cjk`。
- `mainMapConnection.css` `.main-map-agent { font-family: Inter, system-ui, sans-serif }` → 改 `--font-cjk`（Inter 對中文無字重覆蓋，且未載入 web font，等同白寫）。
- `.research-result-popup__eyebrow`/`__facts dt` 用 `ui-monospace,"SFMono-Regular",Consolas,monospace` → 改 `--font-data`（語意相同，字面統一）。
- `memberPanel.css` 用 `var(--font-cjk, sans-serif)` 但全站未定義 → `tokens-draft.css` 補上這個變數名（沿用同名，回填即可，`memberPanel.css` 不用改）。

## 2. 字級階（延用既有 7 階，不新增）

| Token | px | 用途 |
|---|---|---|
| `--font-xs` | 9 | 標籤/pill/uppercase 小標 |
| `--font-sm` | 10 | 副資訊 |
| `--font-base` | 11 | 預設正文 |
| `--font-md` | 12 | 強調副資訊 |
| `--font-lg` | 13 | 強調正文 |
| `--font-xl` | 18 | 卡片標題 |
| `--font-xxl` | 22 | panel header |

`research/` 子系統目前用到的 29px（`.research-metrics strong`）、22px（`.research-empty h2`）等一次性大字維持 inline，不硬塞進 7 階（比照 design-system.md 對 32/40px 的處理方式）。

## 3. 顏色

沿用 `designTokens.ts` 既有字面，不改值。額外命名：

- `--surface-app/subtle/panel/strong/solid`（= `SURFACE.*`）
- `--text-strong/default/muted/dim/faint/ghost`（= `COLORS.text*`）
- `--border-soft/panel/mid/strong/accent`（= `BORDER.*`）
- `--white-a4/a8/a12/a20/a40/a60`（= `WHITE_ALPHA`，取代 `research`/`member` 各自硬寫的白色半透值）
- **新增** `--light-surface-panel` / `--light-border` / `--light-text-*`：4 套 light theme（`FeatureInfoPanel` 的 `LIGHT_FEATURE`、`.main-map-agent--light`、`.member-panel-light`、`.research-activity-position--light`）目前各自定義、數值相近但不同，統一成一組後各子系統對映即可，不必逐一比對誰對誰錯。

## 4. 間距／圓角／邊框／陰影

直接鏡射 `SPACING{2,4,6,8,12,16,24}`、`RADIUS{sm:2,md:4,lg:6,xl:8,pill:9999,full:50%}`、`ELEVATION{sm,md,lg,dock}`。`research`/`member` 目前用的 `12px`/`30px`(pill)/`5px`/`7px` 等圓角，收斂規則沿用 design-system.md 既有的「3→md／5,7→lg／9,10→xl」，不重新發明。

## 5. 新增：`CONTROL.*` 群組（開啟 design-system.md §8 標記為「未來題目」的項目）

`design-system.md` 明確把「互動態背景」列為刻意不做（§7 KEEP OUT 最後一條）。本提案建議**現在開**，理由：`research/`／`member/` 的 button/select/input 背景各自硬寫（`#343434`／`rgba(255,255,255,.06)`／`var(--member-soft)` 等），若不給一個共用群組，統一 popup／面板時 hover/disabled 狀態會繼續各寫各的。

```
--control-bg / --control-bg-hover / --control-border / --control-disabled-opacity(0.5~0.6)
```

不動 `SURFACE.*`（維持只給面板容器底，語意不混）。

## 6. 元件統一結構草案

### 6.1 Popup（優先度最高）

**已拍板（2026-09-27）**：全部改成右下停靠面板（無尖角）；密度採 `popup-density-variants.html` 的 **B 版「細線緊湊」**：

| 部位 | 規格 |
|---|---|
| 容器 | 280px、`--surface-strong` 底、`1px --border-panel`、`RADIUS.xl`、padding `12px 14px`、字型 `--font-cjk`（不再整個容器套 `--font-data`） |
| Eyebrow | 9px、`--text-dim`、letter-spacing 1.2px，中文「分類 · 子類」 |
| Title | 13px bold `--text-strong`，前置 9px 分類色點；下方 `1px --border-panel` 分隔，padding-bottom 5px |
| Row | 11px、line-height 1.3、padding `3px 0`、每列底線 `1px --border-soft`（最後一列不畫）；標籤 10px `--text-muted` 寬 56px；數值 `--text-strong`，純數字改 `--font-data` + tabular-nums。列高約 21px |
| Footer | 9px `--text-dim`、上方 `1px --border-soft`；無來源時顯示「來源資訊待補」（`--status-warn`） |

**Phase B 施工備註（2026-09-27）**：`Row` 已加 `mono?: boolean` prop（`shared.tsx`），套 `FONT_DATA` + `tabular-nums`。這輪只手動套在 4 處明顯純數值列（`airPanels.tsx` 的 AQI/微感測站 PM2.5·PM10、`shared.tsx` 的 `ChatHighlightPanel` 座標），未跑 regex 全面偵測——**mono 全面套用（41 個 `*Panels.tsx` 逐一過一次數值欄位）留待後續工作**，不在本輪 Phase B 範圍。

**Phase C 施工備註（2026-09-27）**：`shared.tsx` 新增共用 `Title`，13 個 domain 檔改 import、刪本地重複版本。盤點發現的差異：
- 11/13 檔（culture/education/fishery/funeral/japan/livestock/religion/sports/tourism/urban/welfare）的本地版完全相同（10px 色點 flex 佈局、13px bold、letterSpacing 0.5、marginBottom 6，無底線）。
- `jpMedicalPanels.tsx` 少了 `flexShrink: 0`（色點被擠壓的既有小 bug，改共用版後修正）與 `letterSpacing: 0.5`（差異在雜訊範圍內）。
- `networkStructuresPanels.tsx` 原本**沒有色點**，用分類色直接染標題文字（非 `textStrong`），改共用版後視覺變成「9px 色點 + textStrong 文字」——這是本次統一刻意消弭的不一致，非誤改。
- 共用版套 B 版規格：9px 色點（原 10px）、加 `1px solid palette.border` 底線 + `paddingBottom 5`、`marginBottom 4`（原 6）、拿掉 `letterSpacing: 0.5`（規格未列）。

**Phase D 施工備註（2026-09-27）**：`SourceFooter` 改 F2 規格（`shared.tsx`），並改走**做法 (a)**——`FeatureInfoPanel.tsx` 在 `{content}` 後統一掛一次 `<SourceFooter props={feature.properties} />`，取代原本 8 個 domain 檔（culture/energy/fishery/policeJustice/publicLife/religion/urban，共 61 處）各自呼叫 `<SourceFooter props={props} />`——這些呼叫因為 `props` 本來就等於 `feature.properties`，拿掉後行為完全等價，換來「41 個 registry panel 全數有 footer」不用逐檔補。

**例外清單**（`FeatureInfoPanel.tsx` 的 `FOOTER_SELF_MANAGED_LAYER_TYPES`，中央版跳過）：
- `chatHighlight`：AI 助手標記點，非資料圖層，依規格不掛 footer。
- `publicToilet`／`disasterShelters`／`nationalParks`：panel 內把常數 `source_org`/`license`/`source_url` 併進 `props`（上游 feature 本身沒有這些欄位，是 panel 端補的產品知識），中央版讀原始 `feature.properties` 拿不到這些 enrich 後的值，維持各自的 `SourceFooter` 呼叫。
- `osmBridgeCarriers`／`osmBridgeFootprints`／`officialBridgesNewTaipei`／`bridgeComparisonNewTaipei`／`tainanBridgeInspections`／`officialBridgesHsinchu`／`taipeiRoadTunnels`／`tainanRoadTunnels`／`changhuaTrafficSignals`（`networkStructuresPanels.tsx` 全部 9 個 panel）：整份檔案走自訂 `SourceRows`（欄位命名慣例是 `source_name`/`source_date`/`retrieved_at`，不是 F2 讀的 `source_org`/`license`/`fetched_at`），兩種 schema 對不上，硬套中央版只會誤判成「無來源」，故維持現狀不動。
- 水庫 context 特例（`isReservoirContextView`：點到有 `compare_id` 的水庫且 context 已載入）：這個分支顯示的是彙整水情/集水區/流域/最近河川等多個資料源，`feature.properties` 只代表其中一筆（水庫點本身），不是整個彙整視圖的代表來源，中央版在此分支略過。

**F2 規格落地**：第一行 `機關 · Tier N · 原始下載頁 ↗`（任一項缺就省略，不留孤立分隔符）；第二行 `license ＋ 抓取於 …`（`FONT_DATA` 等寬）；`org`/`url` 兩者都沒有時整段改顯示「資料來源 · 來源資訊待補」（`warn` 色，暗色沿用既有 `COLORS.statusWarn` #ff9800、淡色新增 `#c2410c`），不半調子顯示其他欄位。跨來源 `_provenance`／`provenance` 陣列沿用舊版 `length > 1` 才收合展開（1 筆會跟第一行重複，不重複顯示），標籤字樣改「溯源 N 筆」（原「跨來源溯源（N 筆）」，貼近 handoff.md 字面）。新增 `src/components/featureInfo/__tests__/shared.test.ts` 直接測 F2 四種情境（完整欄位／只有 url／完全無來源／provenance 收合門檻）。

以下結構規則沿用：

```
┌ Eyebrow（--font-xs, --font-data, uppercase, --text-dim, letter-spacing 1.2~1.6px）
│   圖層類別中文名稱（不寫死英文 "ANALYSIS RESULT"；Agent 分析結果沿用 HEADER_LABELS 同一份中文標籤表）
├ Title（--font-lg/xl, --font-cjk, --text-strong, 可選色點/色塊表達分類色）
├ Facts（統一用 <Row label value> 兩欄，來源不論 React 狀態或 DOM 字串拼接都套同一份視覺 spec；
│         禁止把內部識別碼原樣輸出 — Agent 分析結果的 `datasetId` 需先過一層人類可讀標籤映射表再顯示，
│         不顯示 `warehouse:wh-8` 這類代號）
├ （可選）跨筆選擇器 / 展開詳情
└ SourceFooter（強制；沒有來源資訊時顯示「來源資訊待補」而非整段省略，避免「補了才算有掛」的隱性判斷）
```

**違反現況**：`shared.tsx` 未 export `Title` → 13 個 domain 檔各自複製；41 個 `*Panels.tsx` 中 32 個無 `SourceFooter`；`religionPanels.tsx` 內 7 個 panel 4 個有 3 個沒有；Agent 分析結果 popup 的 `DATASET` 欄直接印 `properties.datasetId` 原始值（`MainMapConnection.tsx:454`）。

### 6.2 面板標頭（Panel Header）

```
┌ 圖示（可選）+ 標題（--font-xxl/xl, --font-cjk, --text-strong）
├ 關閉鈕：統一 <X size={14} /> from lucide-react（design-system.md 已定，`admin`/`chat`/`feature-info` 已遵守）
└ 分隔線：borderTop 1px solid var(--border-panel)（不用各自硬寫的 rgba/hex 字面）
```

`research/`（`.main-map-agent h2`）、`member/`（`.member-header h2`）需改吃 `--border-panel` 而非現有的 `#ffffff1a` / `var(--member-line)` 字面值（值可以維持接近，但改成同一個變數來源）。

### 6.3 分隔線／時間軸

**兩選一，不並存**（這是待決項，見 `handoff.md`）：
- (A) 沿用 Layers 面板的 `└` 字元縮排語彙，活動時間軸改用同樣符號 + `--font-data` 呈現階層，取消 `border-left` 直線。
- (B) 沿用活動時間軸的 `border-left: 1px solid var(--border-soft)` 語彙，反向套用回 Layers 面板的群組標題，取消 `└` 符號。

本提案傾向 (B)：`└` 依賴等寬字元對齊，換字體/換語言（未來若做英文版）容易錯位；實體 `border-left` 是純 CSS，不受字型影響，更穩定。但這是視覺習慣的取捨，留給使用者拍板。

### 6.4 圖例（Legend）

現況已一致（`LegendPanel.tsx` 統一走 `LEGEND_REGISTRY`），本提案不變動，僅要求新增圖例一律走同一 registry，不得在個別面板內另開色塊 legend（目前未發現違反）。

### 6.5 按鈕

沿用 `design-system.md §9.5` 既有禁忌表，新增一條：按鈕背景改用 `--control-bg`（見 §5），不用 `SURFACE.*` 也不用各自硬寫（`research.css` 的 `.research-primary{background:#204f43}` 之類）。

## 7. 每條規則「目前違反處」對照表（彙整，方便施工勾選）

| 規則 | 違反檔案:行 |
|---|---|
| popup 容器不可整段 `FONT_DATA` | `FeatureInfoPanel.tsx:97` |
| 群組標題文字不可整段 `FONT_DATA` | `LayerSidebar.tsx:487`、`IconRailSidebar.tsx:912` |
| 面板字體走 `--font-cjk`，非 `Inter` | `mainMapConnection.css` `.main-map-agent`、`.main-map-agent--embedded` |
| popup eyebrow/facts 走 `--font-data`，非裸 `SFMono-Regular` | `mainMapConnection.css` `.research-result-popup__eyebrow` 等 4 處 |
| `--font-cjk` 需有定義 | `memberPanel.css`（消費端），`tokens-draft.css`（供給端，本提案已補） |
| Title 元件需共用，不得各自複製 | 13 個 `featureInfo/*Panels.tsx`（清單見 `token-census.md` §H） |
| SourceFooter 需強制掛 | 32 個 `featureInfo/*Panels.tsx`（含 `religionPanels.tsx` 的 `TemplePanel`；明細見 `token-census.md` §I） |
| 內部代號不可直接顯示給使用者 | `MainMapConnection.tsx:454`（`DATASET` 欄 = `properties.datasetId`） |
| 分隔線走 `--border-panel`，非各自硬寫 | `mainMapConnection.css`、`memberPanel.css`、`researchActivity.css` |
| 按鈕背景走 `--control-bg` | `research.css` `.research-primary/.research-secondary`、`mainMapConnection.css` `.main-map-agent button` |
| light theme 共用一組變數 | `FeatureInfoPanel.tsx` LIGHT_FEATURE、`.main-map-agent--light`、`.member-panel-light`、`.research-activity-position--light` |

## 8. 不做的事（比照 design-system.md §7 KEEP OUT，追加）

- 不把 `research/` 現有的獨立品牌大標（Georgia/Songti TC）強制改成主站字體——若 `/research` 頁保留獨立品牌調性是刻意決策，予以保留，僅要求**嵌入主站的 `MainMapConnection`／活動卡部分**跟主站一致（這兩者已經是深色系、跟 research.css 的淺色品牌頁在視覺上本來就分離，不衝突）。
- 不重新設計 `LAYER_COLORS`。
- 不引入 CSS 框架，延續 inline style + CSS 變數（跟現有 `design-system.md §0` 決策一致）。
- 不一次改完全部：比照既有 Phase 制，一個提案項目一個 PR。
