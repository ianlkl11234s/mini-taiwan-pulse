# p5.js Creative Coding 課程 × Mini Taiwan Pulse 素材串接構想

**日期**：2026-07-01
**來源**：Hahow《Creative Coding 互動設計程式藝術入門》(course id 5d1ba52a...)
**觸發**：用戶（也是該課相關者）問，能否把 Pulse 的程式碼／資料用來豐富課程 Chapter 14「資料視覺化與 API - 將資料轉化成藝術」。

## 結論

- ❌ **程式碼本身不搬**：Pulse 是 React 19 + Mapbox GL + Three.js + Supabase，跟 p5.js 課程調性差太遠。
- ✅ **資料源 + 視覺語彙可以搬**：Pulse 的 Supabase 公開 RPC、PMTiles、GeoJSON 都能用 `loadJSON` / `fetch` 在 p5.js / OpenProcessing 直接抓。真實在地資料比 titanic.csv 更打中人心。

## 三種切入方式

### ① Chapter 14 資料範例（最快）

直接把 Pulse 的即時 API 當作素材。候選：

| Pulse 資料 | p5.js 呈現構想 | 對應課程單元 |
|---|---|---|
| 全台即時船舶位置（幾百點） | 粒子舞 | Ch 11 Class 粒子 |
| 航班軌跡（OpenSky 快照） | `curveVertex` 編織 | Ch 9 sin/cos + atan2 |
| A1 地震事件（30 天） | 漣漪 + noise | Ch 9 亂數噪聲 |
| 火災 / 交通事故熱點 | 熱點閃爍 | Ch 5 條件迴圈 |
| 水庫 / AQI | 顏色呼吸 | Ch 6 HSB |

### ② Pulse 視覺語彙 → p5.js 對照

| Pulse 效果（Three/Mapbox） | 翻成 p5.js 教學點 |
|---|---|
| 警察等時圈 overlap_count 色階 | Ch 6 HSB + Ch 7 blendMode |
| A1 地震 3 桶漣漪 halo | Ch 9 sin/cos + Ch 11 粒子 |
| 3D 光柱（消防分隊） | Ch 19 WebGL cylinder + noise |
| 航班曲線軌跡 | Ch 9 atan2 + Ch 7 translate/rotate |
| 時間軸 + 累計時間 chip | Ch 5 條件 + Ch 10 DOM |

### ③ 反向「詩意詮釋」版（作業命題）

同一份資料，把嚴肅圖表變成藝術 — 剛好對應 Ch 14 作業「使用資料視覺化手法製作動態」：

- 台北捷運班次 → 每台車一個發光音符，24 小時濃縮成 60 秒
- 台灣即時降雨 → 島嶼形狀的墨水暈染
- 全台火災年度統計 → 花朵綻放與凋謝

## 下一步（等用戶指示才動）

- [ ] 整理「Pulse 公開 RPC endpoint 清單 + p5.js `loadJSON` 呼叫範例」（可直接貼 OpenProcessing 跑）
- [ ] 挑 3~5 個效果寫成 p5.js 精簡版（每個 100 行內）當補充範例
- [ ] 若要正式跟課程合作 → 確認資料授權 / API rate limit / CORS 設定
