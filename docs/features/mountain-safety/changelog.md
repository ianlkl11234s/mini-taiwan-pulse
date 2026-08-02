# Changelog — 登山安全 Mountain Safety

> 逐 PR 變更紀錄。最新在上。

---

## 2026-08-02 — PR #（待補） `（待補 squash hash）`

- 新增 `mountainRescueIncidents`（災害 Hazard 新子群「山域事故」，2,465 點）
  - cause 17 原始值 → 9 族分色；出動總人次 4 級點大小；死亡案件紅描邊
  - 年份 dropdown（全部 + 2019-2024），走 per-layer filter 不接全域時間軸
- 新增 `mountainHuts`（林業 Forestry 點位子群，136 點）
  - `facility_type` 4 類分色；popup 帶海拔 / 容量 / 管理單位；無名工寮顯示「無名山屋」
  - **ODbL 標示**：圖例 + popup 各一行 © OpenStreetMap contributors
- 新增配色 SSOT `src/data/mountainSafetyTypes.ts`
- 部署：`nginx.conf` 加 `location /hazards/`、pull 腳本加 hazards 同步、
  upload 腳本 FOREST_FILES 加 mountain_huts.geojson
- 資料源：上游 `pulse-batch-20260801` 批次（hazards / forestry 兩包）
- Breaking：無（純新增）
