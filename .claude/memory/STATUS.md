# Status

**最後更新**：2026-08-25（半成品安全封存、backlog routing、Analytics skills split PR）

> 本檔只保留當前 release truth、blockers 與下一棒。歷史工作留在 git、
> `docs/features/`、`BACKLOG.md`、`INCIDENTS.md` 與 `REFLECTIONS.md`。

## Scope ledger

| repo / system | current truth |
|---|---|
| **mini-taiwan-pulse** | Published `master == origin/master == a06a84a`；PR **#163–#167** 已 merge。`ar11e` worktree 已移除，兩顆 unique patches 保留在 local `chore/ar11e-legacy-rpc-retire@d83252e`；canonical POC 留 local `codex/jp-religion-layers@826104f`，不直接 push／merge |
| **gis-platform** | `main == origin/main == 97d5952`、乾淨；已被 PR #62–#65 完整取代的 local `feat/jp-religion-layers` 已刪除，可由 `7f89b50` 復原 |
| **taipei-gis-analytics** | `master == origin/master == 9c6d576`；skills foundation **#63**、why-drill **#64** 已 merge；religion deep-dive **#65** 保持 Draft。2026-06-29 stash 未 pop/drop |
| **data-collectors** | `main == origin/main == 2d1856a`；patch-equivalent ER branch local/remote 已刪。Gov-events 未完成 commit 改名封存在 local `archive/gov-events-snapshot-20260815@a215f936`，未 push／未部署 |
| **正式 DB（Supabase）** | migration 371 已存在且 AISStream 運作中；migration 374 已 apply 並做 ACL／anon readback；catalog workflow committed 266 metadata upserts |
| **Browser evidence** | local merged frontend `127.0.0.1:3721` + production RPC：日本三來源、AIS 點／popup、GFW honest empty state 都已驗；**不是 production frontend acceptance** |

## Split PR release map

| repo | PR | release unit | result |
|---|---|---|---|
| mini-taiwan-pulse | #163 | popup coordinate precision warning | merged；CI/review pass |
| mini-taiwan-pulse | #164 | Japan religion raw GSI/OSM/Wikidata layers | merged；禁止的 canonical POC 未進 branch history |
| mini-taiwan-pulse | #165 | AISStream/GFW layers + release-truth correction | merged；registry conflict 採 union；tsc + 653 passed／1 skipped + browser |
| mini-taiwan-pulse | #166 | wrap-up memory publication | merged；六檔六顆 atomic commits；review/CI pass |
| gis-platform | #62 | migration 370 Japan religion contract | merged |
| gis-platform | #63 | migration 371 AISStream/GFW contract | merged |
| gis-platform | #64 | migrations 372/373 police/justice | merged |
| gis-platform | #65 | migration 374 Japan religion view hardening | merged；其後已 apply production |
| gis-platform | #66 | maritime/religion operational release truth | merged；review/sql-lint pass |
| taipei-gis-analytics | #56–#61 | police loaders／Japan delivery／sample inventory／AIS-GFW research／MLIT guard／Japan raw POC research | 全部依 release unit 拆分並 merge |
| taipei-gis-analytics | #62 | catalog sync transaction state | merged；production workflow success |
| taipei-gis-analytics | #63 | skill format foundation | merged；diff-check + active-skill audit pass |
| taipei-gis-analytics | #64 | why-drill skill | merged；stacked base 收斂後 retarget master；audit pass |
| taipei-gis-analytics | #65 | religion deep-dive research | Draft；syntax/diff-check pass；未 merge、不宣稱研究完成 |

## Production truth

### Maritime contract（migration 371）

- 9 張 live tables、5 支 public RPC、2 個 active cron、9 筆 retention、18 個 child partitions。
- parent/children FORCE RLS；anon/authenticated 無 direct table SELECT。
- AISStream feed healthy，已有 verified archive manifests。
- GFW schema/RPC 已部署，但 token/licence gate 未解除，collector run count = 0；不得宣稱有 snapshot。

### Japan religion hardening（migration 374）

- 2026-08-24 20:58 CST apply 成功。
- 六組 anon/authenticated role/view grants 只剩 SELECT。
- 三個 views 均含 `security_invoker=true`。
- `BEGIN; SET LOCAL ROLE anon` 後三個 view 實讀成功。
- 尚未做真 PostgREST INSERT/UPDATE/DELETE rejection E2E（BACKLOG `JP-1`）。

### Catalog sync（analytics PR #62）

- Workflow run **32732878159** success。
- Catalog 455／Existing 271／NEW 196／CHANGED 70／STALE 12。
- transaction committed **266 upserts**；STALE 只列出、不刪除。
- 本地 monitor DB role 無 `metadata` schema 權限，故 production 落地證據來自 workflow transaction log，未另做 SQL readback。

## Release truth matrix

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| Japan religion raw layers | done | done | N/A | N/A | done：production RPC/DB | N/A | unknown：frontend deploy 未查 | not run | done：local + production data |
| AISStream | done | done | N/A | done：verified archives | done：feed/RPC/ACL | N/A | unknown：frontend deploy 未查 | not run | done：local actual point + popup |
| GFW | done | done | N/A | blocked：無 snapshot | blocked：run count 0 | N/A | unknown：frontend deploy 未查 | not run | done：local honest empty state |
| migration 374 ACL | N/A | done | N/A | N/A | done：grant/reloption/anon read | N/A | done：production apply | not run | N/A |
| catalog sync fix | done：2 focused tests + dry-run | done | N/A | N/A | done：workflow committed 266 | N/A | done：GitHub Action | N/A | N/A |

## Preserved WIP（刻意不清除）

- **mini-taiwan-pulse**：canonical POC 與 legacy RPC branches 保留；兩者已各自進 feature backlog，額外 worktree 已清除。
- **taipei-gis-analytics**：`backup/pre-wrapup-20260824@3ff9469` 與舊 `codex/business-registry-production@6388df4` 暫留；前者的實質 patches 已由 PR #56/#59/#60 吸收，後者內容已拆到 #63–#65，待 #65 裁決後再刪。2026-06-29 stash 由 B191 conditional 追蹤。
- **data-collectors**：Gov-events 依 owner 決策低效益暫時結案，只保留 local archive branch；不開 Draft PR。

## Current blockers / next-session entry

1. **MAR-1（P1）**：取得 GFW token/licence、啟用 collector、驗 run/RPC/archive/browser。
2. **MAR-2（P1）**：確認 production frontend deploy commit，補日本宗教＋海事正式站 browser acceptance。
3. **MAR-3（P2）**：調查 AIS MMSI `994163329` 顯示在土城內陸的資料語意／座標品質。
4. **JP-1（P2）**：用真 PostgREST 驗 migration 374 的 write denial。
5. **JPR-4（P2/blocked）**：canonical POC 只有在 evaluation、授權與 lineage gates 完成後才可重啟。
6. **IMG-cwa-r2-cors（P1/blocked）**：修 R2 CORS 並完成 production browser gate 後才可退役 legacy RPC。
7. Analytics **#65** 保持 Draft；先確認研究發布邊界，再決定 merge 或 close。
8. 既有 PH-2、PR-1、CAT-1、G016、BR-2/3 等狀態不變，見 `BACKLOG.md`。

## Verification boundaries

- mini：`npx tsc -b`；Vitest 53 files／653 passed／1 skipped；layerConsistency 9 passed；browser console 0 errors/warnings。
- gis-platform：各 migration PR sql-lint/review pass；374 production readback pass；#66 review/sql-lint pass。
- analytics：#63/#64 `git diff --check`、skill audit pass；無 GitHub status checks；#65 只有 syntax/diff-check，仍是 Draft。
- collectors：本輪沒有 main code change；archive branch local-only，未經 deploy/production 驗收。
- local browser + production RPC ≠ production frontend deploy/browser；DB ACL readback ≠ PostgREST write-denial E2E。
