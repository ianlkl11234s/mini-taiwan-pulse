# Status

**最後更新**：2026-08-10 深夜（**結構稽核 → 8 批執行 wave，7 PR 一日全 merged**（#123~#129）；gas 快照上 S3；AR-21 試點上線）

| repo | 狀態 |
|---|---|
| **mini-taiwan-pulse** | `master` = `d34497f`＋wrap-up memory commits（未 push）。**PR #123~#129 全 squash merged**，工作區乾淨；本地分支僅剩 master + 2 支刻意保留的 monitor 分支（見 G015） |
| **data-collectors** | `main` = `0ceacd7`（無變更） |
| **gis-platform** | `main`（無變更；⚠️ gis-wiki submodule SHA 落後 → G021） |
| **taipei-gis-analytics** | `master`（無變更） |
| 其餘 7 repo | 2026-08-10 上一輪已全面收尾 |

**正式站**：`https://mini-taiwan-pulse.itsmigu.com`
（Zeabur project `mini-tw-pulse`，service `69a3b5f307e6de1869be6e2c`）

## 1. 結構稽核（報告：`docs/research/architecture-audit-2026-08-10.md`）

4 平行 agent（規則違反／效能資產／架構／死碼）＋主 agent 逐項 spot-check。四句話結論：
**壞損全在測試蓋不到的縫**（最大條 16 圖層無圖例）；**閒置成本 ≈ 0**（boot-lazy 系統性成立）；
**疊床架屋直覺大多不成立**（overlayRegistry／LegendPanel／三 registry 判「不是債」，
唯一主嫌 `useTransportParams` 644 useState）；**過度設計幾乎不存在**（反而是抽象沒推廣）。
新發現 → BACKLOG AU-1~9；07-02 審計對帳 → `docs/proposal/architecture-overhaul-plan.md` 檔頭。

## 2. 執行 wave（8 批，7 PR 全 merged + 2 波 master 直 commits）

- **#123** 圖層預設全關（DEFAULT_ON 清空）＋ Layers 入口紅點導引
- **#124** 機械修七項（ratchet filter 漏洞／bindTimer gate／deck.gl＋**雙 lockfile 同步**／4 孤兒檔／tour 色表三邊收斂）
- **#125** gas embed 5 品牌拆層；**快照已上 S3（22:40）**，EM-17 剩 prod 探測結案
- **#126** rail boot 後開啟補 loading pill
- **#127** 19 圖層圖例補齊＋AqiLegend 收編（逐 key 紅→綠；7 個真單色補豁免註解）
- **#128** 監看 hazard 4 卡（颱風/地震/輻射/落雷，monitorPacking 新架構；落雷誠實標斷供）
- **#129** **AR-21 visibility store 試點**（單一 state 來源 bridge＋2 consumer＋22 測試；行為零變化已驗證、re-render 收益待 AR-23）
- master 直 commits：殯葬孤兒分支記憶救援（10 commits）＋文件帳本同步（7 commits：AU 登記／AR 對帳／dev-rules §4 觸點表 7→14 檔／rpc_audit 標歷史快照）

驗收：整合分支零衝突、tsc ✅、451→473 測試全綠、agent-browser 逐項截圖（badge／圖例／4 卡／loading pill／AR-21 行為抽查）。
四個踩雷事件（lockfile 險爆／稽核前提錯誤×2／agent 斷線×3／flake 結案）→ INCIDENTS 2026-08-10 稽核執行 wave 段。
多 agent worktree 開發 SOP 定型 → **PB-37**。

## 3. 下一步

1. **EM-17 最後一哩**：等 Zeabur 重建完成（#123~#129 連環 push 已觸發），帶 cache-buster 探測
   `prod /static-rpc/get_gas_station_layers.json` → 200 即結案（fallback egress 同時停止）。
   上傳當下舊容器 404 屬預期，**勿探測裸 URL 以免 CF negative cache**
2. **AR-22/23（結構工程主線下一步）**：Layer Manifest 試點 → 全量遷移（AR-21 的 per-key 收益在此兌現）→ AR-24 退役 useTransportParams
3. **DS-06（P1）**：ships 日筆數 −39% 單調下滑，疑 AIS collector 退化 → 要查
4. **AU-6（P1）**：單一 lockfile 政策拍板（兩份已同步、鐵則已立，剩決策）
5. **EM-30**：rail 降級安全網移除（觀察期中）；**EM-31**（等上游）
6. **G020**（CF scoped purge）／**G021**（submodule bump）／**DS-01**（台電落雷恢復調 interval）
7. 稽核衍生 P2/P3：AU-1~5、AU-7~9（三邊色彩測試／glow 收斂[併 BE-2]／dayPrefetch／toMercator／死 export／knip config／食品價格四件套／GIS_LAYERS 反向守門）
8. 既有：DS-02~05、FE-01、MG-1~3、PA-1/5~8/10、G013/G016/G017/G018/G019、MC-1~5、EQ-1

> 各系列細節一律看 BACKLOG.md 與對應的 `docs/features/<slug>/backlog.md`，本檔不重述。

---

## 歷史 session 索引（細節已各有 canonical home，本檔只留一行）

| 日期 | 主題 | 細節在哪 |
|---|---|---|
| 2026-08-10 深夜 | 結構稽核 → 8 批執行 wave（7 PR #123~#129；圖例補齊／hazard 4 卡／AR-21 試點／gas 上 S3） | `docs/research/architecture-audit-2026-08-10.md` + INCIDENTS/REFLECTIONS 同日 + PB-37 |
| 2026-08-10 | 監看模式排版八/九版（PR #121；高度改跟內容走、TAIEX 拆板、沙盒進 repo） | `docs/features/monitor-grid-static/` + INCIDENTS/REFLECTIONS 2026-08-10 + PB-30 |
| 2026-08-06~09 | EM-16 翻案 → embed 三層動態回放（推翻 proposal §6-1「Three.js 圖層不做」；三顆引擎皆純 TS、MapLibre×Three.js spike 誤差 ≤0.01px） | INCIDENTS 2026-08-06~08 + REFLECTIONS 同期 + PB-34 |
| 2026-08-08 | nightly trails 保存層（data-collectors PR #47，每日 02:00；日 ~76MB、首年 ~US$4.5。bus 08-04 與 ships/flights 07-30 **已永久救不回**） | DATA_SCOPE §保存層 + PB-35 |
| 2026-08-06/07 | 資料源健康三連查 + 落雷雙源（10 PR 全 merged；共機航跡斷 5 天／台電落雷斷 28 天／警政署 A1 停更 6 週，皆無告警） | `.claude/pitfalls/2026-08-07-silent-upstream-outage.md` + INCIDENTS 2026-08-07 |
| 2026-08-05/06 | 殯葬 Funeral 5 層（PR #107，A/B/C 三源分開）＋ `is_active` 遷他縣市修正（PR #110）＋ 食品價格監測板（PR #109）＋ 收孤兒 repo `tw-address-geocoder` | `docs/features/funeral-layers/` + INCIDENTS/REFLECTIONS 2026-08-05/06 + DATA_SCOPE §殯葬 + PB-36 |
| 2026-08-03~05 | 可嵌入地圖 EM 系列（PR #105/#106；MapLibre + 自託管 Protomaps → Mapbox 費用 0） | `docs/features/embeddable-map/` |
| 2026-08-02/03 | 共機全鏈上線（四 repo 全 merged，PR #104 + mig 330~333） | `docs/features/pla-activity/` |
| 2026-07-29~31 | 地震回放 earthquakeReplay（PR #98 + mig 324） | `docs/features/earthquake-replay/` |
| 2026-07-29~31 | 溫度三部曲（溫度網格 2D / LASS 微感測 / 都市熱島 LST，PR #92/#94/#96） | INCIDENTS 2026-07-29~31 + analytics LST 方法論 |
| 2026-07-26/27 | monitor 修復→網格改版→ER 深化→直播牆重生（PR #89/#90/#91 + mig 318~320） | PB-30 + INCIDENTS 2026-07-26/27 |
| 2026-07-23/24 | 觀光 Tourism 12 圖層（PR #82/#83） | `docs/features/tourism-layers/` |
| 2026-07-22 | 建物夜景燈光 + bloom + timeline setState-in-render 修正（PR #78/#79/#80） | `docs/features/buildings-night-lights/` |
| 2026-07-17 | 公共設施 8 圖層批次 | `docs/features/civic-facilities-layers/` |
| 2026-07-15 | 都市樹木 7 圖層批次 | `docs/features/tree-layers/` |
| 2026-07-09/10/11 | 即時資料補接三批（急診＋好行／路況省道／停車 hybrid v1） | `docs/features/{er-hospital,tourist-shuttle,road-congestion,parking}/` |
| 2026-07-07 | owner-gated 資料真鎖三階段 + 安全審計（mig 275~279） | `docs/features/owner-gated-layers/` |
| 更早 | — | `git log -- .claude/memory/STATUS.md` |

---

_本輪 memory commits_：INCIDENTS / PRINCIPLES ×2 / PLAYBOOKS(PB-37) / REFLECTIONS / BACKLOG（wave 對帳）+ docs(embeddable-map backlog / proposal AR-21) + 本檔。
DATA_SCOPE 刻意不動（gas 快照屬供檔 artifact，canonical 在 EM feature backlog）；
GLOSSARY 刻意不加（visibility store／AU 系列在 code 註解、plan、BACKLOG 已有 canonical 出處）。
