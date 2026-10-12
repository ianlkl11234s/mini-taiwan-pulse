# i18n 架構與維護規則

> 進度與分階段計畫看 [`docs/features/i18n/ROADMAP.md`](../../docs/features/i18n/ROADMAP.md)；設計規格看 `docs/design-system/spec.md` §6.4。

## 一張圖看懂

```
src/i18n/
├── locales.ts      語系登記簿：label、<html lang>、Intl、回退順序、complete/partial
├── keys.ts         key 型別：靜態 key 由 zh-TW JSON 推出；動態命名空間白名單
├── translate.ts    t()／lookup()：插值 {name}、複數 _one/_other
├── format.ts       數字、時間（固定台北時區）
├── layerText.ts    圖層名、主題、限定詞的顯示層翻譯
├── dataText.ts     資料內容：外文欄位挑選、類別代碼翻譯
└── locales/<語系>/
    ├── common.json、<區塊>.json   介面字串（zh-TW 是正本）
    ├── layers.json、themes.json、qualifiers.json、enums.json   名稱對照（只有外文語系有）
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
localizedField(props, { zh: "name", en: "name_en" }, i18n)
enumLabel("newsCategory", code, NEWS_LABELS[code], i18n)
```

## 規則

1. **只在顯示層翻譯**：`section.theme`、manifest `label`、URL 參數、元件 state 值都是識別字，不翻。
2. **中文正本在 `zh-TW/*.json`**：從元件搬出來時逐字照搬，確保中文畫面不變。
3. **檔名就是命名空間**：`popup.json` 裡的 key 一律以 `popup.` 開頭；只有 `common.json` 例外（放跨區塊的通用字）。
4. **key 命名**：`<區塊>.<元件或主題>.<用途>`，全小寫 camelCase，例 `popup.transport.stationName`。同義欄位共用一個 key（例 `popup.field.address`），不要每個面板各寫一個。
5. **動態 key 要登記**：key 由資料組出來時（`layer.${key}`），命名空間要列進 `keys.ts` 的 `DYNAMIC_NAMESPACES`，並用 `lookup()`（找不到回 null）自己處理 fallback。
6. **不要寫死中文**：新介面文字寫死中文會被 `hardcodedZh` 防倒退測試擋下。
7. **翻譯品質**：英日文各由子代理校對兩輪，用語照 `docs/features/i18n/translation-coverage.md` 的用語表；新用語補進用語表。

## 常見工作

**加一句介面字**：`zh-TW/<檔>.json` 加 key → `en/`、`ja/` 同名檔補翻譯 → 程式用 `t()`。

**新增一個區塊檔**（例 `popup.json`）：
1. 三個語系都建 `popup.json`，key 以 `popup.` 開頭。
2. `keys.ts` 加 `import type popup from "./locales/zh-TW/popup.json"`，併進 `ZhMessages`（`typeof common & typeof popup`），並在 `TYPED_MESSAGE_FILES` 加上檔名。
3. 不用改載入程式：同資料夾的 JSON 會自動合併。

**新增一個語系**（例 韓文）：
1. `locales.ts` 加 `ko: { label: "한국어", htmlLang: "ko", intl: "ko-KR", fallback: ["en", "zh-TW"], status: "partial" }`。
2. 建 `locales/ko/`，可以先放空的 JSON；缺的 key 會依序回退到英文、中文。
3. `tokens.css` 加 `:root:lang(ko) { --font-cjk: <系統韓文字型> }`。
4. 邊翻邊合併。翻完把 `status` 改成 `"complete"`，之後缺任何 key 都會紅燈。

## 守門測試（`src/i18n/__tests__/`）

| 測試 | 擋什麼 |
|---|---|
| `tsc -b` + `keys.ts` | key 打錯字、用了不存在的 key |
| `localeParity` | complete 語系缺字、多出預設語系沒有的 key、插值變數不一致、檔名與 key 前綴不符、新檔沒接型別、沒人用的 key、`layers.json` 用了不存在的圖層 |
| `hardcodedZh` | 任何區塊寫死的中文比基準多 |
| `localeStore` | 預設語系、回退語系一併載入 |
| `dataText` | 外文欄位挑選、類別代碼回退 |

## 為什麼不用 i18next

目前只需要「查字、插值、英文複數」，自寫約 60 行，不多一個套件。JSON 用 i18next 相容的扁平格式。真的需要 ICU 訊息格式或依頁面拆包載入時，換成 i18next 只要改 `translate.ts` 與 `localeStore.ts`，翻譯檔不用動。
