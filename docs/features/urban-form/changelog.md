# Changelog — 都市形態 Urban Form

> 逐 PR 變更紀錄。最新在上。

格式：
```
## YYYY-MM-DD — PR #NN <squash commit hash>
- <what changed>
- <why (optional)>
- <breaking? migration needed?>
```

---

## 2026-07-15 — PR #待開 `待 squash`

- 新增 `buildingsGba` 圖層：全台 3D 建物輪廓（GBA + OSM 融合，152 萬棟本島）
- 三種顯示模式：高度 6 級分級（fill）/ 資料來源二色（fill）/ 3D 立體（fill-extrusion，沿用高度色階）
- 高度門檻篩選 slider（≥ X 公尺，走 `filter` 而非 opacity 歸零，因 fill-extrusion-opacity 不支援 data-driven）
- 資料源：taipei-gis-analytics `docs/handoff/gba_canopy_frontend.md`；CC BY-NC 4.0，圖例已掛署名
- 架構調整：`OverlayLayerSpec.filter` 擴充為可函式化（供 rebuildOnParamChange 把即時 params 烤進 filter literal）
- Breaking：無（純新增；`overlayManager.ts` 的 filter 解析為向下相容擴充，既有 layer 行為不變，
  overlayManager.test.ts 18 項測試維持全綠）
