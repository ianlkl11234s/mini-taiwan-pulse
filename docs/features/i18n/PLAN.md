# 多語系（i18n）規劃：英文、日文第一波

> 分支 `feat/i18n-en-ja`（2026-10-12）。本檔回答五個問題，並記錄試點做到哪裡。
> 翻譯覆蓋數字見 [`translation-coverage.md`](./translation-coverage.md)。
> **長期執行與接手入口 → [`ROADMAP.md`](./ROADMAP.md)**（進度量測、每次開工／收工步驟、各階段做法）。

**一句話**：語系切換放在工具列（手機放 ⋯ 選單）。翻譯檔放 `src/i18n/locales/<語系>/`。
只在「畫到畫面上」那一刻翻譯，圖層 key、主題字串這類識別字不動。
試點已完成外框（工具列、側欄、圖層與主題名稱）。點擊說明框、圖例、參數面板、Agent 分階段補。

---

## 1. 架構怎麼處理

| 層 | 做法 | 位置 |
|---|---|---|
| 語系登記簿 | 支援哪些語系、各自的 `<html lang>`、Intl locale、缺字回退順序 | `src/i18n/locales.ts` |
| 目前語系 | 決定順序：網址 `?lang=` ＞ 上次選擇（localStorage）＞ 中文。試點**不看瀏覽器語言**（見決策 1）。切換時改 `<html lang>` | `src/state/localeStore.ts` |
| 查字 | `t("toolbar.share")`、`t("x", { count })`；英文複數用 `_one`/`_other` | `src/i18n/translate.ts` |
| 數字、時間 | `formatNumber` / `formatDateTime` 依語系格式化，時間固定台北時區 | `src/i18n/format.ts` |
| 圖層、主題名 | `localizeLayerName` / `localizeSectionTitle`，manifest 不動 | `src/i18n/layerText.ts` |
| 守門測試 | 各語系 key 一致、插值變數一致、layers.json 的 key 必須存在於 manifest | `src/i18n/__tests__/localeParity.test.ts` |

**為什麼不用 i18next**：現在只需要「查字＋插值＋英文複數」，自寫約 50 行就夠，不多一個套件。
JSON 維持 i18next 的扁平格式，以後真的需要（例如 ICU 訊息格式、依頁面拆檔載入）可以直接換，翻譯檔不用重寫。

**鐵則：翻譯只在顯示層**。下面這些中文字串同時是識別字，**不能翻**：

| 識別字 | 誰在用 |
|---|---|
| `section.theme`／`section.group`（如「交通 Move」） | THEMES 索引、側欄分組 |
| manifest `label` | 搜尋索引、Agent、網址 |
| 會員面板分頁 state（`"收藏"`） | 元件內部狀態 |

翻譯檔用圖層的 manifest key 當索引（`layer.busStations`），所以改中文名稱不會讓翻譯失效。

## 2. 在設計系統下，語系切換放哪裡

| 裝置 | 位置 | 依據 |
|---|---|---|
| 桌機 | 工具列「帳號」左邊，一顆圖示按鈕（`Languages`），點開小選單：中文／EN／日本語 | §5.17 禁止新增一排或浮動按鈕。語言是真功能，所以 §1「不放沒功能的按鈕」不適用 |
| 手機 | ⋯ 選單內一列 | §5.29 新入口一律進 ⋯ |
| 說明視窗 | 原本的「中文／EN」分段切換改接全站語系 | §5.27 |
| 分享連結 | 下一步：非中文時在網址帶 `lang=` | `urlState.ts` |

### 設計規格要改的地方（需拍板，見文末決策）

| 規格 | 現況 | 衝突 |
|---|---|---|
| §1「中文優先」、§6.1 標籤一律中文 | 寫死中文 | 英文、日文介面時主標要換成該語言 |
| §4.1 `FONT_CJK` | 只有繁中字型 | 日文會用繁中字形顯示（例：「直」「骨」寫法不同）。試點加了 `:lang(ja)` 系統日文字型，但只有走 CSS 變數的地方生效；程式裡 inline `fontFamily: FONT_CJK` 的元件仍是繁中字形 |
| §5.5 圖層名稱主名不換行 | 中文短 | 英文名較長，可能撐寬側欄 |
| §6.2 千分位寫死 `toLocaleString("zh-TW")` | 120 處 | 改用 `formatNumber` |

## 3. 畫面上哪些內容要改

依「文字從哪裡來」分四類，每類做法不同：

| 類別 | 例子 | 規模 | 做法 |
|---|---|---|---|
| A. 介面字（程式碼裡） | 工具列、側欄、說明、點擊說明框的欄位名（「地址」「營業時間」）、圖例、參數面板「透明度」 | 約 13,570 行含中文、651 檔。點擊說明框欄位名約 2,068 處、55 檔；圖例 `LegendPanel.tsx` 6,542 行；參數標籤約 300 個 | 抽到 `common.json` 等介面字串檔，分階段搬 |
| B. 圖層、主題名稱 | 「公車站」「交通 Move」 | 側欄 1,072 層（含統計配方自動產生的），其中 428 層已有英文名、53 層已有日文名；主題＋子群 277 個 | `layers.json`／`themes.json`，試點已補齊（機器初稿，待人工校對） |
| C. 資料裡已有外文欄位 | 颱風 `name_en`、海象站、空域、日本氣象站、博物館 `name_eng`、作物 `crop_name_en`、水庫 62/98 有英文 | 約 10 個資料集 | 點擊說明框依語系優先顯示外文欄位，缺值回中文 |
| D. 資料裡只有中文 | 站名、路線名、縣市鄉鎮、新聞標題、災害警報內文、統計指標的單位與出處 | 大部分動態資料 | 見下表 |

D 類的處理：

| 內容 | 英文 | 日文 |
|---|---|---|
| 縣市、鄉鎮名（22＋368） | 內政部官方英譯，做成一張對照表 | 保留漢字（日文本來就寫漢字） |
| 統計指標名稱 | 用圖層 key 查 `layers.json`（`regionalStatisticsLoader.ts:500`） | 同左 |
| 單位（「千元／申報戶」） | 補一張單位對照表 | 同左 |
| 公車、台鐵站名 | TDX 原始格式通常有英文名；前端目前只讀中文欄位，collector 有沒有保存英文欄位**尚未查證** → P5 先查上游 | 保留漢字 |
| 新聞、警報、道路事件全文 | 顯示原文並加「原文」標記；機器翻譯要在 collector 端做，不在前端 | 同左 |

其他要一起改的：

| 項目 | 位置 | 做法 |
|---|---|---|
| AI 對話 | `src/chat/systemPrompt.ts:16` 寫死「一律用繁體中文」 | 依目前語系帶入回答語言 |
| 分析 Agent | MCP server 規定「Answer in plain Chinese」 | 跨 repo，把語系傳給 MCP |
| `<title>`、meta | `index.html` | 依語系改寫；OG 標籤目前都沒有 |
| 底圖地名 | Mapbox 底圖標籤（目前中英混雜） | 依語系把標籤欄位切到 `name_en`／`name_ja` |
| 程式裡的字型常數 | `FONT_CJK` 是寫死的字串，inline 樣式不吃 `:lang(ja)` | 改成 `var(--font-cjk)`；canvas／Mapbox 用到的地方要另外處理 |
| 數字、日期 | 約 120 處 `zh-TW`、107 處沒指定 locale | 改用 `format.ts` |

## 4. 翻譯檔放哪裡

```
src/i18n/
├── locales.ts              語系登記簿（新增語系改這裡）
├── translate.ts            t() 實作
├── format.ts               數字／時間格式
├── layerText.ts            圖層、主題名的顯示層翻譯
├── __tests__/localeParity.test.ts
└── locales/
    ├── zh-TW/common.json   介面字（中文原文，唯一正本）
    ├── en/common.json      介面字
    ├── en/layers.json      圖層名（只補沒有英文 alt 的）
    ├── en/themes.json      主題／子群名（「中文 English」會自動取英文半）
    ├── ja/common.json
    ├── ja/layers.json
    └── ja/themes.json
```

- 中文圖層名的正本仍是 `layerManifest.ts`，所以 `zh-TW/` 沒有 layers.json。
- 中文是預設語系，會直接打包進主程式；英文、日文要切換時才下載，不拖慢預設載入。
- 檔案變大時依區塊拆檔（`popup.json`、`legend.json`、`params.json`），同一資料夾的 JSON 會自動合併，不用改程式。

## 5. 之後加更多語系

加一個語系（例：韓文）只要三步：

1. `src/i18n/locales.ts` 的 `LOCALES` 加 `ko: { label: "한국어", htmlLang: "ko", intl: "ko-KR", fallback: ["en", "zh-TW"] }`
2. 複製 `locales/en/` 成 `locales/ko/` 並翻譯
3. 跑 `npm test`：缺 key、多 key、插值變數對不上都會紅

其他已經準備好的：

- **缺字回退**：韓文缺字先找英文，再找中文（載入韓文時會一起載入英文）。不會出現空白，也不會擋上線。
- **字型**：在 `:lang(ko)` 加系統韓文字型。
- **右到左語言**（阿拉伯文）：要另外處理 `dir="rtl"` 和版面鏡像，成本明顯較高，建議真的需要時再評估。
- **翻譯流程**：介面字可以交給翻譯平台（Crowdin、Lokalise 都吃扁平 JSON）。圖層名可以用 `scripts/i18n/export-layer-names.ts` 匯出清單給譯者。

---

## 分階段計畫（每階段做完能多看懂什麼）

| 階段 | 範圍 | 做完後外國使用者能… |
|---|---|---|
| **P0 試點（本分支）** | 語系架構、切換器、工具列、側欄、圖層與主題名、說明視窗、日文字型 | 用英文或日文找到並打開任何圖層 |
| P1 點擊說明框 | 55 個面板的欄位名（約 2,068 處）、C 類外文欄位、縣市鄉鎮英譯表 | 看懂點地圖跳出來的資訊 |
| P2 圖例與參數 | `LegendPanel` 與 `legend/*`、約 300 個參數標籤、統計指標名與單位 | 看懂顏色代表什麼、調整圖層設定 |
| P3 時間軸、監測模式、衛星主控台、會員 | `intel/`、`satelliteConsole/`、`member/`、時間軸 | 使用進階模式 |
| P4 AI 與 Agent | 對話 system prompt、MCP 回答語言、`src/research/` 資料描述 | 用英文、日文問問題並得到同語言回答 |
| P5 上游資料 | collector 存站名英文、新聞與警報機器翻譯（標註為機器翻譯） | 看懂即時資料內容 |

每個階段都可以獨立合併：沒翻到的字會回退到中文，不會壞畫面。

## 試點實際完成

| 項目 | 狀態 |
|---|---|
| 語系架構、parity 測試 | ✅ |
| 切換器：桌機工具列（帳號左側）、手機 ⋯ 選單 | ✅ |
| 工具列、底圖選單、載入畫面、相機 HUD、登入鈕、載入狀態 | ✅ |
| 側欄外框、大分類、主題、子群、圖層名稱（en／ja 都有，機器初稿） | ✅ |
| 說明視窗跟隨全站語系（日文暫時顯示英文內容） | ✅ |
| 日文字型（`FONT_CJK` 改 CSS 變數後全面生效；Mapbox 地名在建圖時取值） | ✅ |
| 圖層限定詞（縣市、鄉鎮市區…） | ✅ |
| 側欄的資料來源面板內文、圖層開關的 aria | ❌ 留到 P1 |
| 搜尋（只比對中文原名） | ❌ 留到 P1 |
| 分享連結帶 `lang=` | ❌ 留到 P1 |

瀏覽器實測：`?lang=en`、`?lang=ja` 都會切換，`<html lang>` 也會跟著改。工具列、側欄主題與圖層名稱都已顯示該語言；中文介面輸出不變。

## 試點驗收

- `npx tsc -b` 通過
- `npm test`：i18n parity、designSystemGuard、layerManifest 全綠
- 中文介面輸出完全不變（zh-TW 字串逐字搬進 `common.json`）

---

## 決策結果（2026-10-12 使用者拍板）

| # | 題目 | 決定 | 落實 |
|---|---|---|---|
| 1 | 依瀏覽器語言自動切換 | 乙：只靠網址 `?lang=` 或手動切換 | `localeStore.ts`；spec §6.4 |
| 2 | §1「中文優先」 | 乙：改成「目前語系優先，中文原名可放小字」 | spec §1、§6.1、§6.4 |
| 3 | 語言鈕在工具列的位置 | 乙：補進固定順序「…拍攝模式 ｜ 語言、帳號」（看過[對照網頁](https://claude.ai/artifact/8fSnhNjZRYhFo8ih9eNEQr)後決定） | spec §5.17 |
| 4 | 外文圖層名太長 | 丙：主名最多換兩行，超過以 … 收尾、滑鼠移上顯示全名 | `LayerRow.tsx`；spec §5.5 |
| 5 | `FONT_CJK` 改 CSS 變數 | 乙：已改，Mapbox 地名字型另以實際字型字串帶入 | `intelTokens.ts`；spec §4.1 |

翻譯校對：使用者不諳英日文，由 Claude 各做兩輪校對（英文改 508 筆、日文改 381 筆），用語表與仍不確定項目見 [`translation-coverage.md`](./translation-coverage.md)。
