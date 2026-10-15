# i18n 架構與維護規則

> 進度與分階段計畫看 [`docs/features/i18n/ROADMAP.md`](../../docs/features/i18n/ROADMAP.md)；設計規格看 `docs/design-system/spec.md` §6.4。

## 一張圖看懂

```
src/i18n/
├── locales.ts      語系登記簿：label、<html lang>、Intl、回退順序、complete/partial
├── keys.ts         key 型別：靜態 key（keys.generated.ts，腳本產生）＋動態命名空間白名單
├── translate.ts    t()／lookup()：插值 {name}、複數 _one/_other
├── format.ts       數字、時間（固定台北時區）
├── layerText.ts    圖層名、主題、限定詞的顯示層翻譯
├── dataText.ts     資料內容：外文欄位挑選、類別代碼翻譯
├── paramText.ts    圖層設定面板：用中文原文查 params.json
└── locales/<語系>/
    ├── common.json、<區塊>.json   介面字串（zh-TW 是正本）
    ├── layers.json、themes.json、qualifiers.json、enums.json、params.json   名稱對照（只有外文語系有）
src/state/localeStore.ts   目前語系：?lang= ＞ 上次選擇 ＞ zh-TW；lazy 載入外文
```

元件裡一律這樣用：

```tsx
const i18n = useLocale();
const { t, formatNumber } = i18n;

t("toolbar.share")                         // 靜態 key：打錯字 tsc 會紅
t("layers.found", { count: n })            // 複數：JSON 裡寫 layers.found_one／_other
formatNumber(12345)                        // 依語系千分位
localizeLayerName(key, entry.name, i18n)   // 名稱類 helper 傳整個 i18n，不要傳 t
<Row field="address" value={…} />          // 說明框常用欄位：Row 自己翻譯（popup.field.*），面板不用 hook
localizedField(props, { zh: "name", en: "name_en" }, i18n)
enumLabel("newsCategory", code, NEWS_LABELS[code], i18n)
```

## 規則

1. **只在顯示層翻譯**：`section.theme`、manifest `label`、URL 參數、元件 state 值都是識別字，不翻。
2. **中文正本在 `zh-TW/*.json`**：從元件搬出來時逐字照搬，確保中文畫面不變。
3. **檔名就是命名空間**：`popup.json` 裡的 key 一律以 `popup.` 開頭；只有 `common.json` 例外（放跨區塊的通用字）。
4. **key 命名**：`<區塊>.<元件或主題>.<用途>`，全小寫 camelCase，例 `popup.transport.stationName`。同義欄位共用一個 key（例 `popup.field.address`），不要每個面板各寫一個。
5. **動態 key 要登記**：key 由資料組出來時（`layer.${key}`），命名空間要列進 `keys.ts` 的 `DYNAMIC_NAMESPACES`，並用 `lookup()`（找不到回 null）自己處理 fallback。
6. **已翻完的不准倒退**：`hardcodedZh` 測試只擋「已翻完」區塊的檔案。未開工區塊只報告，所以新增圖層照舊能寫中文；每階段收工時把翻完的檔案加進嚴格區塊。
7. **翻譯品質**：英日文各由子代理校對兩輪，用語照 `docs/features/i18n/translation-coverage.md` 的用語表；新用語補進用語表。

## 常見工作

**加一句介面字**：`zh-TW/<檔>.json` 加 key → `en/`、`ja/` 同名檔補翻譯 → `npx tsx scripts/i18n/gen-keys.ts` 更新型別 → 程式用 `t()`。

**說明框（featureInfo）**：
- 常用欄位名用 `<Row field="…">`，可用的名稱看 `zh-TW/popup.json` 的 `popup.field.*`（型別 `PopupField`）；同一個意思不要另開 key。
- 面板專屬文字放 `popup.<domain>.json`（例 `popup.transport.json`），元件內 `const { t } = useLocale()`。
- 資料值的類別（氣象站類型、鐵路系統）用 `enumLabel`，英日文寫在 `enums.json`。
- 標題列自動借用圖層名；對不到圖層的才在 `popupHeaders.json` 補 `popupHeader.<layerType>`。

**圖層設定面板（layerParamsSpec.ts）**：
- 規格檔的中文標籤**不改**：Agent、黃金快照、`english-control-label` guard 都讀中文。顯示時 `buildParamControls(key, values, i18n)` 才換語系，只有面板（`ExpandedControls`）傳 `i18n`。
- 英日文寫在 `en/params.json`、`ja/params.json`，key 是中文原文：`"param.透明度": "Opacity"`。同一個字翻一次全部通用。
- 某個圖層要不同譯法時，加 `param.<layerKey>.<參數名>` 覆寫。
- 新圖層沿用既有標籤就自動有翻譯；新的字沒翻時顯示中文，不擋上線。列出還沒翻的字：`npx vite-node scripts/i18n/export-param-texts.ts en`。
- 中文改字時，要把 `params.json` 的 key 一起改，否則測試會擋孤兒 key。
- 色盤名用 `enum.palette.<id>`（`enums.palette.json`）。

**統計圖層**：
- 配方（`*StatisticsRecipes.ts`、打包 JSON）的中文不改：單位要和 R2 比對、配色依中文判斷、Agent 讀中文。
- 標題 `statisticsTitle(layerKey, zh, i18n)` 借圖層譯名；單位、更新頻率 `statisticsUnit`／`statisticsFrequency` 以中文原文查 `enums.statUnit.json`／`enums.statFrequency.json`（`src/i18n/statisticsText.ts`）。新配方用了新單位，補這兩個檔；`statisticsText.test` 擋孤兒 key。
- `statisticsLabels.ts` 的人讀函式最後一個參數是選填 `i18n`，不傳＝中文。
- 連動選單選項可帶 `localize(i18n)`；只有面板傳 i18n，Agent 拿到的仍是中文。

**新增一個區塊檔**（例 `popup.water.json`）：
1. 三個語系都建同名檔，key 以檔名開頭（`popup.water.`）。
2. 跑 `npx tsx scripts/i18n/gen-keys.ts` 更新 key 型別；不用改 `keys.ts`，也不用改載入程式。
3. 主題專屬的類別代碼翻譯可放 `en/enums.<domain>.json`、`ja/enums.<domain>.json`（key 仍是 `enum.<domain>.<code>`）。

**新增一個語系**（例 韓文）：
1. `locales.ts` 加 `ko: { label: "한국어", htmlLang: "ko", intl: "ko-KR", fallback: ["en", "zh-TW"], status: "partial" }`。
2. 建 `locales/ko/`，可以先放空的 JSON；缺的 key 會依序回退到英文、中文。
3. `tokens.css` 加 `:root:lang(ko) { --font-cjk: <系統韓文字型> }`。
4. 邊翻邊合併。翻完把 `status` 改成 `"complete"`，之後缺任何 key 都會紅燈。

## 守門測試（`src/i18n/__tests__/`）

| 測試 | 擋什麼 |
|---|---|
| `tsc -b` + `keys.generated.ts` | key 打錯字、用了不存在的 key |
| `localeParity` | complete 語系缺字、多出預設語系沒有的 key、插值變數不一致、檔名與 key 前綴不符、key 型別檔過期、沒人用的 key、`layers.json` 用了不存在的圖層、`params.json` 孤兒 key |
| `hardcodedZh` | 已翻完（嚴格）區塊寫死的中文比基準多；其他區塊只報告 |
| `localeStore` | 預設語系、回退語系一併載入 |
| `dataText` | 外文欄位挑選、類別代碼回退 |
| `paramText` | 設定面板：中文介面輸出不變、滑桿運算符號、停用原因分開翻 |

## 為什麼不用 i18next

目前只需要「查字、插值、英文複數」，自寫約 60 行，不多一個套件。JSON 用 i18next 相容的扁平格式。真的需要 ICU 訊息格式或依頁面拆包載入時，換成 i18next 只要改 `translate.ts` 與 `localeStore.ts`，翻譯檔不用動。
