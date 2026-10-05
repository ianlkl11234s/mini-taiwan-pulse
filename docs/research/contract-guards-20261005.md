# 架構契約測試交接（2026-10-05）

## 範圍與狀態

本地分支 `test/contract-guards-20261005`，base `develop` / `dcd09427`。Collectors 分支 `feat/mojibake-guard`，base `origin/main` / `2759d83`。既有 GD-1、AU-3 與 GD-2 commits 已建立；本輪追加驗證與修正，未 push、merge、部署或操作正式資料。

## GD-1

`src/map/__tests__/overlayManager.test.ts:607` 遍歷目前全部 overlay registry entry，確認其 layer id 存在於 manifest，再透過實際 `addOverlay` 擷取 source spec；遞迴檢查所有欄位沒有 undefined。涵蓋 GeoJSON 與 PMTiles 向量來源；不複製 production builder，不 fetch 資產。

初始及恢復測試：371 passed。故意把 `overlayManager.ts` GeoJSON attribution 條件展開改為 `attribution: undefined`：202 failed / 169 passed；原檔已恢復。原始 log 在 `contract-guards-20261005-evidence/gd1-*.log`。這是 source spec 契約證據，不是 Mapbox browser runtime 驗收。

## AU-1：停止，待拍板

全域 sidebar/map/legend 的同色 SSOT 不明確。已明確的 sidebar 鏈為 `layerManifest.ts:12090` 的 `manifestColors()` → `layerCatalog.ts:71` 的 `LAYER_COLORS`，既有 `layerManifest.test.ts:88` 逐 key 驗證。多類別色表依 `docs/development-rules.md:126,236` 由各 domain `*Types.ts` 共享；序列色盤另由 `state/layerPalette` / `map/palettes` 供 map 與 legend 使用。

例如 `religionTemples` 的 manifest 代表色（`layerManifest.ts:998`）與 map deity family expression（`overlayRegistry.ts:10079`）及多色 legend（`LegendPanel.tsx:2450`）本來具有不同語意。`docs/design-system/map-layers.md:345` 已明定多類別／序列代表色不必出現在 paint。現有 `src/components/legend/__tests__/legendAlignment.test.ts:11` 已有 R4 12 組 map↔legend 主題 guard，另有兩個群組案例（合計 14 tests）；但只驗色彩集合有交集，未連結 sidebar 或逐分類一對一語意。直接套全域 equality 會錯判分類色、主題色及熱區色階。依交接停止條件，本次不新增 AU-1 顏色契約或自行指定權威名單。

待使用者拍板選項：

1. 先限定已明確的 manifest→sidebar 及可選序列色盤鏈；保留分類色差異。
2. 先定義逐層「代表色／分類色／主題／色階」契約與權威來源，再擴大 map/legend 守門。

## AU-3、GD-2 與整體驗收

AU-3 選擇明確分工文件方案；詳見 `day-prefetch-scope-2026-10-05.md`。修改 `src/lib/dayPrefetch.ts:20` 說明及新增 `src/lib/__tests__/dayPrefetchScope.test.ts:46` 行為／結構契約，共 3 檔，未超過 5 檔停止門檻。刻意把 cap 2→3 時 2 failed / 3 passed；恢復 cap=2 後 5 passed，原始 red/green log 在 evidence 目錄。

GD-2 實作與獨立證據見 collectors worktree 的 `docs/investigations/2026-10-05-gd2-mojibake-storage-guard.md`。寫入層拒絕 `[Ѐ-ӿ]`，logger.error 僅列欄位路徑並 raise；一般寫入拒借連線、不進 buffer，direct/multi-table、buffer retry、TLE 旁路也檢查。刻意使 regex 永不匹配後兩個拒寫測試紅燈；已恢復。Collectors 原 runtime 缺既定依賴 opencc/ijson；在 `/private/tmp/gd2-contract-venv` 安裝 requirements 既定版本後，完整隔離 `python3 -m pytest -q`：588 passed / 2 skipped，96.71 秒（`.artifacts/gd2/pytest-full-venv.log`）。未修改依賴檔。

mini 首次 `npm test`：489 files = 22 failed / 460 passed / 7 skipped；3776 tests = 29 failed / 3714 passed / 33 skipped，另 2 worker RPC timeout。29 失敗均為 fixture/結構掃描逾時（非 assertion mismatch），不能宣稱全綠。`layerConsistency` 21 tests、`designSystemGuard` 15 tests 均通過。`npm test -- --maxWorkers=2` 仍重現 5 秒及較長明設 timeout；重現失敗後停止該本次程序（exit 143），保留 incomplete log，未改 timeout/baseline。

首次 `npx tsc -b` 抓到新增 source-spec 測試索引 TS2532；修正為已驗長度後的 non-null assertion，複驗 `npx tsc -b` exit 0（`tsc-restored.log` 無 diagnostics）。未接 production/DB，未做 browser runtime 驗收。


最終針對性檢查：`npm test -- --maxWorkers=2 src/map/__tests__/overlayManager.test.ts src/lib/__tests__/dayPrefetchScope.test.ts src/components/sidebar/__tests__/layerConsistency.test.ts src/styles/__tests__/designSystemGuard.test.ts`：4 files / 412 tests passed，11.18 秒。`git diff --check` 通過。完整原始 log：`contract-guards-20261005-evidence/mini-final-targeted.log`。

未解決：mini 完整 suite 未全綠；目前 failures 都是逾時，但未在無負載環境確認 baseline，不能視為已排除。AU-1 需先拍板顏色語意與範圍；本次不改 guard 基準、不新增 CHANGELOG、不做發布。

## 03b 追加驗收（2026-10-05）

- GD-1 commit `578bb17ce89d85c7eaa423cad6a74002521f32cf`、AU-3 commit `4e219284a94c147554e7f1c4267bb4369e3a054f` 已存在，保留歷史，不重複或改寫。AU-1 依追加指示不做。
- Collectors 原 GD-2 commit `31ea836` 已含 allowlist 與逐列剔除；本輪補修 commit `a14bd6bbb4aa53b8b849a4c1b71188ff44c789ec`：allowlist 僅 `ncdr_alerts`，部分壞列只記 warning（collector 與欄位路徑），名單外 Cyrillic 正常寫入、10 列 1 壞寫入 9 列、全壞 raise。新增 direct multi-table 與 buffer 守門測試。Mutation 6 failed / 2 passed / 25 deselected；還原後 focused 33 passed；隔離全套 594 passed / 2 skipped（33.30s）。詳見 collectors 的 GD-2 報告與 `.artifacts/gd2/`。
- mini `npx tsc -b` exit 0。`npm test -- --maxWorkers=2` 完整執行：481 files passed / 1 failed / 7 skipped；3743 tests passed / 1 failed / 33 skipped（130.35s）。唯一失敗為 `pollutionPenaltiesDataset.test.ts:34` 的 5000ms timeout。
- 上述 timeout 個別以 `--maxWorkers=1` 重查：3 tests passed（3.96s，測試 3.58s）；再以 `npm test -- --maxWorkers=1` 跑完整 suite：**482 files passed / 7 skipped；3744 tests passed / 33 skipped**（301.72s）。未修改 timeout、design baseline 或其他測試。完整單 worker 綠燈與雙 worker timeout 分別保留，不能宣稱所有併行設定皆綠。
- 本輪包含 GD-1 371 tests、AU-3 5 tests、layerConsistency 21 tests、designSystemGuard 15 tests。原 mutation 證據仍保留。
- evidence 既有 11 檔與新增 4 檔均掃描 connection URI、JWT、AWS/provider key 與 credential assignment，未命中；新增 logs 僅清除行尾空白以通過 diff check，完整原始輸出保留於 `/private/tmp/03b-mini-*.log`。新增 evidence：`03b-mini-tsc.log`、`03b-mini-full.log`、`03b-mini-timeout-recheck.log`、`03b-mini-full-workers1.log`。
- 本次僅本地契約／mock 寫入驗證，無正式 DB、browser 或部署驗收；未 push。
