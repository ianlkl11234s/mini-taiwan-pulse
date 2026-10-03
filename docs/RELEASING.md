# 版號與發布規則

> 分支規則見 [git-workflow.md](git-workflow.md)；各版內容見根目錄 [CHANGELOG.md](../CHANGELOG.md)。做法參照 `../plan-art/docs/RELEASING.md`。

## 版號（SemVer `MAJOR.MINOR.PATCH`）

| 位數 | 什麼時候加 | 例子 |
|---|---|---|
| MAJOR | 介面全面改版、資料架構或資料契約大改（舊用法不再適用） | 地圖與面板設計系統改版、Supabase 遷移 |
| MINOR | 新功能、新圖層或新資料批次上線，舊功能不受影響 | 新增一組圖層、新的分析工具 |
| PATCH | 只修正：bug、效能、文案、資料修補，不新增功能 | 修 popup 錯位、修 RPC 逾時 |

- 版號唯一來源是 `package.json`（`package-lock.json` 同步）。build 時由 `vite.config.ts` 的 `define.__APP_VERSION__` 注入，網站「資訊 → 關於」顯示目前版號
- tag 為 `vX.Y.Z`，一律 annotated，打在 `master` 的發布 commit 上
- 同一天可以發多版；判斷不了 MINOR 或 PATCH 時，看使用者能不能感覺到「多了一個東西」

## 日常：寫進 Unreleased

每個 user-facing 的 PR 在 `CHANGELOG.md` 的 `## [Unreleased]` 下加一行，分類沿用：

- **新增**：使用者看得到的新功能、新圖層
- **修正**：bug 修正
- **效能**：載入、渲染、DB 效能
- **資料**：資料源、pipeline、資料批次、契約
- **注意事項**：行為改變、需要人工操作、已知限制

條目寫白話、結尾附 PR 編號，例如 `- 監看模式機場卡圖表軸域修正（#512）`。

## 發布步驟

1. `develop` 驗收：CI 綠（`tsc -b`、vite build、vitest 含 `layerConsistency` 與 design-system guard）；有畫面改動另做瀏覽器驗收
2. 決定版號（看 Unreleased 裡最大的那一類：有破壞性改版→MAJOR，有新增→MINOR，只有修正→PATCH）
3. 在 `develop` 做發布 commit：
   ```bash
   npm version X.Y.Z --no-git-tag-version   # 同步改 package.json 與 package-lock.json
   ```
   把 `CHANGELOG.md` 的 Unreleased 內容搬成 `## vX.Y.Z — YYYY-MM-DD — <標題>`，並在版本總覽表最上方加一列；commit message：`chore(release): vX.Y.Z`
4. 把 `develop` 合進 `master`（PR：`gh pr create --base master --head develop --title "release: vX.Y.Z"`，`gh pr merge --merge`）← **會觸發正式站部署，須使用者拍板**
5. 在 master 的 merge commit 打 tag 並推送（逐一列名，不用 `--tags`）：
   ```bash
   git switch master && git pull
   git tag -a vX.Y.Z -m "vX.Y.Z — <標題>" -m "<重點 3–5 行>"
   git push origin vX.Y.Z
   ```
6. 建 GitHub Release：`gh release create vX.Y.Z --title "vX.Y.Z — <標題>" --notes-file <該版段落>`
7. 確認 Zeabur 部署完成、正式站「關於」顯示新版號（部署檢查見 `.claude/memory/PLAYBOOKS.md` PB-06）
8. `develop` 若在發布後又進了新 PR，不用處理；若 master 有 develop 沒有的 commit（hotfix），把 `master` 合回 `develop`

## Hotfix

1. `git switch master && git pull && git switch -c hotfix/<slug>`
2. 修正 + `npm version patch --no-git-tag-version` + CHANGELOG 加該 PATCH 段落，PR 到 `master`
3. merge 後依上方步驟 5–7 打 tag、建 Release
4. 把 `master` 合回 `develop`（`gh pr create --base develop --head master`），避免下一次發布把修正蓋掉

## 歷史版號

`v0.1.0`–`v3.0.0` 是 2026-10-04 依 commit 與 PR 歷史回溯補打的 tag，打在當時 `master` 的 merge commit 上；切點依據記在 CHANGELOG 開頭。之前的非 SemVer tag（`v0-original-sidebar`、`v0.9-pre-api`、`backup/pre-launch-*-20260529-*`、`backup/pre-merge-master-localhead`）保留不動。
