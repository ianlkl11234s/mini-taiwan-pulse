# Status

**最後更新**：2026-08-10（監看模式排版八/九版 **PR #121 merged 並 push**；沙盒原始碼進 repo）

| repo | 狀態 |
|---|---|
| **mini-taiwan-pulse** | `master` = `84a0275`（＋本批 memory commits 未 push）。**PR #121 merged**，分支已刪，工作區乾淨 |
| **data-collectors** | `main` = `0ceacd7`（PR #47 merged 且已部署：nightly trails 匯出，每日 02:00） |
| **gis-platform** | `main`（近兩 session 無變更、無新 migration；⚠️ 記錄的 gis-wiki submodule SHA 落後 → G021） |
| **taipei-gis-analytics** | `master`（近兩 session 無變更） |
| 其餘 7 repo | 2026-08-10 上一輪已全面收尾，**11 個 repo 全部零未提交、零未推送** |

**正式站**：`https://mini-taiwan-pulse.itsmigu.com`
（Zeabur project `mini-tw-pulse`，service `69a3b5f307e6de1869be6e2c`）

## 1. 監看模式排版八/九版（PR #121 `da054f0`，11 檔 +2348/−108）

起點是「這個沙盒 artifact 跟實機一致嗎」，做到排版機制重寫。

**九版：高度改跟內容走。** 新增 `monitorPacking.ts` —— 把 12 欄座標 guillotine 切成欄／列
巢狀結構（找沒有 widget 跨過的切線：縱向切＝並排的欄、橫向切＝上下堆疊），欄內用 flex 直向流。
CSS grid 的列跨欄共用，做不到「這格長高、下面的推下去」，所以才要拆。
切不開的形狀（風車形互卡）退回固定列高網格，`monitorPacking.test.ts` 5 條守著。

`MonitorGridItem` 加 `fit?: "content"`：**11 個資訊卡**高度跟內容走；
**5 個清單／影音類**（新聞 Feed／警報／時間軸／熱區／信號分級）維持 `h` 固定高＋格內捲
—— 放開會被幾百筆內容拉成無限長。fit widget 的 `h` 從此只是拆解與同欄排序的佔位值。

實測（1920×1200）：`erCongestion` 740（捲 423）→ **1163 完整展開**、`powerCard` 690→241、
`hazardStrip` 390→338、`liveWall` 690→659、`situationOverview` 240→191；死白全消，
除刻意固定高的 `alertBoard` 外無格內捲。1000×1200 堆疊模式另量一輪，零重疊。

**八版：版面。** TAIEX 從 `SituationOverview` 拆出成獨立 widget `taiex`（`0,17,5×3`），
日線 sparkline 150×24→360×48；PLA 趨勢柱狀圖 54→190px、空域方位（4 列）與侵擾方式（5 列）
由兩欄改單欄；食品價格走勢圖 34→140px。

**PLA 趨勢圖區間 pills**：120D/90D/30D/7D。**只換顯示區間，不動嚴重度分級**
（分級仍是近 120 天滾動百分位，是這塊板的核心語意）；柱高比例改用所選區間的最大值，
圖下同時印本區間統計與 120 天分級基準。無額外 RPC（前端切尾段）。

**沙盒原始碼進 repo**：`docs/features/monitor-grid-static/sandbox.html`
（= artifact `f5d75312-…` 的來源）。先前只活在 artifact 上，已漂掉兩版
（缺 `foodPriceBoard`、rowHeight 用浮動值）。換版 SOP 見 PB-30，**改 repo 那份再發布**。

⚠️ 兩個 flex 陷阱寫進 PRINCIPLES：帶 `viewBox` 的 svg 會用「寬×內建長寬比」自算高度撐爆格子；
`height: X%` 在 auto 高度鏈上塌成 0（PLA 柱狀圖全白，`2720b72` 修）。
**後者是我的溢出量測抓不到的失敗模式**，見 REFLECTIONS。

## 2. 上一輪 embed 三 PR（#118/#119/#120，2026-08-09/10）

三個 PR 全 merged 並在正式站驗證通過（6/6、6/6、PASS）。細節見 INCIDENTS 2026-08-09/10、
PRINCIPLES（版本閘門代價比範圍／immutable 只給含雜湊的檔名／deploy 前探測加 cache-buster）、
PB-06g。**EM-30 的觀察期從 08-10 起算。**

## 3. 下一步

1. **EM-17（P2，現在就在付錢）**：`public/static-rpc/` 缺 `get_gas_station_layers.json`
   → 主站 loader 一路靜默 fallback 打 Supabase RPC。**08-10 覆核仍未解**，EM 系列裡優先級最高
2. **DS-06（P1）**：ships 日筆數 8 天內 17,500 → 7,224 **單調下滑 −39%**，疑 AIS collector 退化 → 要查
3. **EM-30（P2）**：rail 降級安全網移除 —— 條件已達成，**建議觀察數日再做**；
   三件一起：`fetchRailGeometry()` fallback、`RAIL_GEOMETRY_LEGACY_URL`、S3 舊固定檔
4. **EM-31（等上游）**：`build-rail-slim-bundle.py` 補齊 `line_id` 後刪 `railLineIdOf()` fallback
5. **G020（P2）**：Cloudflare scoped purge（現在只有 `purge_everything`，會連 297MB 底圖一起清）
6. **G021（P3）**：gis-platform 的 gis-wiki submodule SHA bump
7. **DS-01（等上游）**：台電落雷恢復時把 `LIGHTNING_EVENTS_INTERVAL` 調回 `1`
8. embed 後續：EM-24 bus 渲染（owner 拍板暫緩，資料已保存）／EM-25 scrubber／EM-26~29
9. 既有：DS-02~05、FE-01、MG-1~3（皆 P3）、PA-1/5~8、G013/G016/G017/G018/G019、MC-1~5、EQ-1

> 各系列細節一律看 BACKLOG.md 與對應的 `docs/features/<slug>/backlog.md`，本檔不重述。

---

## 歷史 session 索引（細節已各有 canonical home，本檔只留一行）

| 日期 | 主題 | 細節在哪 |
|---|---|---|
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

_本輪 memory commits_：INCIDENTS / PRINCIPLES / PLAYBOOKS(PB-30 改寫) / REFLECTIONS / BACKLOG + 本檔。
DATA_SCOPE 本輪無變動（純前端排版，無資料／表結構異動）；
GLOSSARY 刻意不加（`fit:"content"`／guillotine 拆解在程式碼註解、feature README、PB-30 三處已有 canonical 出處）。

_2026-08-10 補_：孤兒分支 `memory/wrap-up-funeral-integration`（2026-08-06 分岔，10 個 memory commit
從未合回）的知識沉澱已增量搬入 INCIDENTS／PRINCIPLES／DATA_SCOPE／GLOSSARY／PLAYBOOKS(PB-36)／
REFLECTIONS／BACKLOG ＋ `docs/features/funeral-layers/{backlog,changelog}.md`。
分支本體的 STATUS 內文已被之後 44 個 commit 追過，**不搬**，只補上表這一列索引。
