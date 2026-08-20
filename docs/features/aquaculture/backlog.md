# Backlog — 養殖漁業 Aquaculture

> 詳細契約見 [`README.md`](./README.md)、[`handoff.md`](./handoff.md)；本檔只列仍可執行的工作。

## Active work（進行中／待辦）

- [ ] **AQ-3** · `data-health` · P2 · `waiting_external`：放養量 G70 dataset（79 點）尚未接入。Outcome：可在養殖主題呈現放養量；Next action：確認上游成品與欄位契約後接 loader/manifest；Acceptance：source checksum、tsc/test、browser popup。
- [ ] **AQ-4** · `product` · P2 · `waiting_external`：牡蠣養殖區上游已 staged、尚未正式 pipeline 化。Outcome：正式資料可重現更新；Next action：上游建立可重跑 pipeline 並提供 handoff；Acceptance：上游 commit、成品 manifest、前端 asset HTTP 200。

## Decision needed

- **AQ-2** · `release` · P1：3.1MB `aquaculture_ponds_osm.pmtiles` 的部署策略。選項是 commit 進版控，或 gitignore 後由 `upload-deploy-assets.sh` 上 S3；Owner 拍板後，執行對應部署並完成 checksum/HTTP 驗收。

## Conditional / triggered later

- **AQ-5** · `product` · P3 · `conditional`：popup footer 顯示資料來源 Tier。Trigger：上游補 `source_org` / `source_tier` 欄位且產品需要顯示；Next action：補欄位後沿用 `SourceFooter`；Acceptance：欄位契約與 popup browser 驗收。

## Verifying

- **AQ-1** · `release` · P1 · `verifying`：3 個初始圖層的 source/manifest/hook 已存在於目前 checkout（git history `7946a59`、`4e3a770` 可核對），但原先的「未 commit / 未 push」已過時，且沒有本 repo 可獨立確認的 production browser evidence。Next action：以實際 PR/merge 與 production HTTP/browser 證據確認；Acceptance：PR merge、資產 HTTP 200/Range、All Off 逐層驗收。

## Completed / historical（已完成／歷史）

- 實作細節與資料統計留在 [`changelog.md`](./changelog.md)，不在 backlog 重複長文。

## Explicitly not planned（明確不做）

- 逐口魚塭屬性稀疏不是 bug：15,241 筆僅少量有 `produce`/`name`，空值由 popup 自動隱藏。
