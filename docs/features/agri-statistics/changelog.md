# Changelog — agri-statistics

## 2026-09-08 — 正式發布與加速

- 使用者後續授權正式發布，50 releases 與 1,001,230 observations 已公開，24 層正式桌面驗收通過；3 層保持停用，兩既有鍵未複製資料。
- Platform [PR #102](https://github.com/ianlkl11234s/gis-platform/pull/102)／[PR #103](https://github.com/ianlkl11234s/gis-platform/pull/103) 已 squash merge，migration 410／411 已套用；保留 null、原始畜禽狀態與既有 ACL/RLS。
- Frontend [PR #233](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/233) 已部署共用 geometry 快取與平行請求；[PR #234](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/234) 已部署畜禽 coverage 單位修正。Zeabur 部署 `6aa02d3b7b89d694354a15c7`／commit `172a284955d697478c4fa0327ce18daff530bb75` RUNNING。
- Catalog DB query 12,325.914 → 354.851 ms，回應內容相同；不代表完整 UI 或首次 geometry 載入時間。
- 最新程式 CI build/test 通過；外部 Claude review runner 失敗，未產生 review，未變更 workflow 或 branch protection。
- 正式 HTTP、DB、boundary 與 browser 證據見 [README](./README.md)。原始本地紀錄保留如下。

## 2026-09-08 — Frontend wiring（當時狀態）

- 24 enabled recipes 接入既有 Statistics；3 blocked recipes 不建立 toggle。
- exact tuple、boundary 與來源狀態保留；桌面24層及手機代表層通過本地真實 bundle 驗收。
- [PR #227](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/227) 已於 2026-09-08 02:51:10 UTC squash merge 至 master；commit `0f8bed5e8c8d1f7fd8de5310127d50b8dadd3e49`。
- [GitHub CI](https://github.com/ianlkl11234s/mini-taiwan-pulse/actions/runs/34181344188) build/test 通過。Claude review 因組織無 Claude 存取權失敗，未產生 review 結果；未變更 workflow 或分支保護。
- 尚未完成正式 releases 發布、production readback 與部署驗收。
