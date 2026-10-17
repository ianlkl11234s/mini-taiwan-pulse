# 右下資料來源列：單行＋展開清單

> **Slug**：`attribution-compact`
> **狀態**：dev（PR 到 develop，待驗收）
> **上線日期**：未發布
> **相關 PR**：見 [changelog.md](./changelog.md)

## 一句話說明

地圖右下的資料來源原本由 Mapbox 內建控制項把每個圖層的來源串成一長串，開 5 層就折兩行、壓到 Mapbox logo。改成單行「資料來源 N ⌃ · © Mapbox © OpenStreetMap Improve this map」，點「資料來源 N」往上展開依授權分組的清單，每筆可開原始頁。

## 元件

| 名稱 | 說明 |
|---|---|
| `AttributionBar` | 收合列（portal 到右下角落）＋展開卡（portal 到 body，`Z_INDEX.popover`） |
| `BasemapAttributionControl` | 繼承 Mapbox `AttributionControl`，只顯示底圖（`mapbox://` source）版權，`compact: false` |
| `AttributionHostControl` | 空殼 control，提供版權列左側的 DOM 節點 |

## 架構

1. **來源從地圖收集，不從 OverlayConfig 收集**：圖層來源寫進 source 的路徑除了 overlayRegistry（`overlayManager.addOverlay`），還有十多個 hook 自己 `addSource` 或事後補 `source.attribution =`（PMTiles、GFW、JMA、海象、日本水資源、橋梁、液化、珊瑚…），部分字串執行期才決定。`readMapSourceViews` 讀 `map.getStyle()` 的 layers（visibility ≠ none）找出被使用的 source，再讀 source instance 的 `attribution`——也就是內建控制項原本讀的同一個欄位，所以原本會顯示的來源一定收得到。
2. **內建控制項只剩底圖**：`BasemapAttributionControl` 覆寫 mapbox-gl 3.18.1 私有 `_updateAttributions`，呼叫原實作前同步遮掉非 `mapbox://` source 的 attribution、結束還原；找不到內部結構時退回原實作（多標不漏標）。
3. **解析**（`attributionParse.ts`，字串內容不改）：以「 | 」「；©」切多來源；最後一個「·」後段像授權就當授權，否則全文找已知授權（政府資料開放授權條款第1版、ODbL、CC BY…、Public Domain、公共データ利用規約1.0），都沒有放「其他」原文顯示；`data.gov.tw <nid>` 轉成資料集頁；`<a href>` 只取文字與 http(s) 網址。
4. **手機**：`MobileBottomSheet` 寫 `--mobile-sheet-inset`，Mapbox 底部兩角讓到 sheet 上方（原本 sheet 會蓋住 logo 與版權列）；窄螢幕 logo 墊高 20px 避免與單行版權列重疊。

規格：`docs/design-system/spec.md` §5.38。

## 關鍵檔案

- `src/components/AttributionBar.tsx`、`src/components/attributionBar.css`
- `src/map/attribution/mapAttribution.ts`、`src/map/attribution/attributionParse.ts`
- `src/map/MapView.tsx`（`attributionControl: false`＋自加兩個 control）
- `src/components/MobileBottomSheet.tsx`（`--mobile-sheet-inset`）
- 測試：`src/map/attribution/__tests__/attribution.test.ts`（registry 每個有 attribution 的 overlay 開啟後都被收集、解析）、`basemapAttributionControl.test.ts`

## 範圍外

- `/embed`（`EmbedApp`）維持原本自繪 bar，未改。
- 研究頁、卡片頁（MapLibre）不受影響。

## 歷次改動

看 [changelog.md](./changelog.md)。
