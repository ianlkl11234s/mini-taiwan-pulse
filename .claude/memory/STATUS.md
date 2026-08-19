# Status

**最後更新**：2026-08-19（Business Registry / Factory production staging；wrap-up v2 checkpoint）

> 本檔只保留當前 release truth、blockers 與下一棒。歷史工作留在 git、
> `docs/features/`、`BACKLOG.md` 與 `REFLECTIONS.md`。

## Scope ledger

| repo / system | current truth |
|---|---|
| **taipei-gis-analytics** | `codex/business-registry-production`；worktree clean、無 upstream；相對本機 `origin/master` behind 0 / ahead 28。Business Registry scope 約 20 commits，最新 r2 為 7 個 atomic commits；發布前必須隔離 topic-only range，不能整支 branch 直接推送。 |
| **mini-taiwan-pulse** | `codex/business-registry-common-addresses`，tracking `origin/codex/business-registry-common-addresses`；本次 closeout 完成後 behind 0 / ahead 14，range `b64a5ac..HEAD`。`b64a5ac` 已在 `origin/master`；ahead commits 包含 5 個 Business Registry、wrap-up memory 與 v2 skill/docs，發布前必須依 release unit 隔離。 |
| **Pulse worktree** | wrap-up v2 已以 `07fd324`（implementation＋routing contract）與 `284445a`（docs sync）提交；memory closure 依 exact path atomic commit。closeout 後 target paths、cached set 與 worktree clean。 |
| **S3** | 12 個 immutable assets 已 upload，並逐檔完成 SHA-256、size、object metadata readback。 |
| **Production** | server pull、Zeabur deploy、正式站 HTTP／Range／404 與 browser smoke 尚未完成。正式站：`https://mini-taiwan-pulse.itsmigu.com`。 |

## Release truth matrix

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| 公司 B1/B2/B3/A4 r2 | done | done | done | done | done | blocked：follow-up PR／授權 | blocked：尚未 merge | blocked：尚未 deploy | blocked：尚未 deploy，且 browser runtime unavailable |
| 共同地址 B4 r2 | done | done | done | done | done | blocked：follow-up PR／授權 | blocked：尚未 merge | blocked：尚未 deploy | blocked：尚未 deploy，且 browser runtime unavailable |
| 工廠／園區 A1/A2/A5/A6 | done | done | done | done | done | blocked：follow-up PR／授權 | blocked：尚未 merge | blocked：尚未 deploy | blocked：尚未 deploy，且 browser runtime unavailable |
| A3 membership assertions | done | done：contract only | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

`upload/readback done` 只代表 object storage 有正確資產；不得寫成 production deployed 或 browser verified。

## Current deliverables

- **B1 / A4 公司點位**：654,165 detail points；1.5km overview 5,745 cells，守恆 654,165 companies／184,944 manufacturing companies。z4–11 overview、z12+ detail；detail 可顯示公司名稱，不公開統編、代表人或完整地址。
- **B2 資本額網格**：150m／450m／1500m 共 89,754／26,834／5,745 cells；三尺度公司數皆守恆 654,165。
- **B3 filters**：89 個 industry-mid options、21 縣市與 9 個 filter dimensions；overview 不支援個別公司屬性篩選。
- **B4 共同登記地址**：11,121 points／198,606 memberships；5–800 threshold slider，公開 `capital_sum` 與 `capital_median`。
- **A1 工廠**：100,624 active；90,652 located，9,972 misses；overview 3,673 cells。工廠座標不以公司座標替代。
- **A2/A5/A6**：215 industrial-park polygons（不含科學園區）；A5 127,795 active／80,732 located／47,063 misses；A6 保留 coverage-bias 與 aggregate-zero 語意。
- **A3**：1,505 assertions／1,124 uniform-number summaries；science/bonded/service-provider flags 分離，不發布籠統 `is_in_park`，不由 assertion 推測 geometry。

## Verification

- 2026-08-19 現場重跑 `npx tsc -b`：pass。
- 2026-08-19 現場重跑 `npm test`：46 files／633 tests pass；PMTiles contract 86/86。
- 12 assets 的 exact size/checksum/object metadata 證據在三份 feature handoff；本檔不重複 checksum。
- Browser runtime 曾回傳空清單；沒有 production visual evidence，因此 browser 維持 blocked。

## Blockers

1. Analytics branch ahead 28 且無 upstream；要先隔離 Business Registry topic commits。
2. Pulse ahead commits 包含 Business Registry、memory 與 wrap-up v2 三種 release units；Business Registry 5 commits 尚未形成 topic-only follow-up PR。
3. Analytics A2/A5 handoff 的 upload／coverage 敘述與 Pulse current contract 漂移，需 targeted sync。
4. 尚未取得 production pull/deploy 授權；HTTP、Range、404 與 browser QA 皆無證據。

## Next-session entry

- **Target repos / branches**：Pulse `codex/business-registry-common-addresses`；Analytics `codex/business-registry-production`。
- **第一個可執行步驟**：把兩 repo 的 Business Registry 變更隔離成 topic-only follow-up branches／PRs；不要整支目前的 mixed-scope Pulse／Analytics branch 直接發布。
- **Merge 後**：取得 deploy 授權，pull 12 個 immutable assets、部署、做正式站 HTTP 200/206 與 404 probe。
- **Browser acceptance**：All Off 起手；驗 B1/A4 overview-detail split＋公司名稱、B2 三尺度、B4 threshold＋總資本額、A1 overview-detail、A2/A5/A6 popup/legend、dark-map 可讀性與 console/network 0 error。

詳細待辦與 acceptance criteria 見 `BACKLOG.md` 的 BR/WU 區；完整資產／coverage 見 `DATA_SCOPE.md`。
