# Backlog — 世界通訊圖層

## 待辦

- [x] 以 OSM ODbL＋OpenInfraMap z2 overview 取代 TeleGeography 舊快照；104 線＋58 登陸站，明示 crowd/incomplete — 2026-08-18
- [ ] 若要更完整海纜 geometry，需改用可合法再散布且有全量下載的來源；不可回退爬 TeleGeography raw API。
- [ ] 評估 PeeringDB facilities／IXP 關聯（先確認 AUP 與快照再發布條件）。
- [x] Ookla 格網解析度分級：全球 z6／z8／z10 手動切、台灣 z14→z16 兩級 PMTiles、配色可切換 — 2026-08-25
- [ ] **加入 Ookla 2026-Q2 之前，四個資產要改走 S3 deploy-assets**（analytics B192）。
  現況四檔共 54 MB 走 git → dist，單季在慣例內；但季度資料每季塞一份會撐爆 repo。
  改法比照 canopy_height／agriculture：`.gitignore` 排除 `public/geo/ookla_*`、
  檔名帶季度、加進 `scripts/deploy/upload-deploy-assets.sh`，並確認 deployContract 仍綠。
- [ ] 兩套配色的預設值待實際使用後回頭確認（目前預設柔和 RdYlBu；高對比在全球視角辨識度較好）。
- [x] 加入 RIPE Atlas 量測節點與 3,000 點世界概覽，並清楚標示 80–400m 位置偏移 — 2026-08-18
- [x] 納入 Ookla 2026 Q1 mobile／fixed 全球效能格網，維持實測品質與 coverage 語意分離 — 2026-08-18
- [x] 補入 Ookla mobile／fixed GeoJSON asset 並驗證 deploy contract — 2026-08-18
- [x] 取得 OSM 六都會區域抽樣 GeoJSON asset（916 點；不是全球完整清冊）— 2026-08-18

## 已完成（近期）

- [x] 世界通訊資訊架構與首個真實 global point layer — 2026-08-18
- [x] OSM 通訊候選點 layer 與六都會區域抽樣 asset — 2026-08-18
- [x] OSM 海纜與登陸站全球 crowd overview，保留既有 deep-link layer keys — 2026-08-18
