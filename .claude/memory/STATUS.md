# Status

**最後更新**：2026-04-25（session：bug fix + groundwater 拆層 + 20K cap 踩兩次修兩次 + toggle 8 滑桿）
**分支**：`master`（本機領先 origin **98 commits**；gis-platform 領先 **4 commits**）

## 本次 session 完成

### Bug fix（早段）
- **底圖切換 throw `Style is not done loading`**
  - App.tsx 6 處 guard 裸呼 `map.getStyle()`，setStyle mid-swap 會 throw
  - 加 `styleReady(map): map is MapboxMap` type predicate，try/catch 包住
- **H3 `res9` / `res8` fallback**
  - 本地 `public/h3/` res8 被 gitignore 且未 copy → 前端空白
  - 四支 h3 loader 加「目標 res → res7 逐級 fallback」
  - `getH3Resolution` cap 改 res8（res9 從沒預聚合）

### Groundwater 拆層（中段）
- **Migration 060**：降頻 `get_groundwater_day` 每站每小時（78K → 16.5K，避 20K cap）；
  `get_groundwater_latest` 加 `delta_24h` 欄位
- **前端拆兩 toggle**：
  - 水井點位 Wells（靜態 backdrop，~733 灰點，always on）
  - 地下水井 Groundwater（動態 glow，delta_since_day_start 著色）
- Color 跨站可比（±2cm 灰 / ±10cm 淡 / ±30cm 強），radius 綁 |delta|

### PostgREST 20K cap 再犯（尾段）
- **河川水位中南部「沒有資料」**：`get_river_water_level_day` 44K rows 被切
  - ORDER BY station_id 讓北部通吃 20K 名額，南部 103 → 1 站
- **Migration 060b**：river 也降頻到每站每小時（~8K rows）
  - 驗證：北 128 / 中 116 / 南 103 / 最南 3，全部回來
- **useRiverLevelLayer 改 delta 著色**（跟 groundwater 同 pattern，解「timeline 拖不動」）

### 8 個 toggle 滑桿
- 4 水層（rain/river/groundwater/wells）全改 expandable
- 每層 scale + opacity 滑桿，用 `setPaintProperty` 熱更不重建 layer
- `ExpandableLayerKey` 補 `riverLevel`；useTransportParams + 4 getControls case

## 本次 session commits

**mini-taiwan-pulse**（11 個 = 3 feat/fix + 8 memory）
- `d0f84c2` memory: append REFLECTIONS
- `b30839d` memory: BACKLOG +6 已完成
- `c52c20b` memory: update DATA_SCOPE (060/060b)
- `ff0dad8` memory: GLOSSARY +3 條
- `1cfda63` memory: append PLAYBOOKS PB-08
- `7109c2b` memory: PRINCIPLES +2 條
- `985764a` memory: append INCIDENTS +2 條
- `a15c1b1` feat(water): 4 水層 toggle 滑桿 + river delta 著色
- `5893b16` feat(groundwater): 拆靜態點位 + 動態 delta 著色
- `fe9e266` fix: 底圖切換 throw + H3 res9/res8 fallback
- （本檔 rewrite 之後再 +1）

**gis-platform**（2 個）
- `dea1116` feat(water): 060b 河川水位 RPC downsample
- `5bd0a92` feat(water): 060 地下水 RPC downsample + delta_24h

## 本機未 push 累計

- **mini-tw**：98 commits
- **gis-platform**：4 commits
- Supabase 已部署：migration 060 + 060b 都手動跑過

## 等用戶執行

- [ ] `git push origin master`（mini-tw 98 commits）
- [ ] `git push origin main`（gis-platform 4 commits）
- [ ] 瀏覽器驗證：reload → 4 水層 toggle 展開看滑桿動作 / river level 中南部可見 / 拖 timeline 顏色變動
- [ ] Zeabur redeploy + `pull-deploy-assets.sh`（如上 session 已待執行）

## 新增規則（PRINCIPLES.md）

- **Supabase PostgREST 20K cap 必查**（⚠ P0，2026-04-25）
  - 新 RPC 預估 rows > 15K 一律套 `DISTINCT ON (station_id, date_trunc('hour', ...))` 降頻
  - 診斷 SOP：psql COUNT → curl content-range → 若 cap 則降頻（PB-08）
- **跨站可比視覺指標**（2026-04-25）
  - 監測站 radius/color 一律 delta_since_day_start，不用絕對值

## 下一步候選（[BACKLOG.md](BACKLOG.md)）

- **BL-4** 淹水潛勢多情境 slider（P2，17,303 polygon × 10 情境）
- **W001** 警戒水位視覺化（P2，需先 seed `river_stations` 空表）
- **BL-6** 水庫 3D 柱「最新日期」標記（P3，暫停）
- W003 枯旱燈號 / W004 洩洪訊息 / W005 水權統計 / W006 集水區敏感區
- G003 decide `public/three-showcase.*` untracked 去留（P3）
- **潛在**：其他現有時序 RPC 檢查是否也踩到 20K cap（rain_gauge / reservoir_status_day）

## 累計狀態快照

- 40 座水庫 / 1,304 雨量站 / 332 河川水位站 / 733 地下水井
- Timeline 四層同步回放（rain / river / reservoir / groundwater）
- 監測站視覺 pattern：**delta_since_day_start 著色**（跨站可比，timeline 撥放顏色會動）
- Toggle 自訂：4 水層 × 2 滑桿（scale / opacity）熱更
- 堤防 4,222 / 管制區 128 / 水井點位 733
- 3D 視覺：水位計 + 點選後雙排日柱
- **PostgREST 20K cap 已修 2 支 RPC**（060 groundwater + 060b river）
- **記憶系統**：v2 9 檔 + SessionStart auto-load + /wrap-up 精簡化

詳細：[DATA_SCOPE.md](DATA_SCOPE.md) / [BACKLOG.md](BACKLOG.md) / [REFLECTIONS.md](REFLECTIONS.md)
