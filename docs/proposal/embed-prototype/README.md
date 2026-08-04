# 嵌入版原型（EM-01 / EM-06 spike）

> 2026-08-04 · 對應 [`../embed-basemap-osm.md`](../embed-basemap-osm.md) 與 [`../embeddable-map-impl.md`](../embeddable-map-impl.md)
> **狀態：驗證通過。** 底圖已由 owner 拍板「可以接受」→ Phase 2 走 MapLibre 路線。

三個獨立 HTML，**不進 build、不依賴專案任何程式碼**，純粹用來驗證嵌入路線可行性。

| 檔案 | 用途 |
|---|---|
| `basemap-test.html` | 只有 Protomaps 底圖（無資料圖層）。切明暗、跳城市，用來判斷底圖美觀度與中文地名品質 |
| `embed-proto.html` | **`/embed` 的原型**：MapLibre + Protomaps 底圖 + 魚塭圖層 + 圖例 + 出處 + 連回主站。附 demo 專用的圖層開關與「畫面內 N 口」計數 |
| `demo-article.html` | 模擬一篇文章，中間用 `<iframe>` 嵌入 `embed-proto.html` —— 最終效果長這樣 |

## 怎麼跑

需要兩個檔案（**不在 git**，太大）：

| 檔案 | 大小 | 來源 |
|---|---|---|
| `taiwan-basemap-z15.pmtiles` | 283 MB | 見下方抽取指令 |
| `aquaculture_ponds_osm.pmtiles` | 3.1 MB | 直接複製 `public/fishery/aquaculture_ponds_osm.pmtiles` |

```bash
# 1. 準備工作目錄（放 pmtiles + 三個 html）
mkdir -p /tmp/embed-spike && cd /tmp/embed-spike
cp <repo>/docs/proposal/embed-prototype/*.html .
cp <repo>/public/fishery/aquaculture_ponds_osm.pmtiles .

# 2. 抽台灣底圖（約 1 分鐘；--dry-run 可先看大小不下載）
#    bbox 含澎湖/金門/馬祖。z15 = 283MB，z14 = 123MB（每降一級約減半）
pmtiles extract https://build.protomaps.com/20260802.pmtiles taiwan-basemap-z15.pmtiles \
  --bbox=118.1,21.8,122.1,26.4 --maxzoom=15 --download-threads=8

# 3. 起兩個 server（8899 供圖磚、8900 供頁面）
(pmtiles serve . --port=8899 --cors='*' >/dev/null 2>&1 &)
(python3 -m http.server 8900 --bind 127.0.0.1 >/dev/null 2>&1 &)

# 4. 開頁面
open http://localhost:8900/demo-article.html   # 文章嵌入效果
open http://localhost:8900/embed-proto.html    # 嵌入版本體
open http://localhost:8900/basemap-test.html   # 純底圖

# 收工
lsof -ti:8899,8900 | xargs kill
```

`embed-proto.html` 吃的網址參數（與 `src/lib/urlState.ts` 同一套語彙）：
`?v=1&lng=120.13&lat=23.09&z=11.2&layers=aquaculturePonds&theme=dark&p.aquaculturePondsOpacity=0.5`

## 驗證結論

| 項目 | 結果 |
|---|---|
| 台灣 z0–15 底圖 | **283 MB**（R2 免費額度 10 GB，儲存成本實質 $0） |
| 中文地名 | 完整到「里」層級（七股區／三股仔／什份塭／土城仔…） |
| 魚塭疊圖 | 正常，樣式與 `overlayRegistry.ts:3479` 一致（`#26c6da` / fill+line / minzoom 9） |
| iframe 嵌入 | 正常，暗色地圖配淺色文章版面效果良好 |
| Mapbox 用量 | **零**（全程 MapLibre + 自託管圖磚，不載入 mapbox-gl） |

## 已知差異（正式版要補）

1. **圖層開關是 demo 專用**：正式 `/embed` 的圖層由網址參數決定，不提供 UI 開關
2. 原型的樣式是手寫的；正式版要接 `overlayRegistry` + `overlayManager`（見 impl §4-3，`overlayManager` 只有 3 處型別碰 mapbox-gl）
3. 原型只有魚塭一層；正式版白名單為 154 個靜態圖層扣掉 gated
4. 底圖尚未上 R2（等 owner 決定後上傳，見 EM-01 收尾）

## 踩到的坑

- **`Number(null) === 0` 且 `isFinite(0)` 為真** → 用 `Number(q.get(k))` 判參數時，缺參數會拿到 0 而不是預設值（會讓 opacity 變全透明）。必須先判 `null`／空字串。`src/lib/urlState.ts` 的 `finiteNum()` 已避開。
- **agent-browser daemon 導航後會遺失 WebGL context**（報 `Failed to initialize WebGL`、地圖全空白但 UI 正常）。解法：`agent-browser close` 後帶 launch args 重開 session。詳見全域 memory `agent-browser-mapbox-verify`。
- **Protomaps daily build 的 `planetiler:buildtime` 顯示 2026-03-28** 而非檔名日期（20260802）。不影響使用，但若要求資料新鮮度需另行確認上游 build policy。
