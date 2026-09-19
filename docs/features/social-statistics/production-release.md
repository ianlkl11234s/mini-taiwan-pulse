# Social Statistics 正式發布驗收 — 2026-09-15

## 結果與版本

教育 11 → 醫療長照 16 → 住宅 18，共 45 enabled recipes / 416 exact selectors 已在 [正式站](https://mini-taiwan-pulse.itsmigu.com/) 上線。28 延伸候選未啟用。

| Repo | PR | 一般 merge commit |
|---|---|---|
| taipei-gis-analytics | [#88](https://github.com/ianlkl11234s/taipei-gis-analytics/pull/88) | `6b19ae1cff9df406af19e8b4a117f3db72b1d386` |
| gis-platform | [#109](https://github.com/ianlkl11234s/gis-platform/pull/109) | `5bc5c074d04eb168f113a06e71fec13ee56cbd52` |
| gis-platform | [#110](https://github.com/ianlkl11234s/gis-platform/pull/110) | `92a388f9e17af129c2281bf9b7631573cae3acb4` |
| mini-taiwan-pulse | [#248](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/248) | `fa4b8afbf945244728ca7b1541968547c0b1c349` |

Zeabur deployment `6aa91783d3687c7a2564b14d` 狀態 RUNNING，commit 與上表前端一致；正式 browser 已載入新 main/LegendPanel bundle 並完成以下驗收。後續 closeout 文件提交不改 runtime。所有提交保留，未 squash/rebase。

## 資料與快取

- DB：414 releases / 13,716 values / 414 published events 讀回成功。
- R2：103 indicators / 890 releases / 3,590 selectors / 4 geometries。
- 舊 3,174 selectors 的 artifact references 不變；新增 416 artifacts 全數 R2 讀回及公開 HTTP SHA/bytes 通過。
- Manifest SHA：`d8aefb0375568a57126283e7fbd3901ee0c46cbb25c68af2c12647a14d35165a`；2,198,417 bytes。
- `current.json` 為 max-age=60；manifest/artifacts 為 max-age=31536000, immutable，公開 CORS 正常。manifest HIT；代表 artifact 首次 MISS、再次 HIT。
- runtime 沿用 Statistics R2 snapshot 與前端共用快取；Supabase 用於資料匯入與發布，不新增使用者讀取 RPC。
- 保留年份、單位、0/null/來源 -、PARTIAL/STALE、來源 SHA 與參考 geometry 定義。有資料縣市照常呈現。

414 筆匯入完成後，Supabase 全量 export 曾連線 timeout。本次使用已驗證交付增量與發布前全量 manifest 合併，逐項驗證舊 references 不變，再先發 immutable artifacts、manifest，最後更新 current。沒有宣稱全 DB re-export 成功；稍後 DB 連線恢復且數量讀回成功。Geometry 沿用已註冊、代碼集合與 SHA 驗證的正式 reference geometry，來源交付 geometry 記錄保留。

## 測試與真實 browser

| 類別 | 結果 |
|---|---|
| 前端整合 | 1,364 passed / 4 skipped；tsc、build 通過；GitHub CI 通過 |
| 上游 | 28 tests passed |
| 平台 | 22 tests passed / 1 opt-in skipped；護理 sidecar 實際資料另已驗證 |
| 正式完整 manifest 的實際前端 loader | 416 selectors 通過 SHA、bytes、geometry fixture 驗證 |
| 公開 HTTP | 新增 416 artifacts 全通過；0 失敗 |
| 正式桌面 | 45/45 逐層操作、載入、地圖 popup、legend 通過 |
| 正式手機 390×844 | 教育 110/111 學年度/學段、來源紀錄、透明度；長照總計 6,507 / 男 1,298；住宅中山區 17.26%、2020-11-08、STALE；scrollWidth=390 |
| 既有圖層 | 正式出生數仍可載入；本地 single/overlap、All Off、新舊層共存通過 |

公開驗收資料：[HTTP](./evidence/production/public-http.json)、[DB](./evidence/production/db-readback.json)、[部署](./evidence/production/deployment.json)、[45 層](./evidence/production/desktop-layers.json)、[舊資料保留](./evidence/production/preservation.json)。手機 DOM 證據同目錄，帳號名稱已遮罩。

本地正式站 PNG/DOM：`/private/tmp/social-production-browser-evidence`。完整 loader 結果：`/private/tmp/social-full-loader-selectors.json`。截圖僅留本地。正式頁驗收 URL 加 `?release=fa4b8af`，以避開既開頁面沿用舊 HTML；未修改全站 cache policy。

## 工作樹與限制

- Frontend：`/private/tmp/pulse-social-statistics-frontend-20260915`，`codex/social-statistics-frontend-20260915`。
- Analytics：`/private/tmp/analytics-social-release-20260915`，`codex/social-statistics-release-20260915`。
- Platform：`/private/tmp/platform-social-release-20260915`，`codex/social-statistics-release-20260915`。
- 原 checkout 與來源 worktree 的平行改動未覆蓋。
- 手機為真實 browser 的 viewport 模擬，未宣稱實體手機測試；既有 build 大 chunk 警告仍在。PARTIAL/STALE 為來源事實，非待修錯誤。
- 發布前 current/manifest 備份保存在 `/private/tmp/social-production-current-before.json` 與 `/private/tmp/social-production-manifest-before.json`，immutable 舊資產未刪除。
