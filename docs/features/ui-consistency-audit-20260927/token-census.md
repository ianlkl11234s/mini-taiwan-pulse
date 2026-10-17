# Token 散值統計（資料表，無敘事）

> 純數據附錄，供 `handoff.md §2` 與 `proposal.md §7` 引用。方法論與結論見那兩檔；本檔只列 `grep` 實測結果。
> 統計範圍：全 `src/`，已排除 `__tests__` 與 `*.test.*`；hex 顏色統計含 `LAYER_COLORS`（圖層代表色，刻意排除在 token scale 外，僅供量級參考）。

## A. font-family 字面值分布

`grep -rn "font-family|fontFamily"` 全站命中 628 處（含 token 呼叫與硬寫字面），去重後的字面 stack：

| Stack 字面 | 次數 | 出處 |
|---|---|---|
| `FONT_DATA` = `"JetBrains Mono","SF Mono",ui-monospace,Menlo,monospace` | 408 | 主線 token（`designTokens.ts`／`intelTokens.ts`） |
| `FONT_CJK` = `"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif` | 259 | 主線 token |
| `"Inter, system-ui, sans-serif"` | 10 | `mainMapConnection.css` `.main-map-agent`／`.main-map-agent--embedded` |
| `ui-monospace,"SFMono-Regular",Consolas,monospace` | 9 | `mainMapConnection.css` `.research-result-popup__eyebrow`／`__facts dt`／close button |
| `"Noto Sans TC"`（單獨，非 FONT_CJK stack） | 6 | `research.css` `:root` |
| 裸 `monospace` | 8+ | `DataSourceModal.tsx`、`AdminPanel.tsx`×2、`memberPanel.css`×3 |
| `"Songti TC", "Noto Serif TC", serif` | 2 | `research.css` `.research-heading h1` |
| `Georgia, serif` | 2 | `research.css` `.research-brand`／`.research-empty > span` |
| `var(--font-cjk, sans-serif)` | 1 | `memberPanel.css`（**`--font-cjk` 全站無定義**，恆 fallback 至瀏覽器預設無襯線字） |

主 App 內只有 2 種角色；`research/` 子系統另加 4 組不同字面；`member/` 是第 5 組（空變數引用）。全站未載入任何 web font（`grep -rn "font-face|googleapis|\.woff"` index.html/public 零命中，`public/` 無字型檔），故以上 stack 最終都靠系統字解析。

## B. FONT_SIZE 字級分布（token 化區塊，`design-system.md §2.5` 既有 audit，原文引用）

| Token | px | 次數 | 用途 |
|---|---|---|---|
| `xs` | 9 | 174 | 標籤/pill |
| `sm` | 10 | 157 | 副資訊 |
| `base` | 11 | 106 | 預設正文 |
| `md` | 12 | 66 | 強調副資訊 |
| `lg` | 13 | 82 | 強調正文 |
| `xl` | 18 | 11 | 卡片標題 |
| `xxl` | 22 | 8 | panel header |

14px（13 處）、16px（5 處）、32/40px（各 1 處）為 outlier，未進 scale。

## C. Hex 顏色 Top 20（含 LAYER_COLORS，量級參考用）

`#ef4444`145 `#ffffff`106 `#f97316`106 `#94a3b8`99 `#22c55e`90 `#fbbf24`67 `#9ca3af`66 `#f59e0b`62 `#dc2626`60 `#3b82f6`56 `#fb923c`53 `#26c6da`53 `#22d3ee`53 `#38bdf8`51 `#9e9e9e`48 `#2563eb`47 `#a855f7`46 `#64748b`46 `#facc15`43 `#a78bfa`43

3 碼 `#fff` 單獨出現 159 次（多為快速 inline 寫法）。

## D. rgba() 面板 chrome 值 Top 20（背景／邊框語意，排除 data-color 用途）

`rgba(0,0,0,0.5)`38 `rgba(0,0,0,0.55)`31 `rgba(255,255,255,0.4)`26 `rgba(255,255,255,0.75)`24 `rgba(255,255,255,0.7)`24 `rgba(255,255,255,0.05)`23 `rgba(255,255,255,0.04)`23 `rgba(0,0,0,0)`19 `rgba(255,255,255,0.6)`18 `rgba(255,255,255,0.12)`18 `rgba(255,255,255,0.5)`17 `rgba(255,255,255,0.08)`17 `rgba(255,255,255,0.06)`16 `rgba(0,0,0,0.3)`14 `rgba(150,200,255,0.6)`13 `rgba(0,0,0,0.4)`13 `rgba(0,0,0,0.35)`13 `rgba(0,0,0,0.08)`13 `rgba(255,255,255,0.15)`12 `rgba(255,255,255,0.2)`11

與 `WHITE_ALPHA{4,8,12,20,40,60}` / `SURFACE.panel(0.52)` / `SURFACE.strong(0.88)` 高度重疊但非同一組字面——`research`／`member` 子系統各自寫了自己的白/黑半透階梯。

## E. border-radius 原始 inline 值（未進 token 的散值）

`2`16 `4`14 `3`14 `8`10 `1`9 `6`8 `6px`8 `3px`8 `8px`7 `2px`7 `12px`4 `10px`4 `5`3 `10`3 `7px`3 `12`2 `5px`2 `24`1

## F. box-shadow 樣本（未進 ELEVATION）

`0 20px 60px #0005`（member）／`0 16px 44px rgba(0,0,0,.48)`（Agent 分析結果 popup）／`0 8px 30px rgba(0,0,0,.16)`（`.main-map-agent--light`）／`inset 0 0 28px rgba(244,249,255,.13), inset 0 0 72px rgba(137,190,255,.10), inset 0 0 124px rgba(98,163,255,.06)`（`researchActivity.css` aurora 背景光暈）

## G. 4 套獨立手刻 light theme 對照

| 位置 | 觸發 | 背景 | 邊框 |
|---|---|---|---|
| `FeatureInfoPanel.tsx` + `featureTheme.tsx` `LIGHT_FEATURE` | `isDarkTheme=false` | `rgba(255,255,255,0.95)` | `rgba(0,0,0,0.10)` |
| `mainMapConnection.css` `.main-map-agent--light` | Agent 協作面板淺色 | `rgba(255,255,255,.92)`／`.96` | `rgba(0,0,0,.16)` |
| `memberPanel.css` `.member-panel-light` | 會員專區淺色 | `#fff` | `#d6dfe6` |
| `researchActivity.css` `.research-activity-position--light` | 活動卡淺色 | `rgba(255,255,255,.95)` | `rgba(23,33,43,.16)` |

## H. Title 元件本地重複（13 檔）

`culturePanels.tsx`／`religionPanels.tsx`／`educationPanels.tsx`／`funeralPanels.tsx`／`fisheryPanels.tsx`／`jpMedicalPanels.tsx`／`livestockPanels.tsx`／`networkStructuresPanels.tsx`／`japanPanels.tsx`／`sportsPanels.tsx`／`urbanPanels.tsx`／`tourismPanels.tsx`／`welfarePanels.tsx` — 各自複製同一段 `function Title({color, children})`（`shared.tsx` 未 export 共用版）。

## I. SourceFooter 覆蓋率

`grep -L "SourceFooter" src/components/featureInfo/*Panels.tsx`：41 個檔案中 **32 個完全無此字串**（檔案層級粗量，非逐 export 精算）。`religionPanels.tsx` 單檔內 7 個 panel（`TemplePanel`／`ChurchPanel`／`AncestralHallPanel`／`FoundationPanel`／`OtherWorshipPanel`／`ReligionTop100Panel`／`JpReligionPanel`×3 變體）中，僅 `ChurchPanel`／`AncestralHallPanel`／`FoundationPanel`／`OtherWorshipPanel` 4 個有掛；`TemplePanel`（寺廟本體）與 `ReligionTop100Panel`／`JpReligionPanel` 系列沒有。

## J. designTokens.ts 採用率

`grep -rl 'styles/designTokens"' src`（排除測試檔）：**108 個檔案**。未採用：`src/research/*`（4 支獨立 CSS：`research.css`／`mainMapConnection.css`／`researchActivity.css` + 對應 `.tsx`）、`src/components/member/memberPanel.css`、`src/components/DataSourceModal.tsx`（2 處手寫 `#9CA3AF` + `monospace`）。
