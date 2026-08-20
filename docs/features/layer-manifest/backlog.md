# Layer Manifest — Backlog

> Manifest 348/348、Phase 4 派生與 deploy-contract 守門已完成。八批搬移、schema 推演、紅燈演練與 commit 歷史見 [changelog.md](./changelog.md)；架構契約見 [handoff.md](./handoff.md)。本檔只保留 current residual。

## Release / verifying

- [ ] **LM-REL-1** · `release` · P1 · `verifying`：確認 manifest 接線所涵蓋的 gitignored assets 已經實際部署。
  - Outcome：不把 `deployContract.test.ts` 綠燈誤當 S3/production 完成。
  - Next action：在當期 release merge 後，依 manifest 跑 object readback、HTTP/Range 與抽樣 browser 驗收。
  - Acceptance：本機 contract、S3 checksum/size、production HTTP 與 browser evidence 分開記錄且全數通過。

## Product / UX backlog

- [ ] **LM-POPUP-1** · `product` · P2 · `ready`：處理 29 個 no-popup candidates，分成 9 個可獨立驗收的工作包。
  - Outcome：有可點物件但尚未接線的圖層能提供誠實且可用的 popup。
  - Next action：從 [no-popup-audit.md](./no-popup-audit.md) 選一個工作包，補 `GIS_LAYERS`/共用 panel 與 browser 驗收；不一次改完 29 個。
  - Acceptance：對應 popup contract/test、觸控路徑與 All Off browser evidence。

## Decision needed

- [ ] **LM-EDGE-1** · `decision` · P2 · `blocked`：no-popup audit 的 6 個 edge cases 需 owner 拍板：房地產 Grid ×3、`temperatureWave`、`waterFloodExtreme`、`powerPoles`。
  - Decision：要補觸控/popup、保留現行 hover/獨立 UX，或明確標記為 no-popup。
  - Acceptance：每個 edge 都有 owner 決策與後續 implementation/close 項。

## Technical debt

- [ ] **LM-HOOK-1** · `tech-debt` · P3 · `ready`：評估 7 個同時落在 registry 與 `HOOKS_IN_APP` 的 hybrid keys 盲區。
  - Outcome：掛載契約能分辨「資料在 App、上圖在 Host」，不靠聯集判準靜默放行。
  - Next action：以 per-key 宣告 POC 驗一個 hybrid key，並做負向突變測試。
  - Acceptance：遺漏 registry 或 App hook 的 fixture 確實轉紅，既有 348 keys 契約不放寬。

- [ ] **LM-SPEC-1** · `tech-debt` · P3 · `ready`：只評估拆出 `layerParamsSpec.ts` 上半段型別與 builder，不按主題 spread 字面。
  - Outcome：降低單檔維護成本，同時保留 TS2353 typo 與 TS1117 duplicate-key 護欄。
  - Next action：先做零值變動 POC，對黃金 fixture 與兩個 TypeScript 負向案例。
  - Acceptance：fixture 逐位元不變，typo 與 duplicate key 仍會編譯失敗。

- [ ] **LM-UPSTREAM-DOC-1** · `docs` · P3 · `ready`：清理 analytics `_pending_source_urls.md` 對已刪 fire catalog 路徑的兩筆舊引用。
  - Outcome：跨 repo catalog 路由不再指向 `environment/fire_hydrants.md` / `fire_stations.md` 舊位置。
  - Next action：在 taipei-gis-analytics 核對新 catalog path 後修正待補 URL 清單。
  - Acceptance：舊路徑 targeted search 歸零，catalog/registry tests 綠。

## Conditional / triggered later

- **LM-YEAR-1** · `tech-debt` · P3 · `conditional`：`PENALTY_YEAR_MAX` 調高到未來年份時，`pollutionPenaltyYear` 默認值會使 golden extract 漂移。
  - Trigger：新年份資料要求調高 `PENALTY_YEAR_MAX`，且 guard 先轉紅。
  - Next action：在 `layerGoldenExtract` sanitize 補年份正規化。
  - Acceptance：新年份可用、fixture 穩定，不關閉原 guard。

## Completed / historical

- Manifest Phase 1–4、348/348 entries、`popup: T | T[] | null`、mixed-kind source arrays、orphan `section: null`、legend/popup 派生、LayerHost 掛載與 deploy-contract 雙向斷言均已完成；詳見 [changelog.md](./changelog.md) 與 git history。

## Explicitly not planned

- 不把 `clickPriority` 放進 manifest；first-hit-wins 順序繼續由 `gisClickRegistry.ts` 與 fixture 守住。
- 舊的 `06_apply_to_pulse.py --apply` 路線已退役；腳本只保留 dry-run 對帳，新審計應另立專案。
