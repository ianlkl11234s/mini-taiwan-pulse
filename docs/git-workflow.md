# Git Workflow（develop → master 雙主幹）

> mini-taiwan-pulse 的分支、PR 與 hotfix 規則完整版，從 `CLAUDE.md` 拆出。版號與發布步驟見 [RELEASING.md](RELEASING.md)，各版內容見根目錄 [CHANGELOG.md](../CHANGELOG.md)。
>
> 2026-10-04 起由 GitHub Flow（feat → master）改為 develop／master 雙主幹，做法參照 `../plan-art/docs/RELEASING.md`。

## 分支

| 分支 | 用途 | 收什麼 |
|---|---|---|
| `master` | 正式站（Zeabur 自動部署）。每個 commit 都應對應一個已發布版本或 hotfix | 只收 `develop` 的發布合併與 `hotfix/*` |
| `develop` | 日常整合與驗收（staging）。所有功能 PR 的 base | `feat/*`、`fix/*`、`perf/*`、`docs/*`、`chore/*`、`memory/*` |
| `feat/<slug>` 等工作分支 | 從 `develop` 開，完成後 PR 回 `develop` | — |
| `hotfix/<slug>` | 線上緊急修正。從 `master` 開，修完合回 `master`，再合回 `develop` | — |

GitHub 預設分支是 `develop`（2026-10-04 起），`gh pr create` 預設就以 develop 為 base；指定 `--base develop` 也無妨：

```bash
git switch develop && git pull
git switch -c feat/<slug>
# ...開發、commit...
gh pr create --base develop
gh pr merge <PR> --merge
```

## Branch 命名

| Prefix | 用途 | 何時用 |
|---|---|---|
| `feat/<slug>` | 新功能 / 新 layer | 加東西 |
| `fix/<slug>` | Bug 修 | 修東西 |
| `perf/<slug>` | 效能 | 只改效能不改行為 |
| `docs/<slug>` | 文件 | 純文件 |
| `chore/<slug>` | 建置 / 依賴 / 雜項 | 沒有 user-facing 變更 |
| `memory/<slug>` | `.claude/memory` 更新 | session 收尾 |
| `hotfix/<slug>` | 線上緊急 | 正式站壞了、使用者有感 |
| `release/vX.Y.Z`（可選） | 發布前凍結 | develop 還在收 PR、又要先出一版時 |

`<slug>` 用 kebab-case，對應 `docs/features/<slug>/` 資料夾名。

## 合併方式

保留完整 commit 歷史：一律一般 merge commit（`gh pr merge <PR> --merge`），禁止 squash merge 與 rebase merge（使用者 2026-09-15 指示）。未經明確要求，不壓縮、合併或改寫既有 commit。合併不等於部署授權：`develop → master` 會觸發正式站部署，須使用者拍板。

## PR 流程

1. 從最新 `develop` 開工作分支
2. 新功能同時 `cp -r docs/features/_TEMPLATE docs/features/<slug>` 建功能檔案
3. 若動到跨 repo 資料契約 → **先開 upstream handoff**：`taipei-gis-analytics/docs/handoff/<slug>.md`
4. 完成 → `npx tsc -b` + `npm test` 全綠
5. **在 `CHANGELOG.md` 的 `## [Unreleased]` 加一行**（分類：新增／修正／效能／資料／注意事項；純文件、memory 可省略）
6. `gh pr create --base develop`，描述用 `.github/pull_request_template.md`
7. CI（`.github/workflows/ci.yml`，PR 到 `develop`／`master` 都會跑）綠了 → `gh pr merge <PR> --merge`
8. 更新 `docs/features/<slug>/changelog.md` 記錄 PR # + merge commit hash

## 何時開 hotfix

- **hotfix**：線上炸了、使用者有感（例如 Supabase 打掛、layer 全消失）→ 從 `master` 開 `hotfix/<slug>` → PR 到 `master` → 發 PATCH 版（見 RELEASING.md §Hotfix）→ 把 `master` 合回 `develop`
- **其他**一律走 `develop`

## 跨 repo 同步順序（有資料契約變動時）

上游先動、下游後動：taipei-gis-analytics → gis-platform → data-collectors → mini-taiwan-pulse（前端 PR 進 `develop`）。前端要等上游部署完成才發布到 `master`，否則上線時前端硬依賴的欄位不存在。
