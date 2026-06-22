# Status

**最後更新**：2026-06-22 下午（化石燃料 14 layer + 加油站 30km coverage + accessibility-analysis SKILL 落地）
**Master head**：本地 26 commits ahead origin（待 push + PR + merge）
**gis-platform main head**：已 sync（migration 242 已 merged 為 c58c335）
**Open branches**：無（一切在 master）

## 2026-06-21~22 本 session 完成

**用戶定向**：能源 v2 化石燃料 13 layer sidebar toggle（先做）→ 加油站視覺化討論 → OSRM/可達性分析（後段大宗）→ SKILL 化整理。

### 完成清單

| 段 | 內容 | Commit |
|---|---|---|
| **化石燃料 14 layer** 3 段 SOP | types + loader + hook / overlay + params + sidebar / popup + legend + interaction + test | efa7a16 → 2631812 → 494221e |
| **配色 / 互動微調** 5 commits | 9 色 palette → 10 色 → 加油站藍綠系 → 加油站放大 + outline + industrial halo | 27c4595 → e27cddd → 1ef5bdf → bbdbb93 |
| **facPrimary 白光暈** | 主要電廠 halo 從燃料色改 #ffffff + 半徑放大 25% | 872b21b |
| **345 kV 桃紫嘗試 → revert** | #1AB6D9 → #D707F2 試了不喜歡換回 | b084990 → 15e5546 |
| **加油站 30km coverage** 4 段 | 雲林 POC hex → PMTiles LineString → EV 同色 → 全台 motorway-tertiary | 702e382 → 8b0faf2 → 3376314 → afbf15d |
| **BACKLOG +CV 系列** | 9 條未來路線（CV-1~9，含 B 版加密 / osmium 預過濾 / OSRM 雲端 / pgRouting）| bd25af8 |
| **accessibility-analysis SKILL 落地** | 主檔 10 章 + scripts/pipeline-template.py + 4 個 references（pitfalls / mode-comparison / mirror-fallback / troubleshooting）+ service-coverage alias | 02a6bd8 |
| **multi-bucket + whitelist 修正** | 雙品牌 73 站歸多 bucket（台糖 13→86）+ whitelist 過 374 false positive（其他 665→292）| 7f8f005 |
| **SKILL 兩大鐵則升級** | §⚠️ multi-bucket / whitelist + §9 ★ MUST checklist | 17c148b |
| **SKILL 加 troubleshooting.md** | 卡了怎麼辦：跑前 30 秒 + 卡時 5 分鐘 + 寫法守則 + 本 session 卡點實錄 | df3f72a |

### Memory 8 個 atomic commits

ea8de59 PRINCIPLES / 350abf7 INCIDENTS / f84e911 GLOSSARY / 15616ee DATA_SCOPE / 2ba6b8d PLAYBOOKS / d1f4f70 BACKLOG / 2be6637 REFLECTIONS / 本 commit STATUS

### 最終驗證

- `npx tsc -b` 0 error
- `pnpm test --run` 155/155 pass 含 layerConsistency ratchet + featureInfoRegistry
- 加油站 30km coverage RPC `get_fossil_fuel_layers()` EXPLAIN 86ms
- 全台 osmnx motorway-tertiary 75,622 edges / 5 PMTiles 各 ~5 MB 跑 10 min

### 1 個重要踩坑（已收 PRINCIPLES + INCIDENTS）

**Overpass mirror 連環卡 8 小時 + OVERPASS_URL 拼錯 + CUSTOM_FILTER 沒對齊**（INCIDENTS 2026-06-22）：
- osmnx subdivide 32-way 任一卡死全卡，無 socket timeout → 8 小時 CPU=0% 等
- OVERPASS_URL 設 `/api/interpreter` osmnx 自動拼變雙拼 → 必須 base URL
- B 版 +unclassified 後忘記改回 A 版 filter，retry 又卡

**新規則**（PRINCIPLES 已寫）：
- 跑前 30 秒健康檢查（curl mirror + df + grep config）
- CPU=0% + alive 用 `sample <PID>` 看 stack 不要被動等
- 超過 30 min 無進度 → kill 不要等
- multi-bucket 用 Python list / whitelist 不用 NOT IN

### 留底（後續再評）

- 🟡 **CV-8 第 6 layer**「私營 最近距離」：`taiwan_other_nearest.pmtiles` 已備（292 站 whitelist），前端尚未接 toggle，~30 min 工程
- 🟡 **CV-2 B 版加密 +unclassified**：磁碟 25 GB free 還不夠（建議 ≥ 50 GB），osmium 已裝好（CV-3 路線可走）
- 🟡 **fossil fuel 14 layer 部分 polygon 在 zoom 低看不到**：已加 halo 補救 industrial 3 layer，但儲槽仍小
- 🟢 **18 + 8 = 26 commits 待 push + PR + merge** 本 session 全集中 master

### 下個 session 入口

```
本地 master 26 commits ahead origin（18 feature + 8 memory），未 push。

候選下步：
1. 直接 push + PR + merge 本 session 工作
2. 動 CV-8 — 第 6 個 layer「私營 最近距離」接前端（30 min，sourceUrl + paint + panel + legend）
3. 動 CV-2 — B 版加 unclassified（先清磁碟到 50 GB，走 osmium → pyrosm 路線）
4. 切其他主題：能源 Phase C 高壓電網 / Phase 8.6 PowerCard KPI / Places audit Critical spot-check

「我要做 X」→ 進 BACKLOG 找對應條目
「30km 路網 / 最近站 / 服務沙漠」→ invoke accessibility-analysis SKILL
「服務覆蓋 / 補點策略」→ invoke service-coverage SKILL（同 SKILL 商業視角）
```

---

## 2026-06-20 早 Energy Phase 8.2 — SSOT 24h RPC + drill-down + 變電所拆層（PR gis-platform #15 + mini-taiwan-pulse #27 merged）

**用戶定向**：接上輪 PR #26（Phase 8.1 + 6-layer 重構 + Three.js bloom）+ e625fb8 fmtMW fix，
延 brief 三件事 C → A → B 全跑 + 加碼變電所拆兩層。

### 完成清單

| 段 | 內容 | PR |
|---|---|---|
| **Backend** migration 238 | `cross_refs.realtime_facility_alias` schema + 13-row 對應表 + 改寫 `get_ssot_facility_output_24h()` 雙路線 UNION → **14 → 23 廠**（14 台電 + 6 離岸 + 3 離島） | gis-platform [#15](https://github.com/ianlkl11234s/gis-platform/pull/15) |
| migration 239 | `get_ssot_facility_units(facility_id)` 機組 drill-down RPC | 同上 |
| migration 240 | `all_power_plants_v` 改 SSOT alias（保 backward compat）+ DROP 2 個無 caller 的 legacy RPC | 同上 |
| **Frontend** PowerCard/Beam | loader 切 SSOT RPC、加 `facility_id` 欄；hit-test FC 改 `source_table='energy.power_facilities'`；comments 23 廠 | mini-taiwan-pulse [#27](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/27) |
| 機組 drill-down | `UnitDrillDownBlock` lazy fetch — popup 點廠列機組 (unit_name / cap / net_gen / util_rate%) 含負載率配色 | 同上 |
| 變電所拆兩層 | 從 `osmSubstations` 單層 785 → `osmSubstationsEhv` 38（含 halo）+ `osmSubstations` 747；overlayRegistry / Legend / sidebar / params slider / interaction 9 檔同步；命名對齊「發電廠（XXX）」 | 同上 |
| **Audit** Task C | Places API (New) v2：581 廠 Pass 62 / Review 31 / Critical 488（多 GEM 通用名 false positive）。v1 Geocoding fallback 已棄。$20.99 | 同上 |

---

## 過往里程碑（保留摘要）

- **2026-06-19 晚** Energy v2 Phase A + B autonomous run（feat/energy-v2-A 5 commits，已 PR merged 為 #28）
- **2026-06-18~19 早** Energy MVP v1.0~v1.3.5（PR #23 + #10 + #24）4 layer + popup + sparkline + timeline scrub + 6 sliders
- **2026-06-18** Design System Phase 0-6 上線（PR #22，9 commits）— `src/styles/designTokens.ts` SSOT
- **2026-06-18** Monitor / News 效能優化（PR #21，6 commits）— React.memo + useWallClock + fetch 30s→60s

更早完整記錄見 git log + .claude/pitfalls/。
