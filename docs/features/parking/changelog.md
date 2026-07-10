# Changelog — 停車 parking

> 逐 PR 變更紀錄。最新在上。

---

## 2026-07-10 — Batch 3 hybrid v1（branch `feat/parking`，stack 於 road-congestion，未 PR / 未 push）

- 新增 `parkingOnstreet`（路邊）+ `parkingOffstreet`（場外）兩層（交通 §停車 Parking）。
- **關鍵前置**：即時可用性表**無座標** → 新建靜態座標 collector（data-collectors `parking_ref.py`）灌 `spatial.parking_segments_ref` / `parking_lots_ref`（migration 286）；前端走 **SECURITY DEFINER** join RPC（287：`get_parking_segments_current` / `get_parking_lots_current`）。
- **hybrid v1 範疇**（PK1 驗證覆蓋率後用戶拍板）：
  - 路邊：**台北 2347 POLYGON 沿街填色**（availability_rate=null 因即時 available 全 -1 → **中性色僅顯容量**）+ 新北 553/台中 184 點（空位率染色）
  - 場外：高覆蓋城市 2083 點（city 2011 / tourism 57 / freeway 15，空位率綠→紅 + 大小隨 total_spaces）
  - **phase-2 缺口**：台北場外(10%)/基隆場外(0%)/新北台中路邊(半覆蓋、無幾何)
- 統一「服務可得性」色軸（綠=空位多/紅=滿，比照 youbike 有車率）。availability_rate guard 台北 -1。當下快照（v1 不做 timeline 回放）。
- **驗收**：tsc 0 / test 190 / browser 主 agent 親驗（雙北+全台空位率點染色截圖 + 台北 polygon 中性 fiber 實證：onstreet 3084=Polygon 2347+Point 737）。
- Breaking：無（純新增）。需 migration 286/287 + collector 灌參考表。

### 待辦
- phase-2 覆蓋補洞（新北/台中/台北/基隆各府自家停車開放資料補座標）
- timeline 回放（H3 快照 pre-aggregate，比照 youbike）
- collector 月更排程（現 `parking_ref` enabled=false 手動；要排程移 zeabur）
- car_park_type 目前存 source_category（非 TDX raw enum，缺 codebook）
