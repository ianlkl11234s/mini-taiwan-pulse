# Status

**最後更新**：2026-08-19（Business Registry r2＋世界通訊圖層整合完成）

> 本檔只保留當前 release truth、blockers 與下一棒。歷史工作留在 git、
> `docs/features/`、`BACKLOG.md` 與 `REFLECTIONS.md`。

## Scope ledger

| repo / system | current truth |
|---|---|
| **mini-taiwan-pulse** | `master` 已由 PR #143 合併 Business Registry r2、wrap-up v2 與世界通訊圖層；merge commit `d70c039`。layer golden key count 373。 |
| **taipei-gis-analytics** | 上游 PR #46 已合併 Business Registry production pipeline 與 telecom world pipelines；merge commit `f021c43`。 |
| **Business Registry assets** | 12 個 immutable assets 已 upload 並完成 checksum／metadata readback；B3 r2 filter contract 已 force-add 追蹤，SHA-256 `eac748b7…0599f`。 |
| **Telecom assets** | 8 個可視 layer 已納入前端契約：OSM 海纜／登陸站、PCH IXP、ANFR、OSM 通訊候選、RIPE Atlas、Ookla mobile/fixed。靜態資產走 `/geo/` dist fallback。 |
| **Production** | 本輪完成 code/contract/PR/CI merge，未做 server pull、Zeabur deploy、正式站 HTTP／Range／404 或整合版 browser acceptance。 |

## Release truth matrix

| release unit | build | contract/wire | assets | CI | merge | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|
| Business Registry r2 | done | done | upload/readback done | done：run #355 | done：PR #143 | blocked：未授權／未執行 | not run | not run：整合版 |
| Telecom world 8 layers | done | done | done：Git static assets | done：run #355 | done：PR #143 | blocked：未執行 | not run | not run：整合版 |
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

## Verification

- 本地 TypeScript：`npx tsc -b --pretty false` pass。
- 本地 Vitest：46 files；637 passed／1 skipped。
- 跨 repo targeted：19 tests pass。
- GitHub Actions run #355：success；Claude Code Review run #169：success，無 PR comments。
- 首輪 CI 抓到 `company_filters_202608_r2.json` 被 global gitignore 排除；已以 atomic fix `d8e2dd3` 納入，clean checkout CI 複驗成功。
- 本輪未做 merge 後正式站視覺驗收；browser 欄維持 not run。

## Next-session entry

1. 取得 deploy 授權後，從已合併的 `master` 部署；先確認 12 個 Business Registry immutable assets 可被 production pull。
2. 正式站做 HTTP 200/206、404、cache probe，確認 telecom `/geo/` assets 與 Business Registry PMTiles 都可讀。
3. Browser 從 All Off 起手，切到世界 tab 的 `通訊 Communications`，依序驗海纜、登陸站、IXP、ANFR、OSM、RIPE、Ookla mobile/fixed。
4. 每層驗 popup、legend、attribution、抽樣／偏差聲明、dark-map 可讀性，以及 console/network 0 error；再驗 Business Registry overview/detail 與 filters。
