# Layer Manifest（AR-22）

> **狀態**：active / shipped
>
> **現況基準**：2026-09-20
>
> **操作規則 SSOT**：[`docs/development-rules.md`](../../development-rules.md) §4

## 現行契約

`src/data/layerManifest.ts` 是圖層 metadata 的單一來源。每個 layer key 必須在 manifest
宣告 label、顏色、icon、section、來源、legend、popup 與參數形狀；沒有功能時要用明確的
`null` 並通過豁免 ledger，不可在下游登記簿靜默補值。

以下內容由 manifest 派生，不再手寫：

- `src/components/sidebar/layerCatalog.ts` 的 color 與 production `THEMES`
- `src/components/IconRailSidebar.tsx` 的 icon mapping
- `src/data/upstreamRegistry.ts` 的 layer-to-dataset bridge
- legend keys 與 manifest 的對應關係

參數的完整 UI 規格仍由 `src/data/layerParamsSpec.ts` 管理；manifest 只保存可驗證的
`count`／`kinds` 形狀，兩邊由契約測試對帳。

## 新增或修改 layer

1. 先新增或修改 manifest entry；資料來源必須保留來源、時間、coverage、缺值與 geometry 語意。
2. 有 UI controls 時更新 `layerParamsSpec.ts`；每層至少有 opacity，可分類圖層須有獨立選取與 scale。
3. 實作 loader、hook、overlay/custom layer；可點擊 feature 要接 popup，有多色分類要接 legend。
4. 靜態資產路徑同時核對 manifest、nginx 與 deploy scripts；既有 URL 是契約，不為整理目錄任意搬動。
5. 跑 `layerManifest`、`layerConsistency`、params、popup/click 與相關 domain 測試，再做 browser/network 驗收。

完整 SOP 使用 repository 的 `layer-onboarding` skill；骨架建立使用 `/new-layer`。

## 核心守門

| 目的 | 檔案 |
|---|---|
| manifest schema / entries | `src/data/layerManifest.ts` |
| manifest 與 runtime 雙向對帳 | `src/data/__tests__/layerManifest.test.ts` |
| 完整性與豁免 ledger | `src/components/sidebar/__tests__/layerConsistency.test.ts` |
| params 形狀與狀態 | `src/state/__tests__/layerParamsStore.test.ts` |
| click registry | `src/map/gisClickRegistry.ts` |
| popup panels | `src/components/featureInfo/registry.tsx` |
| deploy/static asset contract | `src/map/__tests__/deployContract.test.ts` |

## 數字與 production 邊界

不要把 manifest entry 數直接寫成使用者可見 toggle 數。manifest 同時包含 production、
release-gated、DEV-only 與 `section: null` 的內部 key；正式 UI 以 production `THEMES` 為準。
易漂移統計由 `scripts/audit/weekly/check_docs.ts` 產生，README 只保存最近一次已驗證快照。

## 歷史資料

AR-22 Phase 0–5 的批次遷移、設計取捨與 commit 紀錄保留於：

- [changelog.md](./changelog.md)
- [backlog.md](./backlog.md)
- [handoff.md](./handoff.md)

這些是歷史與接手證據，不取代本頁的現行契約或 `docs/development-rules.md`。
