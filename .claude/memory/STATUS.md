# Status

**最後更新**：2026-08-19（backlog cleanup、A2/A5 handoff sync、G016 local cleanup）

> 本檔只保留當前 release truth、blockers 與下一棒。歷史工作留在 git、
> `docs/features/`、`BACKLOG.md` 與 `REFLECTIONS.md`。

## Scope ledger

| repo / system | current truth |
|---|---|
| **mini-taiwan-pulse** | `master` 已由 PR #143/#144 整合 Business Registry r2、wrap-up v2 與世界通訊圖層；本次只重整 backlog/memory，不改 runtime。 |
| **taipei-gis-analytics** | PR #46/#47 已整合 Business Registry 與 telecom pipelines；PR #48 已 merge A2/A5 handoff sync（merge `a03d8ac`）。 |
| **weather_change** | PR #1 已 merge legacy S3 client cleanup（merge `207e876`）；tracked config/code/docs 不再要求 AWS key。ignored `.env` 的舊 S3 keys 已在本機移除，但不屬於 Git artifact。 |
| **AWS IAM** | 舊 key 仍可通過 STS；目前身份無 `iam:ListAccessKeys`／`iam:GetAccessKeyLastUsed` 權限，因此未撤銷、未輪替。需管理者處理 `gis-data-collectors` key ending `E7PK`。 |
| **Production** | 本輪沒有 server pull、Zeabur deploy、正式站 HTTP／Range／404、CDN purge 或整合版 browser acceptance。 |

## Release truth matrix

| release unit | build | contract/wire | assets | CI | merge | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|
| Business Registry r2 | done | done：含 A2/A5 handoff sync | upload/readback done：12 immutable assets | done：run #355 | done：code PR #143；docs PR #48 | blocked：未授權／未執行 | not run | not run：整合版 |
| Telecom world 8 layers | done | done | done：Git static assets | done：run #355 | done：PR #143 | blocked：未執行 | not run | not run：整合版 |
| G016 local credential cleanup | done：tracked cleanup | N/A | N/A | done：Python syntax check | done：weather PR #1 | N/A | N/A | N/A |
| G016 AWS credential retirement | N/A | N/A | N/A | N/A | N/A | blocked：需 AWS administrator | N/A | N/A |
| PeeringDB／CAIDA future layers | N/A | docs only | N/A | N/A | N/A | blocked：需再散布許可 | N/A | N/A |

`assets done`、`CI done` 與 `merge done` 不代表 production deployed；沒有正式站
HTTP 與 browser evidence 前，不使用「已上線」描述。

## Current deliverables

### Business Registry / Factory

- B1/A4：654,165 公司 detail points；overview 5,745 cells；184,944 manufacturing companies。
- B2：150m／450m／1500m 資本額格網 89,754／26,834／5,745 cells。
- B3：89 個 industry-mid options、21 縣市、9 個 filter dimensions；r2 filter contract 已進版控。
- B4：11,121 共同地址 points／198,606 memberships；threshold 5–800，公開 `capital_sum`／`capital_median`。
- A1：100,624 active factories；90,652 located，9,972 misses；overview 3,673 cells。
- A2/A5/A6：215 industrial-park polygons、127,795 active cohort／80,732 located／47,063 misses；A3 保留 assertion-only 語意。

### Communications — World

- `submarineCables`：104 條 OSM/OpenInfraMap z2 generalized crowd 海纜。
- `landingStations`：58 個 OSM 登陸站。
- `internetExchangePoints`：892 個 PCH Active IXP。
- `anfrWirelessSites`：8,000／33,761 個 ANFR 5G 3500 官方站點穩定概覽。
- `osmCommunicationSites`：6 個區域、916 個 OSM 通訊候選點。
- `ripeAtlasProbes`：3,000／13,534 個量測節點，147 國；座標已模糊化。
- `ooklaMobilePerformance`／`ooklaFixedPerformance`：2026 Q1 的 751／893 個 z6 效能格網。

各層維持獨立證據語意：官方站點、crowd geometry、IXP、measurement node、performance sample
不得合併推論成基地臺、機房、coverage 或實際流量。

## Completed in this closeout

- `BR-1`：兩 repo 的 Business Registry commits 已在 `master` lineage；不再建立 topic-only PR，從 active backlog 關閉。
- `BR-4`：Analytics A2/A5 handoff、index 與 layer plan 已同步；保留 coverage/semantic cautions，從 active backlog 關閉。
- `AU-6`：單一 lockfile 決策已有 git history 證據，從 active backlog 移除。
- `DS-06`：依 owner 判定為 AIS source-side issue，從 active backlog 移除。
- `G016` local portion：`weather_change` 的 legacy S3 env references、unused boto3 imports/dependency 與舊 README flow 已清理；AWS revoke 仍未完成。

## Verification

- Business Registry/telecom integration：`npx tsc -b --pretty false` pass；Vitest 46 files、637 passed／1 skipped；GitHub Actions run #355 success。
- 三個 closeout scopes：`git diff --check` pass。
- `weather_change`：`python3 -m py_compile scripts/update_humidity.py scripts/update_pressure.py` pass；指定檔案的 legacy S3 key names、boto3/botocore/HAS_BOTO3 references 為 0。
- Analytics A2/A5 targeted search：`upload/readback verified` 與 production deploy/HTTP/browser pending 語意一致；A2 的 288 為歷史規劃口徑，現行成品 215 features。
- 本輪未做 merge 後正式站視覺驗收；browser 欄維持 not run。

## Current blockers

1. **G016**：AWS 管理者需停用 key ending `E7PK`；停用後以舊 credential 執行 STS 必須失敗，才能關閉。
2. **BR-2/BR-3**：12 個 Business Registry assets 仍需 production pull/deploy authority，之後才可做 HTTP/Range/404 與 browser QA。
3. **保留工作**：`BL-25`、`AR-12/13`、`AR-14~16` 照 owner 決定繼續留在 active backlog。
4. **PeeringDB／CAIDA**：未取得再散布許可前不建立公開圖層。

## Next-session entry

1. 由 AWS administrator 停用 `gis-data-collectors` key ending `E7PK`；舊 key 的 `sts:GetCallerIdentity` 必須失敗，才能從 backlog 移除 G016。
2. 若取得 deploy 授權，從已合併的 `master` 部署；先確認 12 個 Business Registry immutable assets 可被 production pull。
3. 正式站做 HTTP 200/206、404、cache probe，確認 telecom `/geo/` assets 與 Business Registry PMTiles 都可讀。
4. Browser 從 All Off 起手，驗 Business Registry overview/detail/filters 與世界通訊 8 layers 的 popup、legend、attribution、dark-map 可讀性及 console/network 0 error。

詳細 active work 與 acceptance criteria 見 `BACKLOG.md`。
