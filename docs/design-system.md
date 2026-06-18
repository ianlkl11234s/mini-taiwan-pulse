# Mini Taiwan Pulse — Design System

> 視覺一致性規範與 token SSOT。新元件 / 重構元件**必讀**。

## 0. 設計原則

| | |
|---|---|
| **不引入 CSS 框架** | 維持 inline `style={{}}` + token import。Mapbox / Three.js / 動態 opacity 大量混在元件中，框架反而是負擔。 |
| **token 為唯一 SSOT** | 顏色 / 字體 / 圓角 / 陰影一律從 `src/styles/designTokens.ts` import；禁止 inline 寫 hex / rgba。 |
| **`LAYER_COLORS` 不動** | 圖層代表色由 `src/components/sidebar/layerCatalog.ts` SSOT，已被 `layerConsistency` 測試保護。 |
| **業務元件不抽通用庫** | 不建 `Button` / `Card` 通用元件庫；業務元件深耦合 Mapbox / timeStore，抽出反而 over-abstract。 |
| **每階段獨立 PR** | 大改不一次推；每 Phase 一個 PR，可獨立 review / merge / rollback。 |

## 1. SSOT 結構

| 檔案 | 角色 |
|---|---|
| `src/styles/designTokens.ts` | **全專案 token SSOT** — 新元件統一 import |
| `src/components/intel/intelTokens.ts` | intel/satellite 歷史 token，被 designTokens **單向 re-export**（⚠️ 禁止反向 import，會造成 circular dep） |
| `src/components/sidebar/layerCatalog.ts` | `LAYER_COLORS` / `SECTIONS` — 圖層代表色 + 分區 SSOT |
| `src/components/LegendPanel.tsx` `LEGEND_REGISTRY` | layer → 圖例對接 SSOT |
| `src/components/featureInfo/registry.tsx` `PANEL_REGISTRY` | layer → click popup 對接 SSOT |

**遷移方向**：未來 intel/satellite 也改 import `designTokens`，`intelTokens.ts` 退役為**純常數定義檔（被動）**或直接刪除（把定義搬進 designTokens）。
⚠️ **不可**把 `intelTokens.ts` 改成「re-export from designTokens」— designTokens 已 import intelTokens，反向 re-export 會立刻形成 circular dependency。正確順序：(a) 把常數從 intelTokens 搬到 designTokens；(b) intelTokens 改成 re-export from designTokens（單向，無 cycle）；(c) 待所有 import 都改完才刪 intelTokens.ts。

## 2. Token 全表

### 2.1 SURFACE — 面板背景五階

| Token | 值 | 用途 |
|---|---|---|
| `SURFACE.app` | `#0a0a14` | App 底（地圖底色 / LoadingScreen） |
| `SURFACE.subtle` | `rgba(0,0,0,0.40)` | narrow sidebar / 浮動 overlay |
| `SURFACE.panel` | `rgba(0,0,0,0.52)` | **主面板預設**（IntelPanel / SatelliteConsole / Legend） |
| `SURFACE.strong` | `rgba(10,10,20,0.88)` | 需高可讀性（FeatureInfo / DataCalendar） |
| `SURFACE.solid` | `rgba(10,10,20,0.94)` | 全屏 / 模態 / LiveWall |

### 2.2 COLORS — 文字 / 強調 / 狀態（沿用 intelTokens）

| Token | 用途 |
|---|---|
| `COLORS.textStrong` `#f3f4f6` | 主標題 / 重點數據 |
| `COLORS.textDefault` `#d8dce3` | 預設正文 |
| `COLORS.textMuted` `#9ca3af` | 次要資訊 / 副標 |
| `COLORS.textDim` `#6b7280` | label / placeholder |
| `COLORS.textFaint` `#4b5560` | 提示性說明 |
| `COLORS.textGhost` `#363b44` | 接近不可見的裝飾 |
| `COLORS.accent` `#64aaff` | 互動 / 連結 / focus |
| `COLORS.statusLive` `#22c55e` | live / online / OK |
| `COLORS.statusWarn` `#ff9800` | warn / 警戒 |
| `COLORS.statusErr` `#ef4444` | err / fail / critical |

完整列表見 `designTokens.ts` 與 `intelTokens.ts`。

### 2.3 BORDER

| Token | 值 |
|---|---|
| `BORDER.soft` | `rgba(255,255,255,0.06)` |
| `BORDER.panel` | `rgba(255,255,255,0.10)` — 主面板邊框預設 |
| `BORDER.mid` | `rgba(255,255,255,0.14)` |
| `BORDER.strong` | `rgba(255,255,255,0.22)` |
| `BORDER.accent` | `rgba(100,170,255,0.55)` |

### 2.4 RADIUS — 圓角 4 階尺寸 + 2 種 shape

| Token | 值 | 用途 |
|---|---|---|
| `RADIUS.sm` | `2` | inline pill / tag |
| `RADIUS.md` | `4` | **預設** badge / 小卡 |
| `RADIUS.lg` | `6` | panel inner card |
| `RADIUS.xl` | `8` | panel 外框 |
| `RADIUS.pill` | `9999` | 完整 pill |
| `RADIUS.full` | `"50%"` | 圓點 / 圓鈕（字串，非 number） |

收斂規則：`3 → md(4)`，`5/7 → lg(6)`，`9/10 → xl(8)`。
**罕用 12 / 16 / 24px（共 3 處）保留 inline 一次性數值**，不進 scale。

### 2.5 FONT_SIZE — 字級七階

| Token | 值 | audit 使用次數 | 用途 |
|---|---|---|---|
| `FONT_SIZE.xs` | `9` | 174 | 標籤 / pill / uppercase 標題 |
| `FONT_SIZE.sm` | `10` | 157 | 副資訊 |
| `FONT_SIZE.base` | `11` | 106 | **預設正文** |
| `FONT_SIZE.md` | `12` | 66 | 強調副資訊 |
| `FONT_SIZE.lg` | `13` | 82 | 強調正文 |
| `FONT_SIZE.xl` | `18` | 11 | 卡片標題 |
| `FONT_SIZE.xxl` | `22` | 8 | panel header |

14px (13 use) → 就近 round 至 `md(12)` 或 `lg(13)`。
16px (5 use) → `xl(18)` 或 inline。
32 / 40px 各 1 use → **保留 inline** 一次性數值，不進 scale。

### 2.6 FONT_WEIGHT

`regular: 400` / `semibold: 600` / `bold: 700`。實務只用 600 / 700。

### 2.7 ELEVATION — 主面板陰影

| Token | 值 |
|---|---|
| `ELEVATION.sm` | `0 6px 20px rgba(0,0,0,0.50)` |
| `ELEVATION.md` | `0 8px 32px rgba(0,0,0,0.55)` |
| `ELEVATION.lg` | `0 12px 40px rgba(0,0,0,0.45)` |
| `ELEVATION.dock` | `0 -16px 50px rgba(0,0,0,0.50)`（反向，MonitorPanel 從上緣散） |

### 2.8 SPACING

`xxs:2 / xs:4 / sm:6 / md:8 / lg:12 / xl:16 / xxl:24`。對應 gap / padding 大宗值。

### 2.9 WHITE_ALPHA

裝飾用半透白（軟分隔線、glow 底等）：`4 / 8 / 12 / 20 / 40 / 60`。文字色請用 `COLORS.text*`。

### 2.10 FONT_FAMILY

| Token | 值 |
|---|---|
| `FONT_CJK` | `"Noto Sans TC", "PingFang TC", ...` |
| `FONT_DATA` | `"JetBrains Mono", "SF Mono", ui-monospace, ...`（**取代散落的 `"monospace"`**） |

## 3. 災害 / 警示語意色

**規則**：以 `LAYER_COLORS`（地圖色）為基準，`ALERT_GROUPS_DEF`（警示卡）對齊。

理由：用戶第一眼接觸是地圖。同一語意在地圖、warning bar、popup 應該是同色。

| 語意 | 基準（LAYER_COLORS） | 目前 ALERT_GROUPS_DEF | Phase 5 對齊後 |
|---|---|---|---|
| earthquake | `#ff3b30` | `#d946ef` | → `#ff3b30` |
| flood / water | `#ef4444`（floodSensor） | `#2dd4bf` | → `#ef4444` |
| fire | `#ff5722`（fireEvents） | safety `#fb7185` | safety 拆出 fire 用 `#ff5722` |
| weather | （無 layer 對應） | `#38bdf8` | 沿用 |
| transit | （無 layer 對應） | `#fb923c` | 沿用 |
| lifeline | （無 layer 對應） | `#a3e635` | 沿用 |

## 4. 使用守則

### 4.1 何時 import 哪個

```tsx
// ✅ 新元件 / 重構元件 — 從 designTokens
import { SURFACE, COLORS, RADIUS, FONT_SIZE, ELEVATION, FONT_DATA } from "../styles/designTokens";

// ⚠️ intel / satellite 既有元件 — 沿用 intelTokens 路徑（不強制改，re-export 一致）
import { COLORS, FONT_DATA } from "../intel/intelTokens";

// ❌ 不要直接寫 hex / rgba 在 inline style
style={{ background: "rgba(0,0,0,0.52)" }}  // 改用 SURFACE.panel
style={{ fontFamily: "monospace" }}          // 改用 FONT_DATA
```

### 4.2 LAYER_COLORS 例外

地圖 layer 代表色**永遠**從 `LAYER_COLORS[layerKey]` 讀，不收進 designTokens：

- 已有 `layerConsistency` 測試保護
- Mapbox paint property 吃字串，layer key 對應 cleanly
- 95+ 動態色超出 token scale 設計目的

### 4.3 LayerSidebar 雙 theme

行動版 `LayerSidebar` 的 `isDarkTheme` 分支保留 — Phase 3 只套暗側 token，亮側暫不抽（流量低 + 未驗證）。未來題目。

## 5. 圖層 UX 鐵則（CLAUDE.md §5a 延伸）

任何新 layer 必過：

1. 透明度 slider（`useTransportParams`）
2. 分類 ≥ 2 → 寫圖例（`LEGEND_REGISTRY`，`layerConsistency` 測試擋）
3. 可選取 → 接 click popup（`PANEL_REGISTRY`）
4. options ≥ 4 → 原生 `<select>` dropdown

**設計系統延伸**（Phase 0+）：

5. **不引入新顏色** — 一律 `SURFACE` / `COLORS` / `LAYER_COLORS`
6. **不引入新 radius / fontSize** — 一律 scale token
7. **不重複寫 panel 外框** — 標準組合：`SURFACE.panel` + `border: 1px solid BORDER.panel` + `RADIUS.xl` + `ELEVATION.lg`

## 6. 遷移狀態

| Phase | 範圍 | 狀態 |
|---|---|---|
| 0 | 建 `designTokens.ts` + 本文件 | ✅ 完成 |
| 1 | 統一面板背景 + 陰影（→ SURFACE / ELEVATION） | pending |
| 2 | fontFamily 統一（`"monospace"` → `FONT_DATA`） | pending |
| 3 | 文字色階梯統一（散落 rgba 白 → `COLORS.text*`） | pending |
| 4 | borderRadius / fontSize 收斂 | pending |
| 5 | 災害語意色對齊（以 `LAYER_COLORS` 為基準） | pending |
| 6 | CloseButton / Loading 統一 | pending |

## 7. KEEP OUT — 不做的事

- ❌ 不引入 Tailwind / CSS Modules / styled-components
- ❌ 不抽 `Button` / `Card` 通用元件庫
- ❌ 不改 `LAYER_COLORS` 結構（已被測試保護）
- ❌ 不一次大爆炸改全部元件 — 每 Phase 獨立 PR
- ❌ 不在新元件 inline 寫死 hex / rgba / px font size
- ❌ 不反向把 `intelTokens` 改成 re-export from `designTokens`（會 circular dep，見 §1）
- ❌ **`SURFACE.*` 只給 panel 容器底**；button / select / segmented control 等**互動態背景不用 SURFACE**（即使數值相同 `rgba(0,0,0,0.4)`）。語意不同 — 互動態背景之後若要 token 化，會獨立開 `CONTROL.*` 群組。Phase 1 review 教訓。

## 8. 未納入 token 的範圍（未來題目，不在 Phase 0–6 scope）

下列項目雖有需求但暫不在現階段 token 化，待真實痛點出現再開：

- **Z_INDEX scale** — Mapbox controls / panel / modal / loading 目前散布 inline，未集中。
- **transition / duration / easing tokens** — 互動動畫多為一次性，未統一節奏。
- **互動狀態色**（hover / focus-ring / disabled / pressed）— 現多用 opacity 切換，未抽 state vocabulary。
- **Breakpoint tokens** — 桌機 / 手機分流目前用 JS `isMobile` 判斷，無 CSS breakpoint scale。
- **Control sizing**（button height / icon size / hit-area）— Phase 6 統一 CloseButton 時順手定，但不擴展為通用 scale。

## 9. 相關文件

- `CLAUDE.md` §5 / §5a — 新增 layer 強制順序 + UX 四鐵則
- `docs/development-rules.md` §4a — 四鐵則完整版
- `docs/known-issues.md` — 歷史 bug + 診斷
