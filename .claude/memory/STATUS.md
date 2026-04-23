# Status

**最後更新**：2026-04-23（session：水資源 Phase 2.3 + BL-5 3D 進/出流雙排柱 + 遷移 memory 框架）
**分支**：`master`（剛合併 `feat/water-resources`）

## 本次 session 完成

### 水資源校準 + 功能
- **Migration 056**：蓄水率分母從設計有效容量改成「現行有效容量」（扣淤積），
  對齊水利署官網。曾文 12% → 16.3%、霧社 12% → 65.9%。
- **Alert key 中英文對齊**：view 回英文 `critical/warning/normal/high`，前端
  dict 改英文，顏色分級（紅/橘/青/綠）終於生效。
- **Phase 2.3 Timeline 回放**：rain gauge / river level / reservoir 三層改走
  `timeStore.subscribeDate` + `subscribeThrottled`，配合 migration 057
  `get_rain_gauge_day` + `get_river_water_level_day`。
- **雨量 Mapbox heatmap**：加 heatmap 層做擴散視覺，zoom 分工（遠景 heatmap，
  近景 circle）。
- **BL-5 3D 進/出流雙排日柱**：點水庫後殼兩翼浮出 N 日柱陣（綠色進流、橘紅色出流），
  ReservoirScene 加 fast path 避免 per-tick GPU buffer 重建。
- **效能修**：`reservoirCustomLayer` 移除 per-frame `triggerRepaint`，避免無限
  60 FPS render loop（static 3D 不需要）。改 hook state useEffect 主動觸發。
- **Today + Yesterday 合併**：`loadDay` 併兩天資料，避免早上時段部分水庫缺資料閃現。
- **柱位置調整**：柱體移出殼外側翼（rowOffset 0.9 → 1.35 × radius），
  總高限 0.55× shell，zoom in 也看得到。

### 記憶框架遷移
- 從 plan-art 完整遷移 memory 系統（9 檔 + FRAMEWORK.md + /wrap-up skill）
- 從 `.claude/lessons.md` / `principles.md` / `retrospectives/` / `pitfalls/`
  把內容重新分類到 memory/ 9 檔

## 本 session commits（master 14 個）

```
6600433 fix(water): 進/出流雙排柱移出水位計殼外 + 降低浮空高度
52a56ba fix(water): 水庫 3D 移除 per-frame repaint + 合併 today/yesterday
06116e7 feat(water): 進/出流 3D 視覺化改為雙排日柱陣（浮空 × N 日 × 兩排）
dae1c78 feat(water): 水庫點選後顯示 3D 進/出流雙柱（BL-5 方案 D）
48e1539 feat(water): 雨量圖層加 heatmap 擴散層（Mapbox native）
bde5b87 feat(water): timeline 回放 — rain/river/reservoir 切換至 timeStore
b1bc91d docs(water): 更新進度
4bee226 fix(water): 水位計顏色對齊 alert_level（英文 key）
gis-platform:
1e81a8a feat(water): 057 當日時序 RPC（timeline 回放）
609a4b3 fix(water): 蓄水率分母改用現行有效容量
```

外加 merge commit `f811ca7`（Merge feat/water-resources）。

## 等用戶執行

- [ ] 瀏覽器驗證 Phase 2.3（timeline 滑動時三層有沒有同步跟著動）
- [ ] 瀏覽器驗證 BL-5 柱體（zoom in 到 z10+ 還看得到）
- [ ] 決定要不要 `git push origin master`

## 下一步候選

見 [BACKLOG.md](BACKLOG.md)。優先：
- BL-1 堤防 `river_levees` 4,223 筆（P1，高 ROI 視覺）
- BL-2+BL-3 水資源管制區合併 toggle（P2）
- 水庫 3D 柱顯示「最新日期」標記（P2，上次討論到暫停）
- A-4 淹水潛勢多情境 slider（P2，在 backlog）

## 累計狀態快照

- 40 座水庫，37 有即時水情，蓄水率對齊水利署官網
- 1,304 座雨量站、332 座河川水位站、786 座地下水觀測井
- 水庫 context RPC：`get_reservoir_context(compare_id)` 一次給水庫+狀態+集水區+河網
- 3D 視覺：水位計（shell + water）+ 進/出流雙排日柱（active reservoir only）
- Timeline 三層同步回放（`timeStore.subscribeDate/Throttled`）

詳細資料盤點：[DATA_SCOPE.md](DATA_SCOPE.md)
