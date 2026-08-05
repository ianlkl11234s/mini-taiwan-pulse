# Embeddable Map — Backlog

> SSOT。`.claude/memory/BACKLOG.md` 的 EM 系列只留索引，細節看這裡。
> 優先級：**P0** 阻塞 / **P1** 規劃期內 / **P2** 穩定後 / **P3** nice-to-have

## 上線前必做

| ID | 優先級 | 項目 | 備註 |
|---|---|---|---|
| EM-21 | **P0** | **底圖 + 快照上 S3 並部署** | `public/base_map/taiwan_basemap.pmtiles`（283 MB）與 `public/embed-snapshots/`。跑 `scripts/deploy/upload-deploy-assets.sh`；三處接線已就緒無需改腳本 |
| EM-13 | P1 | 部署後驗收：實機 iframe（非 localhost）+ 行動裝置 + Cloudflare 快取規則 | 283 MB 首拉留意 Zeabur 健康檢查逾時 |

## 功能待辦

| ID | 優先級 | 項目 | 備註 |
|---|---|---|---|
| EM-17 | P2 | 補 `get_gas_station_layers` 快照 → 加油站 5 層可嵌 | loader 已用 `staticRpc` 但 `public/static-rpc/` 無此檔 → **主站一直靜默 fallback 打 RPC**。export 腳本已列該 RPC，需確認 migration 已套用後重跑。補完把 key 加進 `EMBED_CDN_LAYERS`（有測試守門擋「加了 key 但沒檔」） |
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
