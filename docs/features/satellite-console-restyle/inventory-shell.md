# 衛星情報面板盤點：外殼與清單區（唯讀）

- 盤點日：2026-10-04；分支 `feat/rail-routes-static`（工作區有其他 session 未提交改動，本盤點未動任何檔案）
- 路徑前綴：`src/components/satelliteConsole/`（下稱 `sc/`），`src/components/intel/`（下稱 `intel/`）
- 規格：`docs/design-system/spec.md`
- 範圍內：`SatelliteConsole.tsx`、`SatelliteConsoleHeader.tsx`、`satelliteConsoleTokens.ts`、`CNGroupSection.tsx`、`TWFleetSection.tsx`、`CoverageStatsSection.tsx`、`App.tsx` 接線、`src/state/satelliteConsoleStore.ts`
- 範圍外（只在必要處提及）：`ManeuverAlertSection.tsx`、`SatelliteDetailCard.tsx`、`ManeuverCompareModal.tsx`

---

## 0. 共用元件與範本（實際檔名與 export）

| 用途 | 檔案 | export | 衛星面板有沒有用 |
|---|---|---|---|
| 面板 H2 標頭 | `src/components/sidebar/PanelHeader.tsx:12` | `PanelHeader({ title, onClose, borderColor, mutedColor, textColor, titleSize?, className?, eyebrow? })`；傳 `eyebrow` 走 H2（9px eyebrow＋13px h2、`10px 14px`、lucide `<X size={14}/>`、`aria-label="關閉{title}"`） | ❌ 手刻（`sc/SatelliteConsoleHeader.tsx`） |
| 即時情報標頭（範本） | `intel/IntelHeader.tsx:34` | `IntelHeader`（也是手刻，不走 PanelHeader，但已是 H2：eyebrow「情報」在上、標題 `FONT_SIZE.lg` 700、padding `10px 14px`） | 衛星參考過但沒跟上 H2 |
| 列元件 | `src/components/sidebar/LayerRow.tsx:74` | `ListRow`（props `ListRowProps` @37）、`LayerRow`@157、`RailToggle`@13、`LayerNameLine`@22 | ✅ 只在 CN 群組列（`sc/CNGroupSection.tsx:106`） |
| 列開關 | `src/components/sidebar/LayerToggleSwitch.tsx:13` | `LayerToggleSwitch`、`LAYER_TOGGLE_PALETTE`@8 | ✅ 經 `ListRow`→`RailToggle` 間接使用；footer 的「顯示全部軌道」仍是原生 checkbox |
| rail 色票 | `src/components/sidebar/railTheme.ts` | `RailPalette`@10、`DARK_PALETTE`@20、`LIGHT_PALETTE`@30、`railPalette()`@40、`RailThemeContext`@42、`useRailTheme`@43 | ✅ 但寫死 `DARK_PALETTE`（`sc/CNGroupSection.tsx:183-184`） |
| 群組／大分類標題 | `src/components/sidebar/ThemeBanner.tsx` | `ThemeBanner`@11、`SubGroupLabel`@67、`MacroGroupLabel`@91 | ❌ 區段標題全手刻英文 |
| 來源 footer | `src/components/featureInfo/shared.tsx:158` | `SourceFooter({ props })`（給 popup，吃 `source_org`／`source_url`…） | ❌ 面板底部手刻一行 |
| 其他 popup 元件 | `featureInfo/shared.tsx` | `Title`@11、`Row`@45、`Badge`@99 | ❌ |
| 即時情報主題 | `intel/intelTheme.tsx` | `IntelPalette`@18、`DARK_INTEL`@55（`panelBg: SURFACE.strong`）、`LIGHT_INTEL`@86、`getIntelPalette()`@118、`useIntelTheme`@125、`IntelThemeProvider`@127、`chipText`@198、`levelColor`@209、`neutralFill`@222 | ❌ 衛星直接用靜態 `COLORS`（只有暗色） |
| 徽章兩公式 | `intel/intelTokens.ts` | `chipTint`@85、`chipOutline`@90、`withAlpha`@72 | ❌ 衛星徽章全手寫 rgba |
| token 來源 | `sc/satelliteConsoleTokens.ts:6-12` | re-export `FONT_CJK, FONT_DATA, COLORS, clockTime, fmtCountdown` from `intel/intelTokens`；另定義 `MANEUVER_TOKEN`@18、`CN_GROUPS_META`@46、`INTL_GROUPS_META`@56、`CN_GROUP_TO_CATEGORY`@69、`GROUP_FLAG`@90、`PANEL_WIDTH=412`@101 | — |

---

## 1. 共通機制

| 項目 | 衛星情報現況 | 位置 | 即時情報（範本） | 位置 |
|---|---|---|---|---|
| 掛載 | App 直接渲染，`open` 由 store 控制；未開時 `return null` | `App.tsx:2384-2390`；`sc/SatelliteConsole.tsx:58` | App 渲染並傳 `isDarkTheme` | `App.tsx:2411-2414` |
| 狀態 store | `useSyncExternalStore`；欄位 `open / selectedNorad / compareManeuver / showAllOrbits`；方法 `setOpen / toggleOpen / selectNorad / openCompare / closeCompare / setShowAllOrbits`；**沒有主題欄位** | `src/state/satelliteConsoleStore.ts:9-72` | 本地 state | — |
| 位置 | `position: fixed; left: 64; top: LAYOUT.leftDockTop(60); bottom: 130` | `sc/SatelliteConsole.tsx:64-67` | 相同 | `intel/IntelPanel.tsx:456-459` |
| 寬度 | `PANEL_WIDTH` = 412 | `sc/satelliteConsoleTokens.ts:101`；`sc/SatelliteConsole.tsx:68` | 字面 `412` | `intel/IntelPanel.tsx:460` |
| 背景 | `SURFACE.strong`＋`blur(16px)`（只有暗色） | `sc/SatelliteConsole.tsx:69-71` | `palette.panelBg`（暗 `SURFACE.strong`／淡 `LIGHT.surfacePanel`） | `intel/IntelPanel.tsx:461`；`intel/intelTheme.tsx:57,88` |
| 外框 | `1px COLORS.panelBorder`；歷史模式改 `rgba(255,152,0,0.45)` 手寫 | `sc/SatelliteConsole.tsx:72` | `palette.panelBorder` | `intel/IntelPanel.tsx:464` |
| 陰影 | 字面 `"0 12px 40px rgba(0,0,0,0.45)"`（＝`ELEVATION.lg` 值但未取 token）；歷史模式加 `rgba(255,152,0,0.18)` 光暈 | `sc/SatelliteConsole.tsx:73-75` | `ELEVATION.lg` | `intel/IntelPanel.tsx:471` |
| 圓角 | `RADIUS.xl` | `sc/SatelliteConsole.tsx:76` | `RADIUS.xl` | `intel/IntelPanel.tsx:465` |
| z-index | 字面 `30`（＝popover 層值，規格應為 `floatingPanel` 20；§5.25 已登記為「尚未歸層」） | `sc/SatelliteConsole.tsx:77` | 同樣字面 `30` | `intel/IntelPanel.tsx:466` |
| 字型 | 容器 `fontFamily: FONT_CJK` ✅ | `sc/SatelliteConsole.tsx:84` | 容器**未設** fontFamily（各子節點自設） | `intel/IntelPanel.tsx:455-475` |
| 動畫 | `satConsoleFadeIn .25s`（自定 keyframes，同 intel） | `sc/SatelliteConsole.tsx:82,162-171` | `intelPanelFadeIn` | `intel/IntelPanel.tsx:472` |
| 捲動 | 中段 `className="mtp-scroll"`、`flex:1; overflowY:auto`，**無內距**（各區塊自帶 `14px` 左右距） | `sc/SatelliteConsole.tsx:93` | `mtp-scroll`、`padding: 12px 14px 14px` | `intel/IntelPanel.tsx:670` |
| 內層巢狀捲動 | CN 群組展開清單 `maxHeight:200`；覆蓋 timeline `maxHeight:220` | `sc/CNGroupSection.tsx:141`；`sc/CoverageStatsSection.tsx:355` | — | — |
| 標頭 | 自刻兩列：第 1 列 icon＋標題＋英文副字＋ALERT＋關閉；第 2 列 LIVE/HISTORY＋顯示時間 | `sc/SatelliteConsoleHeader.tsx:26-99,102-142` | `IntelHeader`（H2）＋狀態列 | `intel/IntelHeader.tsx:46-110,113-…` |
| 關閉 | `IntelIcon d={ICON.x} size={14}`、`aria-label="close"`（英文）、色 `textDim` | `sc/SatelliteConsoleHeader.tsx:81-98` | 同（`aria-label="close"`、`textDim`）；`PanelHeader` 才是規格做法（`關閉{標題}`、`mutedColor`） | `intel/IntelHeader.tsx:92-109`；`sidebar/PanelHeader.tsx:13` |
| 收合方式 | 整個面板只有開／關；各區塊：CN 群組 accordion（`Set<string>`）、覆蓋 timeline 按鈕切換；無面板層級收合 | `sc/CNGroupSection.tsx:39,89-95`；`sc/CoverageStatsSection.tsx:95,240-255` | Alerts 摘要可收合 | `intel/IntelPanel.tsx:487-495` |
| 底部列 | 手刻 footer：`FONT_DATA` 容器、9px、`UCS Database · Space-Track`＋原生 checkbox「顯示全部軌道」 | `sc/SatelliteConsole.tsx:119-142` | 無面板 footer | — |
| 開啟副作用 | 開啟時 flyTo 台灣、自動打開 `satellitesTaiwan` | `App.tsx:750-757` | — | — |
| 左側互斥 | `satellite` 在 `LEFT_PANEL_KEYS` ✅；App 觀察剛開啟者關閉其他；rail 按鈕另手動關 member/intel 並收 rail | `src/state/leftPanelMutex.ts:9`；`App.tsx:1533,1543,2346-2353` | 同機制 | `App.tsx:2335-2343` |
| 主題 | **無淡色**：App 不傳 `isDarkTheme`；`ListRow` 外包寫死 `DARK_PALETTE`；註解「衛星情報 Console 只有暗色」 | `App.tsx:2384-2390`；`sc/CNGroupSection.tsx:183-184` | `isDarkTheme`→`getIntelPalette`→`IntelThemeProvider` | `intel/IntelPanel.tsx:101,107,453` |
| 資料輪詢 | 面板內 `fetchRecentManeuvers(24)` 每 30s；App 另有 `useSatelliteManeuvers(satConsole.open)`（同時兩份） | `sc/SatelliteConsole.tsx:39-53`；`App.tsx:743` | — | — |

---

## 2. 各區塊

區塊順序（`sc/SatelliteConsole.tsx:87-116`）：Header → 變軌警報（範圍外）→ 覆蓋統計 → CN／國際群組 → 台灣衛星隊 → footer。

### 2.1 Header（`sc/SatelliteConsoleHeader.tsx`）

- **外框**：第 1 列 `padding "13px 14px 11px"`（規格 `10px 14px`）、底線 `COLORS.panelBorder`（:28-33）；第 2 列 `padding "7px 14px 8px"`、底線 `borderSoft`、歷史模式底 `rgba(255,152,0,0.06)`（:102-113）。
- **標題列形式**：自刻 SVG 衛星 icon（:36-42）→ 直排「衛星情報」(上)＋「SATELLITE」(下)（:43-50）。eyebrow 位置相反（英文在標題**下方**），且是英文大寫字串、`FONT_DATA`、letterSpacing 2.5px。
- **字級（非 7 階）**：`:44` 標題 `13.5`（應 `FONT_SIZE.lg` 13）。其餘用 `FONT_SIZE.xs/sm`。
- **字型（中文套等寬）**：`:110` 第 2 列整列容器 `FONT_DATA` → 其中 `:132`「顯示時間」、`:137`「（{offsetLabel}）」、`:140`「§A 警報固定看現實 24h」中文落等寬。標題 `:44` 用 `FONT_CJK` ✅。
- **手寫顏色**：`:20` `rgba(255,152,0,0.16)`（`COLORS.statusWarnSoft` 已存在）、`:21` `rgba(255,152,0,0.55)`、`:61` `rgba(239,68,68,0.16)`、`:62` `rgba(239,68,68,0.45)`、`:112` `rgba(255,152,0,0.06)`。
- **英文／內部代碼外露**：`:48`「SATELLITE」、`:76`「ALERT」、`:130`「HISTORY」/「LIVE」（即時情報同樣保留 LIVE pill）、`:140`「§A」（內部章節代號）、`:83` `aria-label="close"`。
- **徽章公式**：ALERT（:53-79）＝淡底＋框＋字三者都有，`padding 2px 8px`、`RADIUS.md`；LIVE/HISTORY（:115-131）同。不符 §5.21「tint 無框」／「outline 透明底」任一公式。
- **缺值／狀態**：`hot = totalManeuvers > 0`（:14）；變軌抓取失敗時 loader 回 `[]`（`src/data/satelliteManeuversLoader.ts:48-50`）→ 與「24h 無變軌」無法區分，標頭無錯誤／過期提示。歷史模式隱藏 ALERT（:52）。
- **新鮮度／過期**：面板任何位置都沒有資料新鮮度（TLE 抓取時間、epoch 年齡、變軌最後成功抓取時間）；第 2 列只有時間軸「顯示時間」。TLE 經 localStorage 快取（`src/data/satelliteLoader.ts:34-44`）。對照 `intel/IntelHeader.tsx:126-131`「更新 HH:MM」＋來源健康度。
- **共用 vs 手刻**：全手刻；未用 `PanelHeader`、未用 lucide `X`（用 `IntelIcon`）。

### 2.2 CN 群組＋國際偵察（`sc/CNGroupSection.tsx`）

- **外框**：外層 `borderBottom borderSoft`（:185）；每群 `borderTop borderSoft`（:104）。
- **區段標題**：`:186-194`「CHINA · 6 GROUPS」、`:198-205`「INTL RECON · 9 COUNTRIES」— `FONT_DATA`、9px、letterSpacing 2px、`textFaint`、英文大寫字面字串（非 `textTransform`，guard 抓不到）。規格對應應是 `SubGroupLabel`/`MacroGroupLabel`（中文）。
- **群組列**：✅ 共用 `ListRow`（:106-133）：icon `lucide Satellite` 14px（開＝群組色，關＝`textDim`）、`count`＋`countUnit="顆"`、`accent`、`expandable`、`toggle`（→`RailToggle`／列開關）。chevron 由 ListRow 提供（lucide `ChevronRight` 12px 旋轉）✅。符合 §5.5「衛星群組」用法描述。
  - meta 內等級徽章（:111-115）：`FONT_DATA` `FONT_SIZE.xs`、框 `borderMid`、`RADIUS.md`、顯示 `g.tier`＝**S/A/B/C 原始代碼**。
  - 變軌徽章（:116-123）：`⚡{manCount}`、手寫 `rgba(239,68,68,0.16)`／`rgba(239,68,68,0.45)`（:119）、脈衝動畫；說明只在 `title`。
- **群組名稱（label）**：來源 `sc/satelliteConsoleTokens.ts:46-66`。
  - 中國：「Yaogan 遙感」「Jilin-1 吉林」「Gaofen 高分」「TJS / TJSW GEO 情報」「Beidou 北斗」「Shiyan 實踐 / 其他」— **英文在前、中文在後**（規格中文主名＋外文小字）。
  - 國際：「🇺🇸 USA」「🇯🇵 Japan IGS」「🇷🇺 Russia」「🇰🇷 Korea KOMPSAT」「🇫🇷 France CSO/PLEIADES」「🇩🇪 Germany SAR-Lupe」「🇮🇹 Italy COSMO-SkyMed」「🇮🇱 Israel Ofeq」「🇮🇳 India CARTOSAT/RISAT」— **emoji 國旗＋純英文、無中文**（§5.5 禁止名稱放 emoji）。
  - `ariaLabel`／toggle `label` 直接用上述字串（:107,132）。
- **展開清單（手刻，非 ListRow）**：`:145-166` 每列 `FONT_CJK` `FONT_SIZE.base`；衛星名為原始英文 TLE 名（:156）。
  - **字級非 7 階**：`:159` 高度 `9.5`。
  - **手寫顏色**：`:152` hover `rgba(255,255,255,0.03)`（應 `CONTROL.bgHover` 類 token）。
  - **等寬包中文**：`:170-171` `FONT_DATA` 容器內「… 共 {N}，顯示前 80」（跨行，guard 漏判）。
  - 單位：`:160` `{alt} km` ✅ 有空白。
  - `⚡` emoji 標記變軌（:164）。
- **缺值／載入**：
  - 空清單文字 `:137-139`：`layerOn ? "無資料（loader 仍在抓 TLE）" : "尚未開啟此圖層"` — 「loader」「TLE」內部字；且清單來自 `loadSatellites()`（:41-45，與圖層開關無關），「尚未開啟此圖層」的判斷依據與資料來源不一致。
  - `loadSatellites` 失敗回 `[]`（`src/data/satelliteLoader.ts:110-112`）→ 無錯誤狀態；`count` 為 0 時 ListRow 不顯示數字（`LayerRow.tsx:80`）✅ 未把 0 冒充。
  - 高度：TLE 解析失敗 `alt=null` 不渲染 ✅（:52,158）。
  - `cn_group` 字串對應：`mapManeuverGroupToCategory`（:212-233）與 `CN_GROUP_TO_CATEGORY`（tokens :69-87）重複兩份；字串本身未顯示。
- **主題**：寫死 `RailThemeContext.Provider value={DARK_PALETTE}`（:183-184）。

### 2.3 台灣衛星隊（`sc/TWFleetSection.tsx`）

- **外框**：外層 `borderBottom borderSoft`（:183）；每顆一張手刻卡（:204-218）`padding 8px 11px`、`RADIUS.xl`（面板內卡片規格 `RADIUS.lg`）、`FONT_CJK`。
- **區段標題**：`:184-196`「TAIWAN · {n} SATS」— `FONT_DATA` 9px letterSpacing 2px 英文大寫；右側「覆蓋中：{n}」（中文落在 `FONT_DATA` 容器內，:194-195，跨行 guard 漏判）、色 `#4fc3f7` 手寫。
- **字級非 7 階**：`:220` `12.5`（中文名）、`:221` `9.5`、`:230` `9.5`、`:242` `9.5`、`:248` `9.5`、`:253` `10.5`、`:296` `10.5`、`:313` `10.5`。
- **字型**：卡容器 `FONT_CJK` ✅；`:221` 英文名、`:248` NORAD、`:256` km、`:259-267` 座標列 `FONT_DATA`。座標列內「正覆蓋台灣」「12h 內無通過」「下次過台 N 分」（:271-275）、「距上次變軌 Nd」（:280）中文落在 `FONT_DATA` 容器（:264）。
- **手寫顏色**：`:194,270` `#4fc3f7`；`:209` `rgba(79,195,247,0.10)` / `rgba(255,255,255,0.025)`；`:210` `rgba(79,195,247,0.45)`；`:216` `rgba(100,170,255,0.06)`；`:217` `rgba(255,255,255,0.025)`；`:228-229` `rgba(255,152,0,0.16)` / `rgba(255,152,0,0.45)`（`statusWarnSoft`/`statusWarnBorder` 已有 token）；`:240` `rgba(255,255,255,0.06)`；`:308-310` `rgba(100,170,255,0.55)` / `rgba(100,170,255,0.16)` / `#cfe4ff`。
- **英文／內部代碼外露**：`:193`「TAIWAN · N SATS」；`:222` 原始英文名（`r.name`，作為副字可接受，但未用 §6.1 小字附註規格）；`:249`「NORAD {r.norad}」（NORAD 編號，內部 id 直接顯示）；`:280`「{n}d」英文單位。
- **徽章**：`:224-235`「⚠ 超齡服役」（底＋框＋字、emoji ⚠）、`:236-247`「學研」（底＋框）— 皆非 §5.21 兩公式。
- **按鈕**：`:286-317` 手刻「飛到衛星」「百科」：`padding 4px 0`、`RADIUS.md`、10.5px；未用 C2 `CONTROL.bg`/`CONTROL.border`，「百科」為自訂藍底。
- **單位空白（§6.2）**：`:256` `{alt} km` ✅；`:275` `下次過台 ${n} 分` ✅；`:280` `{n}d` ❌（英文、無空白）；`:274` `12h` ❌。
- **缺值／載入**：
  - `rows.length === 0` 即顯示「台灣衛星 — 載入中…」（:174-180）；`loadSatellites` 失敗回 `[]` → **永遠停在「載入中…」**，無失敗態；未走 loadingRegistry 文字。
  - 傳播失敗（`subpoint` null）整顆略過（:145-146），使用者看不到少了誰。
  - `altKm` 初值 0（:118）；顯示時改用 `point.altKm`（:160），所以 0 不外露。
  - locale 缺：`use: "—"` ✅（:157）、`tier` fallback `"core"`（:158）、`launch` fallback `"0000-00"`（只排序用）。
  - `daysSinceManeuver`：只從近 24h 的 maneuvers 推（`App`/console 只抓 24h），故值實際上只會是 0 或 1；沒有變軌時 null → 不顯示 ✅（:277）。
  - `nextPassMin == null` →「12h 內無通過」✅（不當 0）。
- **共用 vs 手刻**：全手刻（卡、徽章、按鈕、區段標題）。

### 2.4 覆蓋統計（`sc/CoverageStatsSection.tsx`）

- **外框**：`padding 10px 14px 8px`、`borderBottom borderSoft`、`FONT_CJK`（:222）。**無區段標題**。
- **主數字列**：`:224-256`「覆蓋台灣中 N 顆」「未來 6h 通過 N 次」；數字 `FONT_DATA` `FONT_SIZE.xl` 700 ✅（數字獨立 span）。
- **展開鈕**：`:240-255` 手刻按鈕，文字 `"▾ 收合"`／`"▸ 看 timeline"`（:254）— 三角字元當 chevron（§5.16 禁止；guard `triangle-chevron` 只擋 ▶▼，**▸▾ 未被計數**）；「timeline」英文。
- **字級非 7 階**：`:304` `10.5`、`:315` `10.5`、`:328` `10.5`、`:333` `9.5`、`:383` `9.5`。
- **字型（中文套等寬）**：`:263` breakdown 容器 `FONT_DATA` 內含「遙測類」「顆」「6h 內」「遙測 … 次」（:268-276）；`:333-334` `FONT_DATA` span「{a} / {b} 次」；`:397-398` `FONT_DATA`「共 N 次 · 顯示前 80」；`:286` 覆蓋中衛星名清單 `FONT_DATA`（英文名，可接受）。皆跨行，guard 漏判。
- **手寫顏色**：`:227` `#4fc3f7`；`:266` `#4fc3f7`；`:269,276` `#22c55e`（＝`COLORS.statusLive` 值）；`:300` `rgba(0,0,0,0.25)`；`:312-314` `rgba(34,197,94,0.16)` / `rgba(34,197,94,0.55)` / `#22c55e`；`:327` `#cfe4ff`。
- **英文／代碼外露**：`:265-266`「CN」「/ TW」；`:254`「timeline」；`:350`「+{h}h」軸標；`:390` 英文衛星名＋`⚡`。
- **篩選控制**：`:302-335`「只看遙測偵察／全部」兩顆手刻按鈕當分段控制（§5.8 應用分段控制；選中色用綠／藍兩種不同配色）。
- **缺值／載入（null→0）**：
  - `coveringNow` 初值 `[]`（:93），TLE 未載入或載入失敗時主數字顯示 **0 顆**（:227-228）— 與真的 0 顆無法區分。
  - `computingScan` 初值 `false`（:96），`parsed` 為空時 scan effect 直接 return（:140）→ 載入前／失敗時「未來 6h 通過」顯示 **0 次**（:236）；只有 scan 進行中才顯示「…」。
  - 載入成功後數值才正確；展開區空狀態有「計算中…」「未來 6h 無…通過」文字 ✅（:357-359）。
  - `console.log` 每次 scan 印效能（:173）。
- **共用 vs 手刻**：全手刻。

### 2.5 Footer（`sc/SatelliteConsole.tsx:119-142`）

- `padding 8px 14px`、`borderTop borderSoft`、`FONT_DATA` 容器、`FONT_SIZE.xs`、`textFaint`。
- 來源「UCS Database · Space-Track」（:130）：英文機構名；無 Tier、無原始下載頁連結、無授權、無抓取時間（§5.3 F2 結構）。
- 原生 `<input type="checkbox">`＋「顯示全部軌道」（:133-139）：§5.10 禁止 checkbox；中文在 `FONT_DATA` 容器內（繼承等寬）。`accentColor: COLORS.accent`。

---

## 3. 現況 vs 規格差異總表

| # | 項目 | 現況 | 規格條文 | 範本（即時情報怎麼做） | 位置 |
|---|---|---|---|---|---|
| 1 | 淡色主題 | 無；App 不傳 `isDarkTheme`；ListRow 寫死 `DARK_PALETTE`；色全來自靜態暗色 `COLORS` | §1「暗／淡並行」、§5.1 淡色、§8 checklist 2 | `isDarkTheme`→`getIntelPalette`→`IntelThemeProvider`，子元件 `useIntelTheme()` | `App.tsx:2384-2390`；`sc/CNGroupSection.tsx:183-184`；範本 `intel/IntelPanel.tsx:101-107,453`、`intel/intelTheme.tsx:55-125` |
| 2 | 標頭 H2 | 手刻；padding 13/14/11；標題 13.5px；英文「SATELLITE」放標題**下方**、`FONT_DATA`、letterSpacing 2.5 | §5.1 H2（eyebrow 9px 中文在上、標題 13px、`10px 14px`；禁英文大寫 eyebrow、標頭等寬字、手刻標頭） | eyebrow「情報」在上、`FONT_CJK` 9px、標題 `FONT_SIZE.lg`；padding `10px 14px`（仍手刻） | `sc/SatelliteConsoleHeader.tsx:26-50`；範本 `intel/IntelHeader.tsx:46-62` |
| 3 | 關閉鈕 | `IntelIcon x`、`aria-label="close"`、`textDim` | §5.1 `<X size={14}/>`、`--text-muted`、`aria-label="關閉{標題}"` | 同樣偏離（`close`、`textDim`）；`PanelHeader` 才合規 | `sc/SatelliteConsoleHeader.tsx:81-98`；`intel/IntelHeader.tsx:92-109`；`sidebar/PanelHeader.tsx:13` |
| 4 | 狀態徽章 | ALERT／LIVE／HISTORY 英文；淡底＋框＋字三合一、`padding 2px 8px`、`RADIUS.md` | §5.21 徽章兩公式（tint 無框／outline 透明底；10px、圓角 3）；§6.1 中文；§6.4 狀態用字 | LIVE pill：只有框（outline）、`RADIUS.pill`、`FONT_SIZE.xs` | `sc/SatelliteConsoleHeader.tsx:53-79,115-131`；範本 `intel/IntelHeader.tsx:63-88` |
| 5 | 區段標題 | 「CHINA · 6 GROUPS」「INTL RECON · 9 COUNTRIES」「TAIWAN · N SATS」— 英文大寫字面、`FONT_DATA`、letterSpacing 2；覆蓋統計無標題 | §5.5 L2 群組標題（中文 10px semibold、右側細線，`SubGroupLabel`）；§6.1；§7 英文大寫 eyebrow | 即時情報用中文分頁 `FeedTabs` | `sc/CNGroupSection.tsx:186-194,198-205`；`sc/TWFleetSection.tsx:184-193` |
| 6 | 群組名稱 | 英文在前（「Yaogan 遙感」）；國際 9 群 emoji 國旗＋純英文無中文 | §5.5 名稱＝中文主名＋外文小字；禁 emoji；§6.1 | — | `sc/satelliteConsoleTokens.ts:47-65` |
| 7 | 等級代碼 | tier `S/A/B/C` 原樣顯示為徽章（`FONT_DATA`） | §6.3 不印內部識別碼（需人類可讀映射）；§5.5 衛星群組「等級徽章在名稱後」（未規定文字） | — | `sc/CNGroupSection.tsx:111-115`；`sc/satelliteConsoleTokens.ts:47-65` |
| 8 | 內部字外露 | 「§A 警報固定看現實 24h」；「無資料（loader 仍在抓 TLE）」；「NORAD {id}」 | §6.3；§6.1 | — | `sc/SatelliteConsoleHeader.tsx:140`；`sc/CNGroupSection.tsx:138`；`sc/TWFleetSection.tsx:248-250` |
| 9 | 中文套等寬 | 至少 7 處 `FONT_DATA` 容器含中文（全為跨行／容器繼承，guard 0 筆） | §4.1 規則 1-2；§7 第 1 列 | 整列 `FONT_CJK`、數字另包 `FONT_DATA`＋`tabular-nums` | `sc/SatelliteConsoleHeader.tsx:110(→132,137,140)`；`sc/SatelliteConsole.tsx:123(→139)`；`sc/CNGroupSection.tsx:170-171`；`sc/TWFleetSection.tsx:186(→195)、264(→271-280)`；`sc/CoverageStatsSection.tsx:263(→268-276)、333-334、397-398`；範本 `intel/IntelHeader.tsx:122-131` |
| 10 | 數字 tabular-nums | 範圍內 5 個 tsx 檔 `fontVariantNumeric` 計數皆 0（`/usr/bin/grep -c` 複驗；ListRow 計數格除外） | §4.1 `FONT_DATA` 配 `tabular-nums`；§6.2 | `fontVariantNumeric: "tabular-nums"` | 例 `sc/CoverageStatsSection.tsx:227,235`；範本 `intel/IntelHeader.tsx:127,131` |
| 11 | 非 7 階字級 | 9.5／10.5／12.5／13.5 共 15 處（grep 複驗） | §3.13（半級 round 到 7 階）；§7 自訂 font size | intel 也還有 10.5（`IntelPanel.tsx:579,642`）、10（:758） | Header:44；CN:159；TW:220,221,230,242,248,253,296,313；Coverage:304,315,328,333,383 |
| 12 | 手寫 hex／rgba | 約 30 處（列於 §2 各節）；含已有 token 等值者（`statusWarnSoft/Border`、`statusLive`、`ELEVATION.lg`） | §1 Token 優先；§7；§8 checklist 1；（guard `hex-literal-in-ui-css` 只掃 CSS，TSX 不計） | 經 `palette.*`、`chipTint/chipOutline`、`neutralFill` | `sc/SatelliteConsole.tsx:72-75`；Header:20-21,61-62,112；CN:119,152；TW:194,209-210,216-217,228-229,240,270,308-310；Coverage:227,266,269,276,300,312-314,327；tokens:24,32,39-40 |
| 13 | 資料語意色 | `#4fc3f7`（台灣覆蓋）、`#facc15`（SHAPE_CHANGE）未登記為資料色常數 | §3.16 資料色放圖層／資料檔常數並註明 | 分級色集中在 `intelTokens.ts` 並列於 §3.16 | `sc/TWFleetSection.tsx:194,209,270`；`sc/CoverageStatsSection.tsx:227,266`；`sc/satelliteConsoleTokens.ts:39` |
| 14 | Chevron | 覆蓋統計 `▸`／`▾` 字元 | §5.16 lucide `ChevronRight` 12px 旋轉；§7（guard 只擋 ▶▼，此處未計） | — | `sc/CoverageStatsSection.tsx:254` |
| 15 | 開關 | footer 原生 checkbox「顯示全部軌道」 | §5.10 禁 checkbox；屬「細項開關」階（20×11 accent） | — | `sc/SatelliteConsole.tsx:133-139` |
| 16 | 分段控制 | 「只看遙測偵察／全部」兩顆手刻按鈕，選中色一綠一藍 | §5.8 分段控制；§5.7 C2 | 時間範圍等用分段（外框 `controlBorder`＋`controlBg`，選中 `accentFaint`） | `sc/CoverageStatsSection.tsx:302-332`；範本 `intel/IntelPanel.tsx:541-565` |
| 17 | 按鈕 | 「飛到衛星」「百科」「▸ 看 timeline」手刻，未用 `CONTROL.*` | §5.7 C2；§3.6 | `neutralFill`／`palette.controlBg` | `sc/TWFleetSection.tsx:286-317`；`sc/CoverageStatsSection.tsx:240-255` |
| 18 | 徽章（卡內） | 「⚠ 超齡服役」「學研」「⚡N」皆底＋框 | §5.21 兩公式 | `chipTint`／`chipOutline` | `sc/TWFleetSection.tsx:224-247`；`sc/CNGroupSection.tsx:116-123` |
| 19 | 卡片圓角 | TW 卡 `RADIUS.xl` | §3.10 面板內卡片 `RADIUS.lg` | intel 卡 `RADIUS.lg` | `sc/TWFleetSection.tsx:208`；範本 `intel/IntelPanel.tsx:687` |
| 20 | 單位 | `{n}d`、`12h`、`+{h}h`、`6h`、`24h` 英文單位且無空白 | §6.2 中文單位前空白；§6.1 | `relTime()` 中文「分鐘前／小時前」 | `sc/TWFleetSection.tsx:274,280`；`sc/CoverageStatsSection.tsx:234,275,350`；Header:140 |
| 21 | null 當 0 | TLE 未載入／失敗時「覆蓋台灣中 0 顆」「未來 6h 通過 0 次」；變軌抓取失敗＝無警報 | §6.5；§1 null 不當 0；§6.4 載入中／缺值用字 | Alerts 摘要帶 `status`／`lastSuccessAt`；`IntelHeader` 有來源健康度 | `sc/CoverageStatsSection.tsx:93,96,140,227-236`；`src/data/satelliteManeuversLoader.ts:48-50`；`sc/SatelliteConsole.tsx:43-45`；範本 `intel/IntelPanel.tsx:487-495`、`intel/IntelHeader.tsx:133-…` |
| 22 | 載入失敗態 | 台灣隊 `rows.length===0` 永遠「載入中…」 | §6.4、§6.5（錯誤要有自己的文字） | 同上 | `sc/TWFleetSection.tsx:174-180`；`src/data/satelliteLoader.ts:110-112` |
| 22b | 資料新鮮度 | 無任何新鮮度顯示：Header 第 2 列只顯示時間軸時間；不顯示 TLE 抓取時間／epoch 年齡、變軌最後成功抓取時間；TLE 走 localStorage 快取（`readCache()`，TTL 內直接用），快取多舊使用者看不到 | §6.4、§6.5（過期要有自己的文字）；§5.3 第二行「抓取於 …」 | 「更新 HH:MM」＋`sourceHealth` 來源健康度展開 | `sc/SatelliteConsoleHeader.tsx:102-142`；`src/data/satelliteLoader.ts:34-44,102-104`；範本 `intel/IntelHeader.tsx:126-131,133-…` |
| 23 | 來源 footer | 手刻一行英文機構名；無 Tier／連結／授權／抓取時間；`FONT_DATA` 整行 | §5.3 F2 結構（第一行 `機關 · Tier · 原始下載頁 ↗`、第二行等寬）；§6.1 | 即時情報無面板 footer（用來源健康度展開） | `sc/SatelliteConsole.tsx:119-131` |
| 24 | z-index | 字面 30（popover 層） | §5.25 左側面板屬 `Z_INDEX.floatingPanel`(20)；已列入「尚未歸層」 | 同為字面 30 | `sc/SatelliteConsole.tsx:77`；`intel/IntelPanel.tsx:466` |
| 25 | 陰影 | 字面值（＝`ELEVATION.lg`）＋歷史模式橘色光暈 | §5.1 `ELEVATION.lg`；§3.12 | `ELEVATION.lg` | `sc/SatelliteConsole.tsx:73-75` |
| 26 | 左側互斥 | ✅ 已在 `LEFT_PANEL_KEYS`，App 有接 | §5.26 | 同 | `src/state/leftPanelMutex.ts:9`；`App.tsx:1533,1543` |
| 27 | 列元件 | ✅ CN／國際群組列用 `ListRow`＋`RailToggle`＋ListRow chevron；展開後的衛星清單手刻 | §5.5「同一個列元件」；禁另做一種列 | — | `sc/CNGroupSection.tsx:106-133,145-166` |
| 28 | 外殼位置／底／圓角／字型 | ✅ `left:64`、`LAYOUT.leftDockTop`、`SURFACE.strong`、`RADIUS.xl`、容器 `FONT_CJK` | §5.1 | 同（intel 容器未設 fontFamily） | `sc/SatelliteConsole.tsx:64-84` |

---

**spec 側事實**：`spec.md` §10.2 區塊狀態表沒有「衛星情報」一列（只有「即時情報 ✅」）；衛星只出現在 §3.1 SURFACE、§5.1 位置、§5.5 ListRow 用法、§5.10 列開關、§5.25／§10.3 未歸層 z-index、§5.26 互斥清單。

## 4. Guard 計數（`src/styles/__tests__/designSystemGuard.test.ts`）

執行：`npx vitest run src/styles/__tests__/designSystemGuard.test.ts` → 15/15 綠。另以 `scanFiles()`（`designSystemGuardRules.ts:209`）掃當下程式碼，結果與 baseline（`designSystemGuard.baseline.json`）一致。

規則清單：`web-font`、`hex-literal-in-ui-css`、`native-range`、`triangle-chevron`、`english-control-label`、`uppercase-eyebrow`、`font-data-on-cjk`、`raw-z-index`（擋）、`internal-id-display`（只記錄）。

| 檔案 | 規則 | baseline | 目前 |
|---|---|---|---|
| `sc/SatelliteConsole.tsx` | `raw-z-index` | 1 | 1（:77 `zIndex: 30`） |
| `sc/SatelliteConsoleHeader.tsx` | — | 0 | 0 |
| `sc/satelliteConsoleTokens.ts` | — | 0 | 0 |
| `sc/CNGroupSection.tsx` | — | 0 | 0 |
| `sc/TWFleetSection.tsx` | — | 0 | 0 |
| `sc/CoverageStatsSection.tsx` | — | 0 | 0 |
| （範圍外）`sc/ManeuverCompareModal.tsx` | `font-data-on-cjk`／`raw-z-index` | 1／1 | 1／1 |
| （範圍外）`sc/SatelliteDetailCard.tsx` | `raw-z-index` | 1 | 1 |
| （範本）`intel/IntelPanel.tsx` | `raw-z-index` | 1 | 1 |
| （範本）`intel/IntelHeader.tsx` | — | 0 | 0 |

**guard 抓不到但實際違規**（因此上表 0 不代表合規）：
- 等寬包中文：全部是「容器 `FONT_DATA`、中文在子節點／下一行」，`font-data-on-cjk` 只看同一行直接子文字。
- 英文大寫：用字面大寫字串（`"CHINA · 6 GROUPS"` 等），非 `textTransform`，`uppercase-eyebrow` 不命中。
- `▸`／`▾`：`triangle-chevron` 只擋 `▶`／`▼`。
- TSX 內 hex／rgba：`hex-literal-in-ui-css` 只掃 CSS。
- 非 7 階字級、emoji、tier 代碼、`NORAD`：無對應規則。
