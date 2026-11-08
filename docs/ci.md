# CI 原則

> 範圍：`.github/workflows/ci.yml`（PR 與 push 到 develop／master 的檢查）。部署流程看 `deploy-workers.yml` 與 [`RELEASING.md`](./RELEASING.md)；各檢查的內容看 [`development-rules.md`](./development-rules.md) §6。
> 2026-11-08 建立。改 CI 前先讀本檔；改完把實測耗時補進 §6。

## 1. CI 是為了什麼

CI 只回答一個問題：**這次合併會不會讓 develop 壞掉**。由此推出：

1. **每項檢查都要能說出它擋的是哪一種真實錯誤**。說不出來的檢查，不加。
2. **等待時間是成本**。repo 是公開的，Actions 不收費，所以優化目標是牆鐘時間，不是分鐘數。
3. **CI 不能靜默變弱**。加速時不能讓原本會紅的檢查變成「略過也算過」。
4. **CI 是全套檢查的最後一道**。本機跑快速、和改動相關的檢查；完整套件以 CI 為準（見 §5）。

## 2. 結構

```
changes ──┬─ quick（lint → 樣式盤點 → coral → worker；sparse-checkout 跳過 public/）
          ├─ build（tsc -b ＋ vite build）
          └─ test（vitest，完整 checkout）
                └─ ci-ok（彙總；永遠會出現）
```

- **三個 job 平行跑**，牆鐘時間等於最慢的那一個。每個 job 自己付 checkout 與 `npm ci` 的成本，`npm ci` 有 setup-node 的 npm 快取，約 5 秒。
- **檢查的順序以 package.json 的 `check` 為準**：lint → inventory → coral → worker → build → test，快的放前面，本機可以早點失敗。ci.yml 由上而下出現的 `npm run check:*` 必須是同一順序，`src/test/ciCheckParity.test.ts` 會檢查。
- **`ci-ok`** 用 `if: always()` 接住所有 job，只要有任何一個不是 success 或 skipped 就紅。之後如果要設 required status check，只設這一個。
- **每個 job 都有 `timeout-minutes`**。沒設的話，卡住會跑滿 6 小時。

## 3. 什麼時候跳過

- **只有 PR 會跳過**：push 到 develop／master 一律完整跑。原因是兩個各自綠燈的 PR 交會後仍可能紅，例如 layer-golden 快照。
- PR 只動到 `.claude/**`（memory、pitfalls、skills、hooks）時，quick、build、test 三個 job 會顯示 skipped，`ci-ok` 仍是綠的。
- **跳過名單只放「確定沒有任何檢查會讀」的路徑**。`docs/` 與 `CHANGELOG.md` 不能加：`CHANGELOG.md` 會被 `src/data/changelog.ts` 打包進網站；`docsFreshness.test.ts`、`deployContract.test.ts`、樣式盤點、ESLint 規則都會讀 docs。要新增路徑前，先在 `src/`、`eslint-rules/`、`scripts/design/` 搜尋有沒有程式讀它。
- **不用 workflow 層級的 `paths-ignore`**：被過濾掉的 workflow 不會產生任何 check。這會讓 required check 一直停在 pending，也會讓「等 CI 出現再合併」的流程永遠等不到。改用 `dorny/paths-filter` 在 job 層判斷，job 用 `if:` 跳過時會顯示 skipped，check 照樣存在。
- **同一個 PR 連推多次時，舊的那輪會被取消**（`concurrency` 搭配 `cancel-in-progress`，只對 pull_request 生效）。

## 4. 加速手段與它們的代價

| 手段 | 狀態 | 代價／風險 |
|---|---|---|
| job 平行化 | 採用 | 多 2 台 runner；公開 repo 不收費 |
| vitest `pool: "threads"` | 採用 | 本機實測 161s→82s（maxWorkers=2）。threads 共用同一個 process，不能用 `process.chdir`。新增測試若改 `process.env`，要用 `vi.stubEnv` 並還原。若在 CI 出現 hang 或 segfault，改回預設 forks |
| quick job 跳過 `public/` | 採用 | 只用在不讀 public/ 的檢查（lint、盤點、coral、worker 已確認） |
| test／build 跳過 public 大檔 | **不採用** | 有 11 個契約測試會讀 public 大檔，例如 PMTiles sha256、staticDataContract；另外不少測試缺檔時會靜默略過，等於 CI 偷偷變弱 |
| vitest `--shard` 分片 | 暫不採用 | test 已經不是最慢的 job，再分片只會多付 checkout 成本。test 若再次成為瓶頸才加，做法照官方 blob reporter 加 `--merge-reports` |
| `isolate: false` | 不採用 | 測試檔之間會共用模組狀態，結果可能互相污染 |

**結構性的慢**：git 追蹤了約 1.75GB 的 `public/`（pmtiles 約 1.39GB），完整 checkout 每次要 40–60 秒。根本解法是把大檔移出 git，改用 LFS 或 R2，但這會牽動部署契約，另案處理。

## 5. 本機與 CI 的分工

- **目前規則仍是 commit／PR 前跑 `npm run check`**（CLAUDE.md §1）。等於本機和 CI 各跑一次全套，這是已知的重複。
- 待拍板的改法：本機只跑 `npx tsc -b`、`npm run lint`、`npx vitest related --run <改動檔>`，以及改到 manifest 時的 manifest 守門 hook；全套交給 CI。
  - 代價是 CI 紅燈要再推一輪，而 `vitest related` 只看得到靜態 import。
  - 出處：Vitest CLI 文件的 lint-staged 範例用 `vitest related --run`。「全套交給 CI」只是常見做法，**不是官方規範**。

## 6. 測試要測行為，不要掃原始碼

- **本專案的決定**（development-rules §6「自訂 ESLint 規則」）：「讀原始碼再用 regex 比對」的禁用型檢查，一律寫成 ESLint 規則，不再新增這類測試。這是專案自己的取捨，不是業界共識；可參考 Google Testing Blog 對 change-detector test 的批評。
- 2026-11-08 盤點到約 19 個測試檔還有讀 `src/` 原始碼的斷言，分類與後續處理記在 BACKLOG（CI-2）。其中讀 JSON、nginx.conf、tokens.css、產出物的屬於資料契約，不在此列。

## 7. 實測耗時

| 日期 | 版本 | PR 牆鐘 | 細項 |
|---|---|---|---|
| 2026-11-07 | 單一 job（舊） | 4–7 分 | checkout 40–63s、build 80s、vitest 135–156s、lint 15s、盤點 21s |
| 2026-11-08 | 三 job 平行＋threads | （PR 合併後補） | |

## 出處

- GitHub Actions：workflow 被 paths 跳過時 required check 會停在 pending — https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks
- concurrency 與 cancel-in-progress — https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
- job 層級路徑判斷 — https://github.com/dorny/paths-filter
- Vitest 效能（pool、isolate、shard）— https://vitest.dev/guide/improving-performance
- Vitest CLI（`related`、`--changed`）— https://vitest.dev/guide/cli.html
- setup-node 快取只存 npm cache，不存 node_modules — https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md
- 大 repo 的 checkout（第三方實測）— https://depot.dev/blog/why-organizations-have-slow-actions-checkout
- change-detector test — https://testing.googleblog.com/2015/01/testing-on-toilet-change-detector-tests.html
