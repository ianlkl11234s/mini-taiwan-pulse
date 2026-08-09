# Status

**最後更新**：2026-08-10（embed 三 PR **全部 merged 並在正式站驗證通過**；跨 repo 全面收尾）

| repo | 狀態 |
|---|---|
| **mini-taiwan-pulse** | `master` = `2dd11e6`（＋本批 memory commits 未 push）。**PR #118/#119/#120 全 merged**，工作區乾淨 |
| **data-collectors** | `main` = `0ceacd7`（PR #47 merged 且已部署：nightly trails 匯出，每日 02:00） |
| **gis-platform** | `main`（本 session 無變更、無新 migration；⚠️ 記錄的 gis-wiki submodule SHA 落後 → G021） |
| **taipei-gis-analytics** | `master`（本 session 無變更） |
| 其餘 7 repo | 見下方 §4 —— **11 個 repo 全部零未提交、零未推送** |

**正式站**：`https://mini-taiwan-pulse.itsmigu.com`
（Zeabur project `mini-tw-pulse`，service `69a3b5f307e6de1869be6e2c`）

## 1. EM-16 全鏈上線 —— 三個 PR、三次線上驗證

| PR | commit | 內容 | 線上驗證 |
|---|---|---|---|
| #118 | `54bd865` | embed 三層回放 + 上生產接線 | **6/6 PASS** |
| #119 | `5345128` | `rsys=` 擴充到營運者級 + 線路級 | **6/6 PASS** |
| #120 | `2dd11e6` | rail 幾何改內容雜湊檔名 + manifest | **PASS** |

**#118**：容器 `/data/embed-rail/rail_slim.json.gz` 366,717 B；flights 快照 522,150 B + `immutable`；
幾何 366,717 B + `max-age=86400`（無 immutable）；ships 5,014,213 B `gunzip -t` 完整；
三層瀏覽器冒煙 **Supabase 請求數 0**；Cloudflare 查無超過 1 天的 TTL。

**#119**：`trtc` 76 軌道/3,017 班（桃園中壢空白、淡水止於淡水站、頂埔不續往鶯歌 —— 皆為預期）、
`tymc` 8/329、`ntm` 10/1,170、`trtc-bl` 15/596、`krtc-r` 2/319（幾何落在高雄，**撞名解析正確**）、
`trtc-zz` 未知碼降級 141/6,663 **不白畫面**。主站 RailLegend 輸出**逐字未變**（零回歸）。

**#120**：manifest `max-age=60` 指向 `rail_slim.4e0dc14093.json.gz`
（366,819 B、`max-age=31536000, immutable`、無 Content-Encoding）；
端到端指紋 `gunzip -c | shasum -a 256` 與 manifest 記載的
`4e0dc14093e44182981de70ce00858ddf4aa0cfc5892ba12cfa67d6c3be76e14` **逐字元相符**；
瀏覽器 network **抓雜湊檔 1 次、舊固定檔 0 次**（降級未觸發）、Supabase 0；
同 session 二次取用 transfer=0（immutable 當場生效）。體積 366,717 → 366,819 B（+0.03%）。

## 2. `rsys=` 三種粒度（#119）

- **營運者級**：`trtc`(BR/R/G/O/BL) `tymc`(A) `ntm`(Y/V/K/LB) `krtc` `klrt` `tmrt` `tra` `thsr`
- **線路級**：一律帶前綴 `trtc-bl` / `krtc-r` —— 北捷與高捷都有 R/O，不帶前綴會撞名
- 混用取**聯集**；`tra`/`thsr`/`klrt` **刻意不給線路碼**（資料無線路概念，不發明查得到卻沒東西的代碼）；
  `trtc-mk` 貓空纜車刻意不在白名單
- SSOT = `src/constants/railLines.ts`；urlState / railReplayData / LegendPanel 共用 `resolveRailCodes`

⚠️ **`rsys=trtc` 是行為上的 breaking change 但刻意不升 `URL_STATE_VERSION`**
（94 軌道/4,516 班 → 76/3,017）：升版會讓**所有**舊嵌入碼整組作廢（含與 rail 無關者），
代價遠大於單欄語意修正，且 parse 結果本身沒變。有測試守舊網址逐欄不變。詳 PRINCIPLES。

## 3. rail 幾何內容雜湊（#120）

`rail_slim.<hash10>.json.gz` + 固定檔名指標 `rail-manifest.json`。

- manifest 選 `max-age=60` 而非 `no-cache` —— 它在**串行 critical path** 上，
  no-cache 讓每位讀者每次多付一個 RTT，只換來早 60 秒；
  60 秒陳舊窗因 `--keep 3` 保留舊檔而**天生無害**（舊 manifest 只指向仍存在的舊幾何，不是 404）
- 冪等三條件：canonical JSON / `generated_at` 移出 bundle / gzip `mtime=0`。實測連跑三次逐位元組相同
- 降級同時涵蓋 **manifest 失敗與 bundle 失敗**（整夾 sync 時 `rail-manifest.json`
  字典序在 `rail_slim.*` 之前，`-`0x2D < `_`0x5F，有 manifest 先落地的空窗）
- S3 端**不刪舊檔**（回滾前提）→ 移除安全網是 EM-30
- 流程 SOP 見 PB-06g；機制原理見 PRINCIPLES「immutable 只給含日期或內容雜湊的檔名」

## 4. 跨 repo 收尾（11 repo 全部零未提交、零未推送）

本輪新提交並推送：

| repo | 內容 |
|---|---|
| **ship-gis** | 港口 polygon 圖層／AIS gap 分析報告／配色實驗頁（3 commits）。⚠️ **該 repo 為 PUBLIC**，owner 已判斷 AIS OSINT 內容維持公開 |
| **plan-art** | FR24 API 文件 + 積壓（2 commits） |
| **mini-taipei-v3** | 深啊線手繪軌道工具 —— ⚠️ **尚未執行**，且躺在三鶯線分支上 |
| **`.gis-agent-system`** | ADR-0011 雲地 context 串接 + journal 補記 + W26 轉址（8 commits） |
| **gis-wiki** | CLAUDE.md 瘦身成規則卡 + 47 張 inbox 草稿卡。push 曾被拒（遠端有另一個 checkout 的 8/2 commit，來源是 `gis-platform/.gitmodules` 登記的 submodule），rebase 疊上零衝突 |
| **pulse-api** | 1 commit |

- **4 條 7 月的 monitor 實驗分支依 owner 決定留本機不推**
- 副作用：`gis-platform` 的 gis-wiki submodule SHA 現在落後 → **G021**

## 5. 下一步

1. **EM-17（P2，現在就在付錢）**：`public/static-rpc/` 缺 `get_gas_station_layers.json`
   → 主站 loader 一路靜默 fallback 打 Supabase RPC。**08-10 覆核仍未解**，EM 系列裡優先級最高
2. **DS-06（P1）**：ships 日筆數 8 天內 17,500 → 7,224 **單調下滑 −39%**，疑 AIS collector 退化 → 要查
3. **EM-30（P2）**：rail 降級安全網移除 —— 條件已達成（線上抓雜湊檔 1 次、舊固定檔 0 次），
   **建議觀察數日再做**；三件一起：`fetchRailGeometry()` fallback、`RAIL_GEOMETRY_LEGACY_URL`、S3 舊檔
4. **EM-31（等上游）**：`build-rail-slim-bundle.py` 補齊 `line_id` 後刪 `railLineIdOf()` fallback
5. **G020（P2）**：Cloudflare scoped purge（現在只有 `purge_everything`，會連 297MB 底圖一起清）
   ／或把 `/embed-rail/` 納入 Cache Rule
6. **G021（P3）**：gis-platform 的 gis-wiki submodule SHA bump
7. **DS-01（等上游）**：台電落雷恢復時把 `LIGHTNING_EVENTS_INTERVAL` 調回 `1`（collector 會發 Telegram 提醒）
8. embed 後續：EM-24 bus 渲染（owner 拍板暫緩，資料已保存、隨時可做）／EM-25 scrubber
   （`replayClock.seek()` 已備好，UI 加一條 range 即可）／EM-26~29
9. 既有：DS-02~05、FE-01、PA-1/5~8、G013/G016/G017/G018/G019、MC-1~5、EQ-1

> 各系列細節一律看 BACKLOG.md 與對應的 `docs/features/<slug>/backlog.md`，本檔不重述。

---

## 歷史 session 索引（細節已各有 canonical home，本檔只留一行）

| 日期 | 主題 | 細節在哪 |
|---|---|---|
| 2026-08-06~09 | EM-16 翻案 → embed 三層動態回放（推翻 proposal §6-1「Three.js 圖層不做」；三顆引擎皆純 TS、MapLibre×Three.js spike 誤差 ≤0.01px） | INCIDENTS 2026-08-06~08 + REFLECTIONS 同期 + PB-34 |
| 2026-08-08 | nightly trails 保存層（data-collectors PR #47，每日 02:00；日 ~76MB、首年 ~US$4.5。bus 08-04 與 ships/flights 07-30 **已永久救不回**） | DATA_SCOPE §保存層 + PB-35 |
| 2026-08-06/07 | 資料源健康三連查 + 落雷雙源（10 PR 全 merged；共機航跡斷 5 天／台電落雷斷 28 天／警政署 A1 停更 6 週，皆無告警） | `.claude/pitfalls/2026-08-07-silent-upstream-outage.md` + INCIDENTS 2026-08-07 |
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

_本輪 memory commits_：INCIDENTS / PRINCIPLES / GLOSSARY / PLAYBOOKS / BACKLOG / DATA_SCOPE + 本檔。
REFLECTIONS 本輪無新增（素材皆事實類，可複用規則已進 INCIDENTS `→ 通則` 與 PRINCIPLES）。
