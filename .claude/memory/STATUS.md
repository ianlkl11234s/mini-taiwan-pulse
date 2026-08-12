# Status

**最後更新**：2026-08-12（**Layer Manifest 工程完整交付**：PR #130 merged＋⑤④ 收尾＝**565 測試全綠零紅燈**）

| repo | 狀態 |
|---|---|
| **mini-taiwan-pulse** | `master` 已 push（#130 squash `e74a144`＋fireHydrants 改名 `b6f0e55`＋06_apply 對帳器 `d1f9479`＋本輪 wrap-up memory commits）。工作區乾淨；本地分支僅 master＋2 支刻意保留 monitor 分支（G015） |
| **data-collectors** | `main` = `0ceacd7`（無變更） |
| **taipei-gis-analytics** | ⚠️ **有平行 session**：3 個未推 commits（`d7b799c` 等）＋40 筆未提交改動——本 session 全程未碰、未代 push |
| **gis-platform** | `main`（無變更；gis-wiki submodule 落後 → G021） |

**正式站**：`https://mini-taiwan-pulse.itsmigu.com`

## 1. Layer Manifest 工程（AR-22/23/24，PR #130，2026-08-10 深夜~08-12）

14 棒 agent 接力、88 commits squash。**348 層 14 處手寫登記簿 → 單一 manifest 派生 6 張表；
336 key 滑桿參數 → 宣告式 spec＋通用 store；`useTransportParams`（3,160 行/644 useState）退役
→ `useLayerParamsRuntime` 570 行轉接層（useState=0）；layerConsistency 改守 manifest 完整性
（稽核 5 靜默失敗點解 4.5）；紅燈演練 4/4 實證會叫。**

- 品質證據：黃金快照 sha256 全程逐位元對帳（兩次合法重生有據）＋等值閘＋突變演練＋主樹零回歸＋瀏覽器滑桿端到端數學精確
- 全程軌跡：`docs/features/layer-manifest/overnight-log.md`（27 條時間軸）＋ `changelog.md`（14 棒實錄）
- **新增圖層新流程**：manifest entry＋spec 一筆＋邏輯檔（CLAUDE.md §5／`/new-layer` 已改版）
- 四事件（改名冤案／fall-through／ref 盲區／中斷矩陣）→ INCIDENTS 2026-08-11/12；SOP → **PB-38 黃金快照法**

## 2. ⑤④ 收尾（2026-08-12，未竟 8 條先清 2 條）

- **④ fireHydrants**：根因是上游 08-11 fire 三軌統一改名（`fire_hydrants`→`hydrants`），
  pulse manifest 同步（`b6f0e55`）→ **cross-repo 測試最後一顆紅燈熄滅，565/565 全綠**
- **⑤ 06_apply_to_pulse.py**：腳本實在 pulse 非 analytics（handoff 誤植已正），改寫成
  dry-run 對帳器（`d1f9479`）；dry-run 證明 manifest 比舊 CSV 新 → 今日禁 apply 的判斷正確

## 3. 下一步

1. **Layer Manifest 未竟 6 條**（SSOT：`docs/features/layer-manifest/backlog.md`）：
   AR-22 終點（消費端 per-key 訂閱＝效能兌現）／App.tsx hook 迴圈（最後半個靜默點）／
   4b legend-popup 派生化／NO_POPUP_LEDGER 57 筆考證／觸點 #20 五個部署缺口／spec 切檔警告牌
2. **建議手動點一輪**（單元測試有蓋、瀏覽器級未實測）：裁處事件播放鍵、indicators 級聯選單、行動版
3. **AR-12/13 snapshot-to-CDN**（O(N)→O(1) 讀取主線，需拍板 D-A=R2）；AR-14~16 供檔端
4. **DS-06（P1）**ships −39% 下滑查 collector；**AU-6（P1）**單一 lockfile 政策；**BC-4a** OAuth 網域確認
5. 既有系列照 BACKLOG：EM-30 觀察期／G020/G021／DS-01~05／AU-1~9 其餘／MC-1 等

> 各系列細節一律看 BACKLOG.md 與 `docs/features/<slug>/backlog.md`，本檔不重述。

---

## 歷史 session 索引（細節已各有 canonical home，本檔只留一行）

| 日期 | 主題 | 細節在哪 |
|---|---|---|
| 2026-08-10~12 | **Layer Manifest 全量工程**（PR #130；348 層+336 params 遷移、useTransportParams 退役、護欄永久化、紅燈演練）＋⑤④ 收尾 565 全綠 | `docs/features/layer-manifest/`（overnight-log＋changelog 14 棒）＋INCIDENTS 08-11/12＋PB-38 |
| 2026-08-10 深夜 | 結構稽核 → 8 批執行 wave（7 PR #123~#129） | `docs/research/architecture-audit-2026-08-10.md`＋INCIDENTS/REFLECTIONS 同日＋PB-37 |
| 2026-08-10 | 監看模式排版八/九版（PR #121） | `docs/features/monitor-grid-static/`＋PB-30 |
| 2026-08-06~09 | EM-16 翻案 → embed 三層動態回放 | INCIDENTS 2026-08-06~08＋PB-34 |
| 2026-08-08 | nightly trails 保存層（data-collectors PR #47） | DATA_SCOPE §保存層＋PB-35 |
| 2026-08-06/07 | 資料源健康三連查＋落雷雙源 | `.claude/pitfalls/2026-08-07-silent-upstream-outage.md` |
| 2026-08-05/06 | 殯葬 5 層＋食品價格板＋收孤兒 repo | `docs/features/funeral-layers/`＋PB-36 |
| 2026-08-03~05 | 可嵌入地圖 EM 系列（PR #105/#106） | `docs/features/embeddable-map/` |
| 2026-08-02/03 | 共機全鏈上線（PR #104＋mig 330~333） | `docs/features/pla-activity/` |
| 2026-07-29~31 | 地震回放＋溫度三部曲 | `docs/features/earthquake-replay/`＋INCIDENTS 同期 |
| 更早 | — | `git log -- .claude/memory/STATUS.md` |

---

_本輪 memory commits_：INCIDENTS（四事件）／PLAYBOOKS(PB-38)／REFLECTIONS／BACKLOG（AR 主體結案+G008 主嫌解除）／docs(proposal AR-22~24 done／manifest overnight-log 入 repo)＋本檔。
DATA_SCOPE 刻意不動（無資料/表結構異動）；GLOSSARY 刻意不加（manifest/spec/store 詞彙在 feature docs＋code 註解已有 canonical）。
