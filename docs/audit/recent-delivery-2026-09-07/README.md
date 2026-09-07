# 近期成果、資料封存與工作線對帳

> 主線整合入口：[PR #225](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/225)。下方「未合併／未部署」為各批驗收當時的紀錄；當前合併、CI 與發布狀態以 PR 及其 checks 為準。S3 封存尚未上傳。

2026-09-07。本文件是此次統計、日本、會員與近期工作線的對帳入口，連回各 feature handoff，不取代上游資料契約。修改在 `codex/infrastructure-foundation-20260907`；主工作區 51 筆未提交狀態保持原樣。長跑與故障演練依使用者要求延後。

## 結論

主要近期功能已合併，不能因舊 worktree 仍在就判定未交付。資料目前分別由 Git/dist、Supabase、S3 供應；「網站可用」不代表「所有原始資料都有 S3 副本」。本輪修正過期文件、統計邊界重複處理與前端 gate 缺漏判定；尚未合併本次基礎分支、上傳封存或清除舊工作線。

## 功能交付對照

| 範圍 | 已確認成果 | 交付證據與限制 |
|---|---|---|
| 日本 | 日本分頁、行政區／交通／治安／教育／人口／宗教；宗教低 zoom 全量、警察全密度與精度分級 | PR #210 `0d8033c9`、#211 `9884a2ef`、#224 `9cf23f9a` 已合併。警察 13,196 名冊／13,195 points／22 degraded／1 無 geometry；不把名冊數當畫面點數。見 [核心](../../features/jp-core-layers/README.md)、[警察](../../features/jp-police-facilities/handoff.md)。本次未重跑全部日本正式畫面。 |
| 統計基礎 | 共用 recipe、版本選取、分層填色、來源與 coverage、手機控制 | PR #219 `482b45a2`、#221 `6f8b1bb3`、#223 `97cd878a` 已合併。本次匿名 catalog 42 indicators、HTTP200/OK。 |
| 交通統計 | 34 個交通指標；自行車、客運、事故、機場、補助等 | analytics commit `27645e0` 的 production closeout 記錄 11 datasets、426 public releases 及桌機／手機正式驗收；這是已保存歷史證據，本次只重讀 catalog，沒有重驗所有 values。見 [統計 handoff](../../features/taiwan-statistics/handoff.md)。 |
| 會員／搜尋 | 訪客收藏、登入收藏、私人場景／地點、共用搜尋與帳號隔離 | PR #220 `9124d1f0` 已合併，408 migration 歷史 readback 已保存。本次三張私有表匿名 limit=0 均401/42501；真 OAuth／跨裝置仍未驗收。見 [會員](../../features/member-area/handoff.md)。 |
| Embed／交通顯示 | 農業 embed、camera bridge、交通點位顯示 | PR #216、#217 合併；相關工作線 HEAD 已是 local master ancestor，不能再重複搬碼。 |
| 海洋／噪音 | 海洋觀測兩層、噪音／聲響六層 | PR #212、#213 已合併。此輪僅成果對帳，未重測全部資料活性。 |
| Network Structures | 橋梁官方／OSM／比對多層 | PR #222 已合併；發布後驗收另留在 `20b11d8`，尚未併入 master。固定證據：[production readback](https://github.com/ianlkl11234s/mini-taiwan-pulse/blob/20b11d8f2e5b72e6abf76dd14c2ed3b03619f535/docs/audit/network-structures-release-20260906/production-readback.json)。 |
| Global Events | 固定地理錨點、popup、Intel 分頁與刷新修正 | PR #207–209、#214–215 已合併；部分發布後 docs 仍在獨立分支，見 worktrees.json，不重做已交付功能。 |
| 本次基礎整理 | Monitor、listeners、H3、HUD、GFW、房地產 lifecycle | 已有原子 commits／測試，尚在獨立分支，未部署。見前述 infrastructure audit 目錄。 |

GitHub merged PR 現場讀回見 merged-prs.json；本地 master 基準 `9cf23f9a`。歷史 deployment 證據與本次 runtime 讀回分列，沒有將 merge 自動等同部署。

## 儲存與 S3

- 本次 `deploy-assets/world/` 完整列出兩個物件：人口網格 50,998,171 bytes、trash_debris 3,975,283 bytes。人口網格 LastModified 2026-09-02，舊 README/backlog「未上傳」已修正。
- 已查 `deploy-assets/statistics/`、`statistics/`、`backups/` 均為空，這僅限所查 prefixes，**不證明整個帳號或其他 bucket 都沒有備份**。
- 日本其餘多數 PMTiles／GeoJSON 使用 Git/dist。統計數值透過 Supabase RPC；geometry manifest 指向固定 commit URL 並驗 SHA-256。這條來源鏈可用，但尚沒有完整 S3 archive 的驗收紀錄。
- 現有 bucket policy 只列公開讀取 `flight-arc/*`；未查到 bucket versioning 啟用。沒有改 policy、versioning、既有物件或供應 URL。
- 不能把所有 Git 小檔直接同步到 deploy-assets：nginx 部分路徑優先 `/data`，部署後遺留的 S3/volume 舊副本可能遮蔽 Git 新檔。備份應放獨立 `archives/` namespace，以 SHA-256 content key 不覆寫；不接 nginx，也不公開私人來源。

### 已準備的封存範圍

[archive-plan.json](archive-plan.json) 共731檔、4,419,917,022 bytes（約4.42GB），包含日本 frontend/raw/processed、統計 manifests/releases/raw 與行政邊界。清單 SHA-256：`e0ab1ca85c2d9f1869c047ace912d2f988adb8cb213b9f6dab5e8573fcfea4f4`。

410 個統計 manifest 宣告的檔案已逐一核對 hash／size，零不一致，見 archive-validation.json。每筆含 project、來源路徑、角色、size、SHA-256 與 proposed key；`prepare-archive.py` 可在目前本地路徑重建。原始路徑依實際 adapter 對齊（台中噪音 raw/processed 名稱不同），本清單 unresolved_paths 為空。這不是整個 Supabase dump，也未包含會員私人 rows；檔案存在不等於已查驗所有來源授權或每份 raw 足以重建所有歷史版。

**狀態 PLAN_ONLY_NOT_UPLOADED**。實際上傳前需核定 destination（建議沿用現有 bucket 的私有 archives prefix，不改公開政策），對照此清單，逐物件核對 hash/size；既有同 key 不同內容要停止。完成 readback 後才可標已備份，不能因此刪本地來源。不可變 key 與 bucket versioning 是不同保障，清單不宣稱具備刪除恢復能力。

## 工作線如何收尾

本次 pulse repo 計21個 worktrees，12個 HEAD 已納入 local master ancestry，3個有 dirty 工作（主工作區、農業 embed 資產、早期統計入口）。完整路徑／HEAD／ahead-behind／dirty 與 patch-equivalence 見 worktrees.json。

- 12個 ancestor worktrees 是候選收尾；其中 agriculture 還有未追蹤資產，不能直接移除。
- 固定錨點、Global Events popup/Intel 舊 branches 有 squash/cherry 等價情況；只看 ancestor=false 會誤判未合併。對帳已記 patch equivalence，含獨有 docs 的分支繼續保留。
- `network-structures-rebuild` 的唯一額外 commit 是發布後驗收 docs `20b11d8`；已在此提供固定入口，不要再搬入一整份 feature。
- 主工作區包含日本警察、Embed 及規則文件的混合改動；有些對應已合併功能，但未逐 hunk 判定內容相等，不能整批 commit 或 reset。
- 早期統計工作樹另有4筆未提交狀態；仍保留，不能以「新版已上線」推論每個未提交 hunk 都可刪。

本次只收整證據、文件入口與確定 bug；沒有刪 worktree／branch、stash、reset 或代替其他工作線 commit。先整合本批程式並對主線驗收，再按清单處理完成的工作線。

## 本次根本修正與驗證

1. 統計共用已驗 SHA 的 immutable raw geometry：key 包含 URL/hash/boundary version/level/code scheme，有界8 entries，>8MiB 不長期保留。inflight 共用，單一 caller abort 不取消其他人的下載；不同指標仍獨立 join values，missing/zero/coverage 不變。
2. gate metadata 成功但缺少已知敏感 key 時仍需 owner；disabled full／未知 tier／非法 lock metadata 保守處理。35 靜態 key 與此前34 DB細項差異不再導致 UI 解鎖；不改 DB、不放寬任何帳號權限。
3. 修正日本舊待上傳／待PR、宗教 Host／tab 路由，補統計新增來源及封存步驟、會員合併與匿名 readback 的證據邊界。

`npx tsc -b`、150 test files／1300 passed／3 skipped、`npm run build`、diff-check 通過。包含跨指標 geometry 共用、hash/version 隔離、壞 hash 重試、caller abort 隔離、pending/LRU 上限、oversized geometry 與 gate cases。建置仍有既有大型 chunk 警告。此輪未重跑全部圖層 browser；沒有以測試數推論FPS或10–20人容量。

## 下一個日本／統計題目

可立即開始來源探索，不需先刪完工作樹。從現行 handoff 的契約進入；按 analytics → platform → frontend 順序，沿用既有 recipe、來源欄位、geometry manifest 與 renderer。每題區分來源探索、本地驗證、S3封存、正式匯入與網站驗收；不要開新一套面板、API或版本表來做相同事情。只有新語意真的無法由現有契約表達時，才設計擴充。

## 本批程式提交

- `fa4e270`：統計 immutable geometry 共用與有界快取。
- `72c7384`：gate metadata 缺漏／非法時保留 owner 邊界。

兩筆可獨立審查；已授權本地修正與 commits 完成，未合併或部署。
