# Status

**最後更新**：2026-08-27（GFW v3 production truth／東亞 v4 implementation handoff）

> 本檔只保留當前 release truth、blockers 與下一棒。功能契約以
> docs/features/global-maritime/handoff.md 為 SSOT；歷史工作留在 git 與其他 memory 檔。

## Scope ledger

| repo / system | current truth |
|---|---|
| **mini-taiwan-pulse root worktree** | feature／handoff baseline dceae6d 已在 origin/master；本次只追加兩顆尚未 push 的 wrap-up memory commits。目標 memory paths 在收尾後乾淨 |
| **mini v4 worktree** | /private/tmp/mini-taiwan-pulse-gfw-v4-bench-20260827，branch codex/gfw-v4-browser-bench、base dceae6d；final audit 已看到該 session 自己新增的 benchmark untracked files，工作進行中。其狀態不由本 worktree 修改、同步、commit 或合併 |
| **data-collectors** | main@a8f3d52、working tree clean、相對 upstream behind 1；本輪未同步。v4 第一個實作落點是另開 isolated worktree 的 24 小時 shadow POC |
| **gis-platform** | main@84a1500、working tree clean、相對 upstream behind 1；本輪未同步。只有 POC 證明需要 DB/RPC contract 時才加入 v4 路徑 |
| **taipei-gis-analytics** | master@63faf63、ahead 2／behind 9；business-registry／noise 平行 session 的 tracked 與 untracked paths 持續變動，本輪完全未碰、也不假設其數量固定。v4 contract freeze 後才從 clean worktree 補 ADR／handoff |
| **production v3** | full-fidelity shadow release 2026-08-21 可讀；current bbox 122.434,23.22953,132.85274,34.35812、3,311 assets、993,557,709 bytes。canonical v2 仍是 rollback path |
| **East Asia v4** | accepted planning only；沒有 build、artifact、upload、deploy 或 browser evidence，production v2/v3 未變更 |

## Current production truth — GFW v3

- migrations 376／377 已套 production；frontend／collector contract、tests 與 production build 已完成。
- v3 產物涵蓋 2026-08-15..21 UTC；full audit 為 3,311／3,311 HEAD 成功，沒有 missing、
  head error、bytes 或 SHA mismatch。
- 2026-08-27 live manifest readback：schema 3、release 2026-08-21、3,311 assets、
  993,557,709 bytes。
- production browser 的 Grid／Tracks／timeline／latest-data notice 由使用者於 2026-08-26
  確認；不是本次 2026-08-27 agent 重新跑的 browser acceptance。
- GFW HIGH 是 hourly grid-center observations；軌跡內插與格網 footprint 是前端／exporter
  視覺語意，不是 raw AIS 座標或官方 cell boundary。
- canonical v2 與 v3 immutable assets 均不得在 v4 POC 階段原地覆寫或刪除。

## Frozen East Asia v4 product boundary

- bbox：115.93462,20.36314,134.73486,36.52495。
- gfwHourlyGrid：只發布 0.1° presence polygons，完整保留 cell/hour 的 unique vessel members；
  Grid 有時間軸與 H/H+1 crossfade。
- gfwHourlyTracks：與 Grid 分離；selected-day preload、依 vessel type 拆 day packs、
  Three.js instanced vessel heads／preallocated trails、本機 timeline interpolation。
- vessel-type filter 必須控制 asset attach/download；只做 client visibility filter 不算傳輸優化。
- gfwFishingEffort：第三個獨立 layer，呈現 apparent fishing hours；不可由 presence 改名代替。
- SAR unmatched：第四個獨立 layer；固定標示為「SAR 未與 AIS 匹配」，不是確認關 AIS、暗船或違法認定。
- spatial shards／time-sliced MVT 是 conditional Phase 2；只有 truthful day packs 在 desktop／mobile
  heap 與 frame gates 不達標時才加入。

## Release truth matrix

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| GFW full-fidelity v3 | done | done | done：immutable shadow | done：3,311 assets | done：manifest + full HEAD/hash audit | unknown：本輪未查 sync/container log | done：使用者 08-26 live page 確認；本輪未重跑 deploy job | done：08-27 live manifest | done：使用者 08-26；非本輪 agent run |
| East Asia 0.1° v4 | not run | not run：只有 planning freeze | not run | not run | not run | not run | not run | not run | not run |

## Current blockers / next-session entry

1. **先做 24 小時 upstream shadow POC，不切 production**：在 data-collectors isolated worktree，
   用 exact v4 bbox 比較 GFW LOW 0.1° 與 HIGH→本地聚合 0.1°。
2. **第一個 contract gate 是 identity parity**：unique vessel-hour set、popup identity fields、null rates、
   duplicates/conflicts 與 missing-member report。LOW 只有完整保留身分與 popup fields 才可直用；否則
   private fetch HIGH，再只發布 derived 0.1° product。
3. **POC artifacts**：24 小時 Grid PMTiles/detail、依船種拆分的 Tracks day packs、一天 Fishing Effort
   sample；全部 local shadow，不 upload。
4. **效能 gate**：記錄 request/page/tile counts、wall time、bytes、retry／429／524、peak RSS、encode；
   browser 比 compressed JSON 與 binary day-pack 的 transfer、decode、heap、scrub 後 cache 與 frame p95。
5. **契約凍結後才進跨 repo 實作**：analytics ADR／handoff → platform（僅有 DB/RPC 需求時）→
   collectors lifecycle → mini frontend。任何 upload／deploy／HTTP／browser 在完成前都維持 not run。
6. 新 session 已有 mini frontend benchmark worktree；root session 不應切它的 branch、同步它或替它 commit。

## Verification boundaries

- 本次 wrap-up 只做 repo/worktree read-only audit、全文 memory routing 與兩個 atomic memory commits；
  沒有改 application code、沒有重跑 build/test、沒有呼叫 GFW API，也沒有 production mutation。
- v3 live manifest／asset audit 是 handoff 已記錄的 2026-08-27 證據；production browser 是使用者
  2026-08-26 的確認。兩者都不可拿來代替 v4 POC 或 v4 browser evidence。
- capacity table（約 134k／401k／802k vessel-hours/day 等）仍是由 current v3 inventory 外推的 planning
  estimate，不是 East Asia encoder 實測；真正 contract 必以 24 小時 POC 為準。
- root worktree 的 memory commits 尚未 push；是否發布必須另取得使用者對 exact refspec 的同意。
