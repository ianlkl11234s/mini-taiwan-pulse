# Git Workflow（GitHub Flow）

> 本檔是 mini-taiwan-pulse 的 Git 工作流完整版（branch 命名 / PR 流程 / hotfix 判準），從 `CLAUDE.md` 拆出。CLAUDE.md 只留指標與「跨 repo 同步順序」。

單人開發，採 GitHub Flow：`master` = 生產、`feat/*` 分支 → PR → 一般 merge commit 進 master，保留分支每一筆 commit。

自 2026-09-15 起，依使用者指示取代原 squash 慣例：禁止 squash merge 與 rebase merge；未經明確要求，不壓縮、合併或改寫既有 commit。GitHub 使用 **Create a merge commit**；CLI 使用 `gh pr merge <PR> --merge`。此規則不等於自動授權部署，合併仍須符合當次授權與驗收。

## Branch 命名

| Prefix | 用途 | 何時用 |
|---|---|---|
| `feat/<slug>` | 新功能 / 新 layer | 加東西 |
| `fix/<slug>` | Bug 修 | 修東西 |
| `perf/<slug>` | 效能 | 只改效能不改行為 |
| `docs/<slug>` | 文件 | 純文件 |
| `chore/<slug>` | 建置 / 依賴 / 雜項 | 沒有 user-facing 變更 |
| `hotfix/<slug>` | 線上緊急 | 上線後立即修 |

`<slug>` 用 kebab-case，對應 `docs/features/<slug>/` 資料夾名。

## PR 流程

1. 開 feat branch：`git checkout -b feat/<slug>`
2. 開跑同時 `cp -r docs/features/_TEMPLATE docs/features/<slug>` 建功能檔案
3. 若動到跨 repo 資料契約 → **先開 upstream handoff**：`taipei-gis-analytics/docs/handoff/<slug>.md`
4. 完成 → `npx tsc -b` + `npm test` 全綠
5. `gh pr create` — PR 描述用 `.github/pull_request_template.md`（自動帶入）
6. 使用一般 merge commit 進 master，保留所有 commit（`gh pr merge <PR> --merge`）
7. 更新 `docs/features/<slug>/changelog.md` 記錄 PR # + merge commit hash

## 何時開 hotfix、何時走正常 feature flow

- **hotfix**：線上炸了、用戶感知（例如 Supabase 打掛、layer 全消失） → `hotfix/<slug>` → 快速 PR + 一般 merge commit（保留各筆 commit）
- **正常**：其他一律走 `feat/fix/perf/docs`
