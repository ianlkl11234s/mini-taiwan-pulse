# public/ 資料檔移出 git（CI-4）

> 決定：2026-11-08 使用者拍板「直接根本治」，git 只放程式碼與網站素材，所有資料檔（geojson、pmtiles、資料用 json／png）不論大小一律移到 S3 正本 → R2 供應（ADR-0026）。
> 逐檔清單與進度：[`inventory.tsv`](./inventory.tsv)（每檔一列：批次、處理方式、狀態；做完一批就把該批 status 改成「完成 YYYY-MM-DD」）。
> 第一步（#909，v2.28.0 上線）：上傳缺的大檔、Worker 對相關目錄改先讀 R2、建立 `deploy/public-assets.lock.json`。

## 為什麼

- CI 每個 job 約 65 秒花在 checkout 1.7GB 的 public/；移出後預計每個 job 剩 10 秒內，PR 牆鐘從約 3 分降到約 2 分。
- 資料檔已有正本在 S3、正式站從 R2 讀；git 裡那份是多餘的第三份，還會和 S3 版本不一致。

## 現況（2026-11-08，origin/develop 追蹤 public/ 611 檔、1.75GB）

| 批次 | 內容 | 檔數 | 大小 | 處理 |
|---|---|---:|---:|---|
| B1 | 大於 1MB、已在 S3、Worker 已讀 R2 | 237 | 1,427MB | 移出 |
| B2 | 大於 1MB 的特例 | 18 | 212MB | 見下方 B2 表 |
| B3a | 小於 1MB，目錄已走「先 R2 再 dist」 | 268 | 約 78MB | 上傳後移出 |
| B3b | 小於 1MB，目錄已是「只讀 R2」（git 那份正式站根本沒用到） | 9 | 1.6MB | 上傳後移出 |
| B3c | 小於 1MB，目錄還沒有 R2 路由（climate、statistics-accessibility、根目錄 station_pillars.json） | 11 | 約 5MB | 先改路由，再上傳、移出 |
| keep | 網站素材：blog 圖片與影片、screenshots、showcase 程式、robots／sitemap／llms.txt、展示頁 html | 68 | 24MB | 留 git |

B2 細項：

| 檔 | 處理 |
|---|---|
| 前端已無引用的舊版 10 檔（coverage 1、forestry 3、geo 4、world 2） | 從 git 刪除；S3 已有一份，不另外上傳 |
| ookla_fixed_global、ookla_mobile_global、waste_stops_static（只有測試在讀；lock delivery=s3） | 移出；改成同步到 R2（或改小樣本），資產測試才拿得到；拿不到時測試明確印出略過 |
| hiking_trails.geojson（研究 sidecar） | 上傳 S3 後移出 |
| base_map/hillshade.png | Worker 的 .png 規則加例外改讀 R2，再移出 |
| world/jp_water 兩檔（路徑由 release.json 組出） | 同步規則把 jp_water 整個資料夾帶上，再移出 |
| forestry/forest_reserve.pmtiles | 正式站走 `releases/<sha>/` 路徑，確認對齊後移出 |

## 每一批的固定步驟

1. **上傳**：`scripts/deploy/upload-deploy-assets.sh` 依清單上傳 S3 `deploy-assets/`，只新增不覆寫；S3 已有同名但內容不同的檔，停下來問（不覆寫）。
2. **更新 lock**：lock 已收錄所有資料檔（B0）；新資產用 `python3 scripts/deploy/build-public-assets-lock.py add <路徑>`。
3. **等同步**：發版到 master 時 deploy-workers 會把 S3 同步到 R2（或等每天 03:40 的排程）。
4. **核對 R2**（移出前的關卡）：`npm run check:assets -- --verify-only --paths <該批清單>`，從 R2 整檔下載、比對 bytes 與 sha256，必須全數 SAME 才進下一步。
5. **移出**：`git rm --cached` 該批、加進 `.gitignore`，並從 `deploy/public-git-baseline.txt` 刪掉該批。測試不用改（B0 已分流，見下節）。
6. **CI 綠＋本機驗**：dev server 缺檔時會從 R2 取（`serveLockedPublicAssetsFromR2`），每批開 2–3 個圖層目視。
7. **上線後核對**：正式站每個目錄抽樣，回 200（pmtiles 回 206）且標頭 `X-Pulse-Src: r2`；`inventory.tsv` 該批改「完成」。
8. **防回流**：deployContract 的 ratchet 只允許 `deploy/public-git-baseline.txt` 裡的資料檔留在 git，新資料檔一律擋下；基準只減不增，全部移完時應為空。

## 測試怎麼分（B0，三桶）

| 桶 | 測試在做什麼 | 做法 |
|---|---|---|
| A | 只檢查存在、大小、sha256，或 manifest source 對得上檔 | 改查 lock，不讀檔（`src/test/publicAssets.ts` 的 `lockedAsset`）。deployContract 的 lock 段、forest_reserve 收據比對都改成這樣 |
| B | 驗資料內容（解析 GeoJSON、欄位、筆數、分類覆蓋、PMTiles metadata），或以釘死 sha256 的真實資產測 adapter | 列在 `vitest.shared.ts` 的 `ASSET_TESTS`（41 支），主套件排除；`npm run check:assets` 先依 `deploy/asset-test-files.txt`（227 檔、約 457MB）從 R2 下載、比對 sha256，再跑這 41 支。CI 的 assets job 每個程式 PR 都跑，下載用 actions/cache 保留 |
| C | 只需要一份輸入來測程式邏輯 | 用 repo 內小樣本。研究 dataset 測試都釘死真實資產的 sha256 與筆數，換小樣本就不再驗那份資產，所以這次都歸 B |

- 靜默略過改成明確失敗：資產測試的 `existsSync` 守門改用 `assetAvailable()`。lock 的 r2 檔沒有實體檔會直接失敗；不在 R2 的（s3、pending 等）印出「略過」。
- CI 的 test job 用 sparse-checkout 只取網站素材，證明主套件不需要 public/ 資料檔。
- 2026-11-08 B0 驗收：刪掉所有 lock 資料檔後，主套件結果與有檔時相同（5,560 通過、198 略過）；資產測試從 R2 下載 111 檔後 41 支全過。R2 整檔核對：B1 的 237 檔全部一致。

## 順序

| 步 | PR | 內容 | 前置條件 |
|---|---|---|---|
| 0 | PR-B0 | lock v2（收所有資料檔）、測試三桶分流＋`check:assets`、防回流 ratchet、test job 不取 public/ 資料 | 無 |
| 1 | PR-B1 | B1 237 檔移出 | v2.28.0 同步完成、R2 237/237 一致 |
| 2 | PR-B2 | B2：刪 10 檔、Worker 與同步規則改 4 檔、測試改下載 3 檔、hiking 上傳 | B2 檔案上傳並同步 |
| 3 | PR-B3 | B3a＋B3b 277 檔上傳後移出 | 上傳＋同步＋核對 |
| 4 | PR-B4 | B3c：climate、statistics-accessibility、根目錄檔加路由後移出 | 路由上線（要發一次版）、同步、核對 |

每一步做完都要發版，下一步才能開始，因為 R2 同步是跟著 master 部署跑的。

## 對其他工作的影響

- PR 合併後，其他 worktree `git pull` 會把這些檔從工作區刪掉；本機要用時，dev server 會自動從 R2 取。要實體檔案時用 `git restore --source=<移出前的 SHA> --worktree -- <清單>`（每個 PR 描述會附 SHA 與清單）。
- 之後新增圖層資料：直接上傳 S3 `deploy-assets/` 並更新 lock，不再 commit 到 public/（layer-onboarding skill 與 development-rules 一起改）。
- git 歷史不改寫（pack 1.92GB 照舊）；CI 用 fetch-depth 1，不受影響。

## 回滾

移出的檔都還在 git 歷史；正式站讀 R2，不讀 git。若 R2 少檔導致 404：從移出前的 SHA 取回檔案，上傳 S3、觸發同步即可，不需要還原 git。
