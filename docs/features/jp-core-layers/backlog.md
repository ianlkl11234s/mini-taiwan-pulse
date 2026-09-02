# Backlog — jp-core-layers

## 遞延圖層（Batch 2 已落地，2026-09-02）

三層皆已接線，細節見 [changelog.md](./changelog.md) 的 Batch 2 段落。**落地方式與原規劃的差異**記在各項下方。

- [x] **jpRailways（鐵道 21,933 段）**：轉 PMTiles **4.86MB**（5,093,949 B，z4–12）後 git-track，未採「直接 git-track 14MB GeoJSON」那條退路。
      接進交通 theme 新增的**「線」群組**。原規劃寫「單色即可」，實際做成**事業者種別 5 色 + 圖例**（`jpRailwayTypes.ts`，與車站同名類別共用 hex）。（`72c626a`）
- [x] **jpSchools（學校 56,807 點）**：⚠️ **配方與上游 handoff §3.1 不同**——原配方 `-Z4 -z14` 保留全部 15 屬性會產出 **54MB**（超過 25MB 門檻、不能 git-track）；
      改用 `-Z4 -z11` ＋ 9 個 `-x` 精簡為 6 屬性，落到 **16.5MB**（17,303,011 B）仍 git-track（原規劃猜「<11MB」偏樂觀）。
      新增「教育」theme，13 類 `school_class` 分色 + 兩欄圖例。z4/z5/z6 各 56,807 unique id，低 zoom 未被抽稀。（`d662840`）
- [x] **jpPopulationMesh1km（人口網格 176,896 格）**：48.6MB（50,998,171 B，z4–11）**走 S3**——`.gitignore` 單一檔名 ＋ `upload-deploy-assets.sh`
      **新開**「世界 World」區塊（原本沒有 world 區塊，不是加進既有清單）；pull 端與 nginx `/world/` 早已存在故免改。
      新增「人口」theme，9 種指標／年份做成**扁平 select**（原規劃提的 timeline slider 未做，見下）。（`3f6609b` ＋ 修正 `7a7a878`）

## 🔴 擋合併 / 需拍板

- [ ] 🔴 **人口網格 pmtiles 上傳 S3（owner 執行）**——尚未上傳，上線後該層 tile 會 404：
      ```
      aws s3 cp public/world/jp_population_mesh_1km.pmtiles \
        s3://migu-gis-data-collector/deploy-assets/world/jp_population_mesh_1km.pmtiles \
        --region ap-southeast-2
      ```
      ⚠️ `deployContract` 對 `/world/` 的判準是「upload 清單**或** git-track 其一即可」（nginx 有 dist fallback），
      **不會**機械擋住這種漏上傳——`.gitignore:101` 記錄過 `power_poles.pmtiles` 正是兩條路都空的靜默退化。
- [ ] **Batch 2 開 PR**（`feat/jp-deferred-layers` → master），走 `gh pr create` 模板 + `gh pr merge --merge`（不 squash）。

## 上游（taipei-gis-analytics）待提交

本批**沒有**在上游 commit——主樹當時停在別人的分支 `codex/noise-layers-data-ready-20260828` 且有平行 session 的未提交改動。

- [ ] **兩支 `_manifest.json` 已就地改好但未提交**：`data/processed/world/jp_railways/_manifest.json`、`.../jp_schools/_manifest.json`
      （各追加 pmtiles 產物記錄，學校那筆含新配方與理由）。備援 patch：
      `/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/64624c64-4eb2-4549-a5c4-ae927aee4f6a/scratchpad/upstream-manifests.patch`
      ⚠️ scratchpad 是 session 專屬目錄，會被清掉——要用就趁早，或在上游主樹直接 `git add` 那兩檔。
- [ ] **上游 handoff §3.1 的學校配方需更正**：`docs/handoff/jp-core-layers.md:82` 的 `-Z4 -z14`（全屬性）會產出 54MB 過大檔。
      該檔**只存在於 `codex/noise-layers-data-ready-20260828` 分支、未進 `origin/master`** → 待那個分支併回時一併更正。
      （已確認 `docs/data-catalog/world/jp_schools.md` 沒有重抄這道配方，修一處即可。）
- [ ] 上游 handoff / catalog 反向引用本 feature folder（Batch 1 起就掛著，未做）。

## 增強（刻意從簡 / 未做）

- [ ] **人口網格 timeline slider**（deferred-handoff §2c step 5）：pop_2020..2070 是時序，目前用 select 逐一切換。
      若做需走 timeStore 訂閱、不可把時間放 deps（development-rules §8）。
- [ ] **鐵道無「大小」控件**：目前只有透明度滑桿，線寬固定 z6=1 → z14=3；密集區可考慮加線寬滑桿。
- [x] **鐵道 z4.7 渲染 17,069 條 vs 資料 21,933 段的差額**（2026-09-02 已查明，非資料遺失）：
      PMTiles metadata 的 `strategies` 陣列**各 zoom 皆為空**（tippecanoe 只要有 drop／coalesce 就會記錄），
      `tilestats.count` = 21,933 完整。差額來自 `queryRenderedFeatures` 只計目前視窗內的圖徵
      （z4.7 未涵蓋沖繩與九州南緣），加上低 zoom 相鄰線段被併成 MultiLineString。
- [ ] 車站按運量做 graduated 圓大小（目前運量走分級色，未動圓大小）
- [ ] 機場按 category（空港種別，拠点/地方管理…）分色 + 圖例
- [ ] auto-flyTo 座標目視微調（`JAPAN_CAMERA`）；含沖繩可改 `fitBounds([[127.6,26.2],[146.5,45.8]])`
- [ ] Locations 面板加「日本」跳點按鈕（目前 JAPAN_CAMERA 刻意不進 ALL_PRESETS）

## 已完成（Batch 1）

- [x] 車站雙上色模式：種類（operator_types 5 類，預設）／運量（5 級距）+ 切換 button row + 隨模式圖例
      + `jpStationTypes.ts` 色彩 SSOT（2026-09-01）
- [ ] 瀏覽器目視驗收：**Batch 2 三層**已於 2026-09-02 用 agent-browser（WebGL args，dev :3799）實測渲染／popup／圖例（見 changelog）；
      **Batch 1 七層本批未逐層複驗**（只確認日本面板五主題結構正確）→ 此項對 Batch 1 仍開著。
- [x] 分支改名 `feat/jp-core-layers`、開 PR：Batch 1 已 merge（PR #199 / `632a7d2`）。
