# Embeddable Map — Backlog

> SSOT。`.claude/memory/BACKLOG.md` 的 EM 系列只留索引，細節看這裡。
> 優先級：**P0** 阻塞 / **P1** 規劃期內 / **P2** 穩定後 / **P3** nice-to-have

## 已完成

| ID | 項目 | 結果 |
|---|---|---|
| EM-21 | 底圖 + 快照上 S3 並部署 | ✅ 2026-08-05。297 MB 底圖 + 共機快照上 S3；Zeabur 自動部署；正式站驗證 **Mapbox 0 / Supabase 0** |
| EM-13 | Cloudflare 快取規則 | ✅ 2026-08-05。Cache Rule `Static map data`（設定內容記於 handoff §0b）。實測快照/PMTiles/底圖 range 全部 HIT |

## 待辦

| ID | 優先級 | 項目 | 備註 |
|---|---|---|---|
| EM-23 | P2 | 行動裝置實機驗收 | 桌機與模擬器已驗；真機（尤其低階 Android）的 MapLibre 效能未測 |

## 功能待辦

| ID | 優先級 | 項目 | 備註 |
|---|---|---|---|
| EM-17 | — | 補 `get_gas_station_layers` 快照 → 加油站 5 層可嵌 | **done 2026-08-10 23:1x**：快照上 S3（22:40）＋embed 5 層接線 merged（PR #125，`EMBED_CDN_LAYER_FILTER` 按 row.layer 拆 5 品牌）→ 新容器部署後 **prod 探測 200、8,309,401 bytes 與 S3 逐位元一致**（帶 cache-buster）。主站 staticRpc 靜默 fallback 打 RPC 的 egress 從此停止 |
| EM-18 | P2 | 更多歷史快照圖層（`earthquakeReplay` 等） | 樣板已成形：`snapshotLayers.ts` 加 spec + export 腳本加 case |
| EM-11 | P2 | 底圖改放 Cloudflare R2（選配） | 目前走 `public/base_map/` 既有管線已可運作。改 R2 只需設 `VITE_EMBED_BASEMAP_URL`；R2 egress 免費，高流量時較划算 |
| EM-12 | P3 | Protomaps 字型／sprite 自託管 | 目前指向 `protomaps.github.io`（已加進 CSP）。自託管可去掉最後一個外部依賴 |
| EM-07 | P3 | facade 模式（先縮圖、點擊才載入） | 走 MapLibre 後成本已歸零 → **降級為純效能優化** |
| EM-08 | P3 | 嵌入碼防腐：`layerAliases.ts` + 守門測試 | layer key 改名會讓既有文章的地圖全壞且無通知 |
| EM-22 | P3 | popup 欄位標籤擴充 | `FIELD_LABELS` 目前約 25 個常見欄位；其餘顯示原始英文 key。值的中文化（如 `catholic`）刻意不做 —— 無底洞 |

## 待討論

| ID | 項目 | 現況 |
|---|---|---|
| EM-16 | Three.js 圖層（船舶／班機／鐵路／公車）嵌入 | **owner 2026-08-04：之後再談**。embed 刻意不掛 Three.js；即時感圖層嵌進靜態文章敘事價值低、移植成本最高。替代方案：截圖 + 連結 |

## 明確不做

- oEmbed endpoint / 動態 OG 圖（需動態後端，等真有第三方 CMS 需求）
- 給第三方的 JS SDK（iframe 已足夠，且 iframe 內 JS 跑在自己 origin，token 不外流）
- embed 的會員功能（iframe 內第三方 cookie 被瀏覽器封鎖，登入態不存在）
- 讓 `/embed` 直接打任何 Supabase RPC（違反本功能的成本前提）
- 即時類圖層嵌入（閃電／停車位／急診壅塞 —— 文章永久性與即時資料語意衝突）
- 全站改 MapLibre（主站要保留 Mapbox 的好底圖；Three.js CustomLayer 遷移風險高）
