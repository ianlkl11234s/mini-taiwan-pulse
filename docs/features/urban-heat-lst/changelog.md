# Changelog — 都市熱島 Urban Heat

> 逐 PR 變更紀錄。最新在上。

格式：
```
## YYYY-MM-DD — PR #NN <squash commit hash>
- <what changed>
- <why (optional)>
- <breaking? migration needed?>
```

---

## 2026-07-30 — PR #（待開）

- 新增 `urbanHeat` raster PMTiles 圖層（Landsat 8/9 地表溫度，z6–11 @512px，29.6 MB）
- 雙顯示模式：熱島強度 ΔT（發散色階，白鎖 0 K，−10~+8 K）／絕對地表溫度（inferno，22~48 °C）；
  切換 = 換 `raster-color-mix` + `raster-color` + `raster-color-range`
- 色票／值域 SSOT：新檔 `src/data/urbanHeatTypes.ts`（圖例與圖層同源）
- `raster-color-mix` 採「係數作用在 0–255 原始 DN」的寫法（`[0.2,0,0,-30]` / `[0,0.25,0,10]`），
  與上游 handoff §3.4 的正規化寫法不同 — 依據 mapbox-gl 3.9 `computeRasterColorMix()` 原始碼，
  詳見 [handoff.md](./handoff.md)「已知不對稱」
- 部署：`upload-deploy-assets.sh` 新增 `public/environment/*.pmtiles` 上傳段；
  `.gitignore` 忽略 `public/environment/*.pmtiles`（nginx / pull 腳本的 `environment/` 早已就位）
- 預設關閉。Breaking：無
