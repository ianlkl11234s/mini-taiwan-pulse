# Status

**最後更新**：2026-08-06~09（EM-16 翻案 → embed 動態回放上線；**PR #118 待 owner 審**）

| repo | 狀態 |
|---|---|
| **mini-taiwan-pulse** | `master` = `b92e335`（＋本批 memory commits 未 push）。⏳ **PR #118 OPEN**（`feat/embed-replay` → master，14 commits，head `869b39c`） |
| **data-collectors** | `main` = `0ceacd7`（**PR #47 merged 且已部署**：nightly trails 匯出，每日 02:00） |
| **gis-platform** | `main`（本 session 無變更、無新 migration） |
| **taipei-gis-analytics** | `master`（本 session 無變更） |

> ⚠️ **工作區注意**：master 上有未追蹤的 `public/embed-rail/`（rail_slim.json.gz 367KB 產物）。
> 它的 gitignore 行在 `feat/embed-replay` 上，**#118 merge 後才會進 master** → 在那之前**不要 commit 它**。
>
> ⚠️ **本 session 最該記住的一件事**：`docs/proposal/embed-dynamic-layers.md` §6-1 寫的
> 「Three.js 圖層不做」是**錯的結論**，已於 §9（D-1~D-4）翻案並實作完成。
> 自己寫的決策文件會過期 —— 翻案要靠逐檔實測，不是重讀文件（詳 REFLECTIONS 2026-08-06~09）。

## 1. EM-16 翻案 → embed 動態回放（PR #118，**待審**）

起點是 owner 問「嵌入功能做到哪、能不能把動態圖層做進去」，用途指定為**文章**（要「動」且內容凍結）。

**翻案的三條實測證據**（非推論）：
- 三顆引擎皆**純 TS 零渲染依賴**：`RailEngine` 171 行 / `TraTrainEngine` 314 行 / `BusEngine` 741 行，無 three / mapbox-gl / React
- 渲染層對 mapbox 的**執行期**綁定只有 `src/utils/coordinates.ts` 一支（`customLayer.ts` 是 type-only import）
- **MapLibre × Three.js spike PASS**：與 `map.project()` 數值誤差 ≤0.01px（z7–z10 × pitch 45/60 × bearing × altitude 80km 全過）。兩家 `MercatorCoordinate` 實測 bit-identical

**已上線的三層回放**（快照皆凍結 2026-08-06）：flights 522KB / ships 4.78MiB（12,305 列）/ rail 229KB。
rail 是**時刻表推算型**（與 flights/ships 的軌跡插值型不同）：吃 `reference.daily_schedules`
（tra_daily 907 班 + thsr_daily 160 班，**永久累積不過期**），捷運四家吃 `*_fixed`；
幾何走日期無關共用資產 `public/embed-rail/rail_slim.json.gz`（**68MB → 367KB，縮 190x**）。

**其他成果**：`rsys=` 系統單選（新 URL 一等公民，未知值全 drop 後顯示全部、**不白畫面**，不升 `URL_STATE_VERSION`）／
多層共時鐘（修掉 Phase 1 的「只取第一個回放層且每次重設時鐘」結構缺陷）／
三份圖例（Ships 6 類船種、Rail 隨 `rsys` 收斂、Flights 單條）／
示範頁 `demo-embed.html` 11 張卡（含北捷 08:00、高雄輕軌 17:00，帶 `p.speed=180`）。

**驗收**：`npx tsc -b` 過 · vitest **399 passed / 1 skipped / 0 failed** ·
build 後 `dist/assets/embed-*.js` 內 `WebGLRenderer`/`InstancedMesh` 出現 **0** 次 ·
列車貼軌近景 z13.5 實測確認。

**上生產供檔已接好**（S3 → pull → nginx）：`/embed-snapshots/` 維持 1y immutable（檔名含日期）；
**新增的 `/embed-rail/` 刻意不用 immutable**（固定檔名、隨管線重跑更新）→ `expires 1d` + public。
`Content-Encoding` 決定不設，由前端讀 magic byte 判斷解壓。

> ⏳ **owner 待辦：review + merge PR #118**。合併 master 時衝突僅 2 處
> （`.gitignore` 與 `pull-deploy-assets.sh` 的 mkdir 單行，雙方各加一項），已保留兩邊解掉。

## 2. nightly trails 保存層（data-collectors PR #47，**已 merged 並部署**）

動機：retention 正在吃資料（bus / bus_intercity **3 天**、ships / flights **7 天**），
每天不匯出就永久流失一天。

- `scripts/export_daily_trails.py` → `s3://migu-gis-data-collector/trails/<dataset>/<date>.<arrow|json.gz>` + manifest
- 排程 **每日 02:00 Asia/Taipei**（實測資料 D+1 01:00–01:20 才定版）；
  `TRAILS_EXPORT_ENABLED` 預設 false（manifest 非原子，多實例互蓋）
- 日總量 ≈ 76MB → 月增 2.3GB；滿一年 ~US$0.69/月、首年合計 ~US$4.5
- ✅ 回補：ships / flights 各 **8 天**（07-31~08-07）、bus 系 **3 天**（08-05~08-07）
- 🔴 **已永久救不回**：bus / bus_intercity 的 **08-04**、ships / flights 的 **07-30**
- ⚠️ 漏跑的一晚**不會自動補** → 偵測靠 Telegram 🧊/🚨、恢復靠手動 `--backfill N`

> 🔒 **鐵則**：`trails/` 是**保存層**，不在 `deploy-assets/` 下、不經 nginx／Cloudflare。
> **前端直讀 S3 是錯的**（egress $0.114/GB — 36MB 的 bus 日檔讀 1,000 次 ≈ $4/月，
> 超過它整整一年的儲存費）。要畫圖必須先加工成成品包。

## 3. 下一步

0. ⏳ **PR #118 review + merge**（owner）。merge 後 `public/embed-rail/` 的 gitignore 行才會進 master
1. **DS-06（新，P1）**：ships 日筆數 8 天內 17,500 → 7,224 **單調下滑 −39%**，疑 AIS collector 退化 → 要查
2. **EM-17（P2，現在就在付錢）**：`public/static-rpc/` 缺 `get_gas_station_layers.json`
   → 主站 loader 一路靜默 fallback 打 Supabase RPC。EM 系列裡優先級最高
3. **DS-01（等上游）**：台電落雷恢復時把 `LIGHTNING_EVENTS_INTERVAL` 調回 `1`（collector 會發 Telegram 提醒）
4. embed 後續：**EM-24 bus 渲染**（owner 拍板暫緩，資料已保存、隨時可做）／EM-25 scrubber
   （`replayClock.seek()` 已備好，UI 加一條 range 即可）／EM-26~29
5. **G018（新）**：折返幾何 artifact 回饋軌道資料上游（`trtc/LB-1-0` 證明問題不只出在 merge 接縫）
6. 既有：DS-02~05、FE-01、PA-1/5~8、G013/G016/G017、MC-1~5、EQ-1

> 各系列細節一律看 BACKLOG.md 與對應的 `docs/features/<slug>/backlog.md`，本檔不重述。

---

## 歷史 session 索引（細節已各有 canonical home，本檔只留一行）

| 日期 | 主題 | 細節在哪 |
|---|---|---|
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

_本 session memory commits_：GLOSSARY / INCIDENTS / PRINCIPLES / PLAYBOOKS（PB-34 + PB-35）/
REFLECTIONS / DATA_SCOPE / BACKLOG + 本檔
