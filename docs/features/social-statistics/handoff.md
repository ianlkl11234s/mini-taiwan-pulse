# Social Statistics 前端交付

## 上游與硬依賴

完整執行入口：`/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/output/social-statistics/20260915/FRONTEND_HANDOFF.md`。
資料SSOT：`/private/tmp/statistics-social-ready-20260914/docs/handoff/social-statistics-recipes.json`；補充 `social-statistics-frontend.md` 與 `social-statistics-boundaries.json`。

必要欄位：layer_key、enabled、dataset_id、indicator_id、level、boundary_version、unit、legend、release_options 的 release_id/period_start/period_end/dimensions、source disclosure。CDN沿用 regional-statistics-cdn-v1 及SHA/bytes驗證。sources與health和values共用精確release/level/dimensions，不可取同release其他selector的metadata。

資料若消失，依穩定交付目錄 SHA256SUMS 驗證 tar.gz，再解到全新目錄並依delivery-files逐檔核對；不可覆蓋現有repo。

## 驗收

- **本地驗收完成；已依後續授權原子提交，未發布。** Worktree `/private/tmp/pulse-social-statistics-frontend-20260915`，branch `codex/social-statistics-frontend-20260915`，基底 `617f1dcb117e72738dde85f0cf0ab19281661432`。
- 精確45 enabled recipes、416 selectors全部通過實際前端loader的manifest/artifact/geometry SHA與bytes驗證；[逐selector結果](./evidence/actual-loader-selectors.json)。本測試以真實交付bytes供應fetch；上游416 HTTP證據在資料根目錄frontend-acceptance.json，兩者不混稱browser驗收。
- 全站160 files、1,353 tests passed／3既有skipped；最後UI提示/格式修正後17項focused tests與`npm run build`再通過。build仍有大chunk提示。[tests](./evidence/tests.log)、[最後focused](./evidence/final-focused-tests.log)、[build](./evidence/build.log)。
- 真實桌面1280×720：45層逐一開啟、填色、地圖點選與固定legend。每層PNG與DOM讀回檔保存在evidence，彙整 [desktop-layers](./evidence/desktop-layers.json)。最終文字格式修正另以手機住宅截圖回驗，沒有宣稱此前每層截圖全部重拍。
- 特例：學生年減5,337人/-4.34%；平溪區醫院missing；大安區安寧0床；彰化護理378人且1/22 PARTIAL、臺北原始-；照服列示20/22；兩個每萬人口率107.07/272.55；住宅縣市/鄉鎮歷史日期。
- 手機390×844：教育110/111學年及學段/schema切換、來源揭露、opacity0.55→0.50；照服總計6,507/男性1,298；住宅中山區17.26%、2020-11-08。scrollWidth=390。這是viewport模擬，不是實體手機。
- single/overlap、All Off及新舊層共存實際操作；既有出生數原CDN載入大安區156人。原有476層params及overlay完整保留，click groups只增45層。[回歸保留](./evidence/regression-preservation.json)。
- [完整browser結果](./evidence/browser-acceptance.json)、[手機住宅截圖](./evidence/mobile-housing-popup.png)、[護理部分覆蓋截圖](./evidence/desktop-nursing-observed.png)。

## 剩餘問題與發布界線

沒有本輪尚未通過的接線驗收項目。資料缺列、1/22或20/22 PARTIAL、歷史STALE為上游資料事實，均保持顯示；不能藉由前端補0或假CURRENT消除。build的既有大chunk提示仍在。

新層正式資料尚未發布：DEV旗標關閉或production bundle會使用既有全量CDN，正式發布前須另外合併保留舊selectors的完整snapshot、讀回hash，再取得發布授權。本包不可直接覆蓋current。production bundle已確認無本地preview路徑。

原checkout平行未提交工作未帶入本worktree，也未修改；後續整合須對照當時最新差異。前次驗收時未提交；本次後續授權已完成本地原子提交，仍未push/merge、CDN上傳、production匯入、部署或排程。

## 原子提交紀錄

- `d94149d5`：45配方契約、固定色階工具與單元測試。
- `3d393b7f`：完整UI/registry/map/loader接線、DEV增量路由及整合測試。
- 本文件與驗收證據另作docs commit。提交前再驗證 `npx tsc -b` 與24項focused tests，全數通過。
- evidence中的publication欄位描述原browser驗收當時狀態，保留歷史紀錄。

## 正式發布準備（2026-09-15）

- 後續已授權正式發布；依新規則所有 PR 使用一般 merge commit。
- 已合併當時 origin/master 的 8 筆提交，保留平行新增 18 日本圖層；539 keys 的 golden/consistency 通過。
- 整合後 tsc、build 通過；1364 tests passed、4 skipped。
- 416 selectors 搭配正式既有 reference geometry 經實際 loader 重新驗證：[release geometry evidence](./evidence/release-geometry-loader-selectors.json)。這仍是本地 hash-validating fetch fixture，未冒充 production browser。
- 上游 414 bundles 的 health/coverage publication adapter、平台 nursing sidecar adapter 已完成本地測試與提交。原始 source bytes/數值不變。
- GitHub push 遭自動核准審查要求具體目的地授權而拒絕；已詢問使用者。當前 production import / R2 upload / PR merge / deployment 皆未執行。
