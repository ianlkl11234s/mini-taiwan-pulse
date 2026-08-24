# Status

**最後更新**：2026-08-24（四 repo／多 worktree 收斂；15 個 release PR + memory publication；production gates 完成）

> 本檔只保留當前 release truth、blockers 與下一棒。歷史工作留在 git、
> `docs/features/`、`BACKLOG.md`、`INCIDENTS.md` 與 `REFLECTIONS.md`。

## Scope ledger

| repo / system | current truth |
|---|---|
| **mini-taiwan-pulse** | 功能 release head `05d4a75`；PR **#163** popup 座標精度、**#164** 日本宗教 raw 三層、**#165** AIS/GFW 已 merge。六顆原子 `memory:` commits 也已由獨立 PR **#166** 發布；主樹與 `origin/master` 同步、乾淨 |
| **gis-platform** | `main == origin/main == 97d5952`、乾淨。PR **#62–#66** 已 merge：migration 370／371／372+373／374／release-truth docs |
| **taipei-gis-analytics** | `master == origin/master == 1aaf10e`、乾淨。PR **#56–#62** 已 merge；catalog transaction fix 的 post-merge workflow 成功 |
| **data-collectors** | `main == origin/main == 2d1856a`、乾淨；既有 PR **#55–#58** 均已 merge，無本輪未發布變更 |
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

- **mini-taiwan-pulse**：`codex/jp-religion-layers` 保留禁止發布的 canonical POC 研究；`chore/ar11e-legacy-rpc-retire` worktree 乾淨、未動。
- **taipei-gis-analytics**：`backup/pre-wrapup-20260824@3ff9469` 保存原本 24 commits；舊 business-registry branch 與 2026-06-29 stash 保留，未 pop/drop。
- **gis-platform**：舊 `feat/jp-religion-layers@7f89b50` 保留；預設分支與遠端已同步。
- **data-collectors**：`feat/gov-events-snapshot@a215f93` 為 08-15 default-off 歷史 WIP；`medical/er-transformer-fix` 與已 merge PR #1 patch-equivalent；都未自動 merge/delete。

## Current blockers / next-session entry

1. **MAR-1（P1）**：取得 GFW token/licence、啟用 collector、驗 run/RPC/archive/browser。
2. **MAR-2（P1）**：確認 production frontend deploy commit，補日本宗教＋海事正式站 browser acceptance。
3. **MAR-3（P2）**：調查 AIS MMSI `994163329` 顯示在土城內陸的資料語意／座標品質。
4. **JP-1（P2）**：用真 PostgREST 驗 migration 374 的 write denial。
5. 既有 PH-2、PR-1、CAT-1、G016、BR-2/3 等狀態不變，見 `BACKLOG.md`。

## Verification boundaries

- mini：`npx tsc -b`；Vitest 53 files／653 passed／1 skipped；layerConsistency 9 passed；browser console 0 errors/warnings。
- gis-platform：各 migration PR sql-lint/review pass；374 production readback pass；#66 review/sql-lint pass。
- analytics：PR #62 focused pytest 2 passed；post-merge catalog workflow success。
- collectors：本輪沒有修改；main 與遠端同步。
- local browser + production RPC ≠ production frontend deploy/browser；DB ACL readback ≠ PostgREST write-denial E2E。
