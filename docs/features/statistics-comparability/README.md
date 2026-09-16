# 統計比較：2026-09-17 本地復原

此目錄記錄 `a9d522f4` 後統計比較工作的**本地復原**。資料與程式均未發布、未上傳，也沒有變更正式 CDN pointer。

## 已重建的本地資料契約

- 以本工作目錄 `recovery/statistics-comparability` 為基準，`../data/statistics-comparison-data/cdn/assembly-receipt.json` 記錄 `LOCAL_ONLY`：保留 3,590 個既有 selectors，新增 244 個 exact selectors，合計 3,834；188 個 comparison recipe keys。
- 持久路徑為 `../data/statistics-audit-live-manifest.json`、`../data/statistics-comparison-cache` 與 `../data/statistics-comparison-data`，不是舊的 `/private/tmp` 路徑。
- `inventory.json` 與 `layer-audit.md` 是依現有 manifest/receipt **重建的盤點**；不是原始檔案的 byte-for-byte 復原，也不能作為本輪 UI 驗收證據。

## 比較語意

- 切換只可配對同 period 與 shared identity dimensions（例如畜種、季度）。`source_field`、`denominator_period`、`bed_measure` 可因指標轉換而不同，但必須選到目標 release 的 exact selector。
- 缺值、suppressed、`PARTIAL`、`STALE` 與 coverage 必須原樣保留；不可補零、反推遮蔽值或把部分母體標為全臺。
- A2 與 A1+A2 使用 2025 當事人資料、以順位 1 的事故錨點去重；歧義事件排除並維持 `PARTIAL`。
- 土地使用的行政面積分母採 8410 reference 面積；不得使用 25070 公告地價面積或把選定用地類別加總當完整國土分母。

## 本輪證據與待補

| 項目 | 本輪結果 | 證據 |
|---|---|---|
| Python builders／資料契約 | 24 passed | [`./evidence/recovery/python-tests-recovery.log`](./evidence/recovery/python-tests-recovery.log) |
| Runtime loader | 256 / 256 | [`./evidence/recovery/runtime-loader-recovery.log`](./evidence/recovery/runtime-loader-recovery.log) |
| 教育路由 | 81 起點 × 4 學制 × foot/car = 648 | [教育可達性](./education-accessibility.md) |
| Frontend tests | 1,390 passed、4 skipped，28.84s | [`./evidence/recovery/frontend-tests-recovery.log`](./evidence/recovery/frontend-tests-recovery.log) |
| build | 通過；僅既有 bundle chunk > 500kB 警告 | [`./evidence/recovery/build-recovery.log`](./evidence/recovery/build-recovery.log) |
| browser | 12 教育 view 22/22、derived、醫療、住宅、漁業、土地、公車、A2 與 390px 情境均已實測；dev errors 為空 | [`evidence/recovery/browser/`](./evidence/recovery/browser/) |
| 本地 bundle | `LOCAL_ONLY`，1,557,858 bytes、SHA `d146…aca0f` | [`evidence/recovery/bundle-receipt.json`](./evidence/recovery/bundle-receipt.json) |

歷史 `evidence/` 和早期 acceptance 數字只能說明當時工作，不可代替此表的本輪證據。

詳見 [驗收](./acceptance.md)、[復原操作](./recovery.md) 與 [待辦](./backlog.md)。
