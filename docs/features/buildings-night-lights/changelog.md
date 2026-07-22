# Changelog — 建物夜景燈光 Buildings Night Lights

> 逐 PR 變更紀錄。最新在上。

---

## 2026-07-22 — 初版（本地 commit，未 push）

- `buildingsGba` 新增 mode 3「夜景燈光」：純 Mapbox fill，暖橘/白雙色階依 `height` 由暗轉亮 + `%3` pseudo-random 交錯（約 1/3 白光）。
- 新增高樓 bloom 疊層 `buildings-night-bloom-3d`：夜景模式時對視野內 `height ≥ 門檻`（slider 預設 100m）取最高前 4096 棟疊 Three.js additive 光暈，復用 `GlowPointsScene`。
- 新 slider `buildingsGbaBloomMinHeight`（40–200m）。
- 圖例補 mode 3 分支 + 「搭深色底圖」提示。
- Breaking：無（無資料契約變更）。
- 待補：PR # + squash hash（merge 後回填）。
