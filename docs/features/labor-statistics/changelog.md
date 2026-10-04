# Changelog — labor-statistics

## 2026-10-04 — 村里所得改用 SEGIS 112 原生界線

- `statsLaborVillageIncomeMedian` 改指新 release `village-income-median-112-segis112` × `VILLAGE_SEGIS_112`（112 年綜所稅村里 SHP 自帶界線，排除未編定）。原因：舊界線 `VILLAGE_NLSC_1150119` 是 115 年版，含 206 個未編定村里碼、缺瑪家三和村，且與 112 年數值不同期；同代碼 236 組 IoU<0.9，值會畫在錯的範圍上。
- 新 release 與舊 release 共同的 7,746 個代碼逐筆相同；找回三和村（10013280006）與 10002060008 兩筆來源有值，覆蓋 7,604／7,748（144 筆來源本身缺值）。圖例維持現行 8 階固定門檻。
- 舊 release 與舊 geometry 仍在 R2（immutable），前端不再使用。已於 2026-10-04 增量發布（manifest `f8cdd6bb…`）。

## 2026-09-27 — 所得色階、非勞動力率與 details 精簡

- 村里綜合所得由 5 階改為 8 階 Cividis 色階，切點來自 7,602 筆 observed values 的 octile；missing 仍為灰色、不等於 0。
- 原 `statsLaborCountyNonLaborForce` 增加人數／非勞動力率切換。比率沿用 exact `participation_rate` selector 並在載入後計算 `100% − 勞動力參與率`，不新增 layer key、release 或 selector。
- Statistics details 外層精簡為操作、filter 與 labor 的位置口徑；其餘語意、coverage、missingness、boundary、unit、期別與處理版本移至「來源與處理紀錄」，其他 Statistics 圖層同步套用。
- 合併最新 `master` 的 sidebar／mobile design-system 基線；新增的「顯示」selector 套用共用 `statistics-filter-label` 與 `lpc-select` 樣式，資料契約不變。
- 桌面與 390×844 mobile browser 驗收通過；新竹市點擊回讀非勞動力率 40.4%，console 0 errors。
- focused 107/107、真實 delivery 1/1、TypeScript 與 production build 通過。完整 suite 為 2,324 passed、193 skipped，無失敗。
- Git delivery、checks、merge 與 production acceptance 證據由 [PR #384](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/384) 統一追蹤。

## 2026-09-27 — 本地 frontend wiring

- 新增精確 9 個 Work & Income layer keys 與 12 個 exact selectors，保護既有 Statistics、social 與 agriculture 基線。
- 新增 dataset-scoped `VITE_LABOR_STATISTICS_PREVIEW` 路由；只有已登錄的 `labor_statistics` recipe 能使用本地 snapshot。
- details、legend、popup 加入 location semantics、coverage、missing reason 與 reference boundary 揭露；observed zero、missing、`source_not_covered`、`source_join_or_time_mismatch` 分開。
- 行業維持單一 toggle，四個選項均可切換，並顯示 manufacturing 是 industry 子集的警語。
- 完整 tests、build、桌面逐層、臺北 73.5、新竹市 90.2、All Off 與 390×844 mobile membership 驗收通過。
- 此基線後續已併入 production；上方 UX 改進由 PR #384 接續交付。
