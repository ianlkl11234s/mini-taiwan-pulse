# Status

**最後更新**：2026-04-24（session：BL-1 堤防 + BL-2+3 管制區 + W002 地下水井 + deploy 架構修正）
**分支**：`master`（本機領先 origin **25 commits**；gis-platform 領先 1 commit）

## 本次 session 完成

### 水資源三功能整合
- **BL-1 堤防**（`river_levees` 4,222 筆 MultiLineString）
  - overlayRegistry amber line（glow + core），status=待建用 case expression 淡化
  - export-water-static.sh 新增匯出區塊（排除已滅失）
- **BL-2+BL-3 水資源管制區**（合併單一 toggle，128 polygon）
  - 水源保護區 107 + 地下水管制區 21（control_1/2 + region 9）UNION 匯出，tag zone_kind
  - 四色 match expression：protection 綠 / control_2 紅（禁止超抽）/ control_1 橙 / region 灰
- **W002 地下水井**（migration 058 + 前端 739 站）
  - `get_groundwater_latest / day / timeseries` 三 RPC（JOIN water_monitoring_stations）
  - 過濾 WRA sentinel (-999998)
  - useGroundwaterLayer 走 timeStore + subscribeDate + subscribeThrottled(500ms)
  - GroundwaterPanel + picking + App.tsx 接線

### deploy 架構修正（重要）
先前所有 `water_*.geojson` 雖進 git bundle 但 nginx `location /geo/` 強制走 `/data/` volume →
本機 dev 看得見 / production 404（**既有 9 個水資源圖層 production 從未真正 work**）。

改用 **glob 動態 pattern**：
- `.gitignore`：`public/geo/water_*.geojson`
- `upload-deploy-assets.sh`：顯式 FILES 後加 glob loop
- `pull-deploy-assets.sh`：`aws s3 ls | grep` 動態列舉
- `git rm --cached` 9 個既有 water_*（本地檔保留）
- **11 個 water_*.geojson 全部已上 S3**（~140 MB，含 flood_extreme 80M）

未來新增水圖層標準流程（3 步，不用改腳本）：
1. `bash scripts/export/export-water-static.sh`
2. `bash scripts/deploy/upload-deploy-assets.sh`
3. Zeabur Terminal `sh /usr/local/bin/pull-deploy-assets.sh`

## 本次 session commits（4 個）

**mini-taiwan-pulse**（本次 3 個）
- `664de9e` memory: BACKLOG 標 BL-1 / BL-2+3 / W002 done
- `10bef5b` feat(water): 三功能整合 — 堤防 + 管制區 + 地下水井
- `c32d795` deploy: move water_*.geojson to S3 glob pattern

**gis-platform**（本次 1 個）
- `5c01731` feat(water): 058 地下水 RPC (W002)

## 本機未 push 累計

- **mini-tw**：25 commits（上 session 22 + 本次 3）
- **gis-platform**：1 commit（058）
- Supabase 已部署：migration 058 session 中手動跑過
- S3：11 個 water_*.geojson 已全部上 deploy-assets/

## 等用戶執行

- [ ] `git push origin master` × 2 repo（gis-platform 先 / mini-tw 後）
- [ ] Zeabur redeploy（Dockerfile COPY pull 腳本 build-time 固定 → 必須 rebuild 才生效）
- [ ] Zeabur Web Terminal 跑 `sh /usr/local/bin/pull-deploy-assets.sh` 把新 S3 檔案拉到 /data/geo/
- [ ] 生產環境驗證：既有水資源（Phase 1/2）+ 本次三功能都能顯示
- [ ] 瀏覽器本機 dev 驗證 BL-1 / BL-2+3 / W002 三 toggle 運作

## 下一步候選（[BACKLOG.md](BACKLOG.md)）

- **BL-4** 淹水潛勢多情境 slider（P2，17,303 polygon × 10 情境，UX 重）
- **W001** 警戒水位視覺化（P2，需先 seed `river_stations` 空表）
- **BL-6** 水庫 3D 柱「最新日期」標記（P3，暫停）
- W003 枯旱燈號 / W004 洩洪訊息 / W005 水權統計 / W006 集水區敏感區（皆 P3）
- G003 decide `public/three-showcase.*` untracked 去留（P3）

## 累計狀態快照

- 40 座水庫 / 37 有即時水情，蓄水率對齊水利署官網
- 1,304 雨量站 / 332 河川水位站 / **739 地下水井（新）**
- 堤防 4,222 筆 / 管制區 128 筆（新）
- Timeline 四層同步回放（rain / river / reservoir / groundwater）
- 3D 視覺：水位計 + 點選後雙排日柱
- 部署架構：water_* 統一走 S3 glob pattern
- **記憶系統**：v2 9 檔 + SessionStart auto-load + /wrap-up 精簡化

詳細：[DATA_SCOPE.md](DATA_SCOPE.md) / [BACKLOG.md](BACKLOG.md) / [REFLECTIONS.md](REFLECTIONS.md)
