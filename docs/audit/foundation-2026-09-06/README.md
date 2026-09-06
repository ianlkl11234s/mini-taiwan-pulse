# 重整優化專案底層運作＋會員新功能：整體檢視與開發計畫

日期：2026-09-06（Asia/Taipei）。本文件為本輪總入口，承接 [主站 AI／GIS 路線圖](../../proposal/main-site-ai-gis-roadmap-2026-09-05.md) 與 [App 研究](../../research/mobile-app-assessment-2026-09-05.md)。

## 決策

**沿用現有網站與 Supabase，先處理資料正確性、載入邊界與搜尋，再交付側欄會員專區及可保存的地圖工作流程。** 不需要另建一套會員後端；需要的是補齊私有保存資料表、存取權限與同步行為。

會員專區是「把我看過、收藏、分析過的內容找回來」的入口。圖層、Capture、Monitor、即時情報仍保留各自工作用途，透過同一份場景／地點／分析契約串接。大型改名搬檔、全面替換地圖引擎與付費會員系統不列為首批依賴。

**目前進度（續作至批次 2）**：批次 0–2 本地驗收完成，會員與統計 PR #219 已整合，123 files／1159 tests 通過。正式會員 migration 408 已依新授權套用，RLS 與 REST 回讀完成；發布進度見 [會員交付](../../features/member-area/handoff.md)。Google 真實帳號與實體裝置驗收仍未完成。

提交／回滾對照：[atomic-commits.md](evidence/atomic-commits.md)。

最新交付請看 [批次 1–2 驗收](evidence/batch-1-2-validation.md) 與 [會員功能 handoff](../../features/member-area/handoff.md)。下面的審計基線保留，狀態以此段及最新驗收為準。

## 1. 基準與證據界線

- 分支：`codex/project-foundation-member-audit-20260906`。
- Worktree：`/private/tmp/pulse-foundation-review-20260906/mini-taiwan-pulse`。
- 程式基準：fetch 當時 `origin/master` 的 `44f85e6`。原工作目錄 `codex/transport-hub-display` 及其未提交內容保留。
- build 使用既有 node_modules、`publicDir=false`，避免複製龐大靜態資產。這是程式打包驗證，不是乾淨安裝或完整發佈資產驗證。
- Supabase 只查 metadata 與容量／排程聚合；連線確認 `transaction_read_only=on`，查詢有 timeout。未讀會員資料、未寫 DB。
- 線上 browser 僅確認公開頁面及 Intel 入口，不代表 production 就是本 worktree 版本，也不代表所有圖層新鮮度或手機效能合格。

| 證據 | 位置 | 可以證明什麼 |
|---|---|---|
| 結構與 import 鏈 | [structure.md](evidence/structure.md) | 檔案耦合、靜態依賴、抽查 cleanup |
| 會員基礎與契約 | [member-infrastructure.md](evidence/member-infrastructure.md) | 現有 source、建議表／RLS／UI 接線 |
| build 前後 | [before](evidence/build-profile-before.json)、[after](evidence/build-profile.json) | entry 靜態 JS 閉包、gzip、模組來源 |
| DB 唯讀快照 | [db-metadata.json](evidence/db-metadata.json) | 本次可見 public 會員物件、RLS、容量、排程統計 |
| 驗收紀錄 | [validation.md](evidence/validation.md) | 測試、build 前後比較、browser 邊界 |

## 2. 審計結論與優先級

P1：擴充前優先完成；P2：分批改善；P3：先量測再決定。這是本計畫的開發排序，並非宣稱發生資安事故。

| ID | 優先 | 問題／機會 | 證據與影響 | 本輪狀態 |
|---|---|---|---|---|
| G0 | P1 | 人口缺值、排名與截斷樣本語意 | 缺 H3 曾變 0；單格值被稱附近密度；sample 容易被推論成全體統計 | 已修正、測試驗證；未部署 |
| P1a | P1 | 未使用 AI 也下載模型 SDK | 主站靜態 import `chat/agent`，含三家 provider SDK | 改首次呼叫時載入，前後數據見驗收紀錄 |
| P1b | P1 | Embed 同時拉入 MapLibre、Mapbox 與 Three | `EmbedApp → LegendPanel → TemperatureWaveScene / GFW hook → PMTiles source`；build 直接確認 | 純色盤／資料視窗 store 已分離；Embed 靜態閉包無 Mapbox／Three，本地圖例／popup 通過 |
| M0 | P1 | 會員保存尚缺 DB 契約 | 本次 public metadata 找到 profiles，未找到規劃中的收藏／場景／地點表 | UI／migration／隔離 DB 已完成；正式套用待具體確認 |
| S1 | P1 | 圖層查找分散 | 桌面搜尋與來源 catalog／AI 查找沒有完整共用入口，手機入口需補 | 桌機／手機／來源總覽／AI 共用索引已接線；訪客收藏可保存 |
| D1 | P1 | 分析前需確立情報時間、定位與去重 | 線上情報可讀，但出現標題與地理標籤不一致的案例；不能直接視為可靠事件座標 | 要做來源抽樣稽核及分析 eligibility；未擅改座標 |
| P2a | P2 | 全部 LayerHost 接收廣泛 deps | 74 個 registry entries；App 變動可能造成整批 reconcile | 靜態風險成立，未量得重複 fetch 或 memory leak |
| P2b | P2 | registry／manifest／legend 維護面過大 | 四個主要設定／呈現檔合計超過 31k 行 | 依功能邊界拆，保持 manifest SSOT，避免一次搬全站 |
| D2 | P2 | 歷史資料容量與慢查需治理 | DB 約 39.85 GiB；慢查統計存在高平均值，但尚未對應前台 RPC | 建立保留策略及常用 RPC 基線，未清資料 |
| U1 | P2 | Intel 計數標題容易誤讀 | 本次 UI 同時顯示「共 1 則」、全部 212、新聞 1、警報 63、全球情勢 180 | 確認各數字時間窗／去重口徑後改文案，不逕自相加 |
| P3a | P3 | 部分大型 GeoJSON／路線資料成本 | tracked 檔案大小及舊 backlog 提供線索，未量得本次首屏請求 | 先測實際啟用、下載、parse 與記憶體，再換格式 |

### 本輪語意修正內容

1. 找不到 H3、人口為 null／非有效數字／負值時排除排名並回報缺值；有效 0 保留。
2. 結果明示「點位所在 H3 格人口」、resolution、people 單位及來源／產製時間。來源未附 metadata 時保留 null；產製時間不冒充觀測時間。
3. coverage 是輸入點匹配率，非地理覆蓋率；同一格多個 POI 共用同一人口值，不能逐點相加。
4. 被截斷結果回傳 `total / returned / truncated`。total 是交給截斷器的完整陣列筆數，不保證上游 RPC 已回傳全資料庫；模型不能用 sample 推論未計算的比例、分布或原因。
5. Prompt 明確區分既有預先計算等時圈與任意點／時段即時計算。

### 效能基線如何解讀

本次優化前的靜態 JS 閉包如下；gzip 是逐檔壓縮後加總，不是 browser transfer size，未含 CSS、圖資、lazy chunks 或 cache 差異。

| entry | 原始 JS bytes | gzip bytes | 解讀 |
|---|---:|---:|---|
| main | 6,034,841 | 1,624,603 | AI 及地圖相關模組有首屏成本 |
| embed | 4,960,278 | 1,317,166 | 共用 LegendPanel 把不同 renderer 實作一起帶入 |
| bbox | 1,902,973 | 532,905 | 獨立入口也需納入共享 chunk 檢查 |

首批處理方式：AI 執行引擎延後至發送／測試金鑰才載入，保留 ChatPanel 的草稿及 session 行為；Embed 將純色盤／圖例描述從 scene、hook 拆出，再以引擎相容的 source adapter 接線。不能只加 `manualChunks` 就宣稱移除首屏依賴，也不能只 lazy UI 而仍靜態 import 引擎。

後續量測採同一組場景：空白地圖、交通動態、人口＋設施、Intel、Monitor、Capture、Embed；桌機與一台真實 iPhone／Android 分開報告。每組記冷啟動／重訪 JS 與圖資 bytes、可操作時間、RPC p50/p95、互動長任務、20 次開關後 subscription／記憶體趨勢。工具目前無法讀取 Performance API，故本輪不填寫推測的 FPS、LCP、INP 或手機分數。

### DB 容量與排程

本次讀值：42,788,670,611 bytes（約 39.85 GiB）。relation size 包含表與索引；最大幾項為 rain_gauge_readings 約 2.67 GiB、groundwater_level_readings 約 1.72 GiB、uswg_measurements 約 1.39 GiB、power_poles 約 1.38 GiB。不能由這些數字推論哪些可以刪除。

最近 24 小時已記錄的 cron run 為 1,155 筆 succeeded；不代表應跑任務全都有執行，也不證明來源新鮮。需再對照 enabled jobs 的預期頻率、最後有效觀測時間及讀回資料。pg_stat_statements 的慢查平均值約 11–26 秒，混有單次操作；未查 SQL 內容、統計重置時間或 RPC 對應，因此不是前台 API latency 結論。

## 3. 會員專區：入口與首批功能

桌機側邊新增「會員專區」User icon，沿用現有面板互斥與關閉行為；手機提供同一入口。右上頭像保留快速登入／登出，身份來源仍為既有 auth state。

| 使用者任務 | 所在位置 | 第一版行為 |
|---|---|---|
| 快速找常看圖層 | 會員專區 → 收藏圖層；搜尋結果星號 | 訪客本機保存、登入後可選擇匯入；支援取消與已下架提示 |
| 整理目前畫面 | 會員專區 → 已開啟 | 直接反映 visibility state，可逐一關閉；最近使用先留本機 |
| 重開地圖組合 | 會員專區 → 我的場景 | 命名、保存、重新命名、刪除、重開；顯示同步狀態 |
| 關注一點或範圍 | 會員專區 → 我的地點 | 收藏 Point／AOI，跳至位置，再做周邊分析 |
| 了解身份 | 面板帳號區 | 顯示登入身份、登出；layer tier 不稱付費方案 |

不顯示尚未交付的空白頁籤。第一個可交付版本為會員入口＋本機收藏＋已開啟；下一版才啟用跨裝置同步與場景／地點。未登入仍能使用本機收藏，登入 CTA 說明同步的用途。

完整流：搜尋圖層 → 星號收藏 → 開啟兩個圖層／調整參數 → 保存命名場景 → 另一次登入重開 → 過時／受限圖層給提示 → 點地圖做分析。

## 4. Supabase／DB 基礎建設

沿用現有 Supabase Auth、`profiles` 與 layer gates。source 的 migration 270／275／276 與 live metadata 都提供 profiles 基礎證據；RLS 已啟用，但本輪沒有用兩個真實帳號做越權測試。table-level grants 不含 column-level grants，不能把查不到 table UPDATE 解讀成 profile 欄位不可更新。

建議新增三個互不混用的私有物件（schema 詳見 [會員契約](evidence/member-infrastructure.md)）：

| 表 | 用途 | 必要限制 |
|---|---|---|
| user_layer_favorites | user × stable layer key | unique(user_id, layer_key)、本人 CRUD |
| user_places | 具名 Point／Polygon 與位置精度 | geometry／GeoJSON 驗證、座標範圍、大小限制；不默認分享 |
| user_scenes | versioned 地圖狀態快照 | allowlist params、大小／數量配額、衝突檢查、本人 CRUD |

上游 `gis-platform` 使用**當時未使用的 migration 編號**建表與權限；不要照抄舊提案的 273／274。先做 staging schema／RLS 驗收，再接前端雲端模式。新表不得對 anon 開放，policy 覆蓋 SELECT／INSERT／UPDATE／DELETE 所需 `USING/WITH CHECK`，避免 user_id 被換掉。配額需並發安全，不能僅在前端算數量。

同步首版採 online-first：本機收藏與登入帳號分區儲存，手動匯入；雲端 CRUD 回讀成功才顯示「已同步」。離線不能假裝已同步。scene update 用版本或 updated_at 條件防覆寫，衝突保留副本；離線編輯／刪除佇列延後，若引入就必須有 tombstone 和重試冪等。登出清除私有快取，換帳號不能讀到前一個帳號場景。

scene 只保存 camera、basemap、time mode／range、layer keys 與允許的 params。重新開啟須重驗當前權限、參數版本及圖層可用性，跳過項目要有清單。API key、token、完整資料列、私有分析 payload 不進入快照。Capture 的圖片和 scene 是兩種產物：先支援下載，之後若保存圖片才另規劃私有 Storage bucket、大小配額、保留／刪除及 signed URL，不把圖片 base64 塞進 JSONB。

會員表是小型互動資料；歷史 GIS 表是高量時序資料。先分開 query、索引、權限與容量預算，暫無證據要求另建一個 DB。分析耗時任務未來走 job／結果儲存，避免與會員 CRUD 共用無限時運算通道。

## 5. 搜尋、AI、GIS 與即時情報如何串接

沿用 [既有 roadmap 的搜尋與分析契約](../../proposal/main-site-ai-gis-roadmap-2026-09-05.md)，本輪增加底層交付條件：

1. **共用搜尋**：一份 manifest 衍生索引，支援名稱、alias、主題、地區、來源與分析能力；桌面、手機、AI `search_layers` 共用排序。結果先區分圖層／地點／事件，能預覽來源、啟用、收藏；不把 metadata 可搜尋誤當可分析。
2. **單點／AOI 基礎分析**：先做半徑內設施、最近設施、範圍交集與可用人口統計。表單和 AI 共用 typed API，附 method、資料版本、時窗、完整性、單位與限制；空值、0、無 geometry 與未覆蓋分開。
3. **AI 問答及規劃**：先回答已計算結果，再生成可檢查 AnalysisPlan（選定地點／範圍、資料、方法、參數、費用限制）。執行才調受控工具；沒有工具就說未支援。AI 不直接自由生成 SQL 或推造分析數值。
4. **情報交互分析**：事件 → 在圖上檢視有效位置 → 選影響範圍 → 查附近設施／保存分析 → 手動加入關注。必須區分報導時間、事件時間、收錄時間、AI 處理時間。publisher／國家／代理錨點不得當成事發點做 500m buffer。
5. **進階 GIS**：先等時圈與路網可達，再有資料條件的 KDE／DEM 地形統計與 viewshed。KDE 需權重、bandwidth、投影與可比較時窗；視域需 DEM／DSM、解析度、觀察／目標高度，不能由上色瓦片猜地形值。圖片中的方法做為功能方向，不等同目前已有 API。

Monitor 先消費已保存的場景／AOI／查詢配方，通知訂閱另外建立規則；收藏不會自動發通知。即時事件更新不可覆寫過去保存的 analysis run。App 最後共用這些身份、搜尋、保存與結果 API，採手機版導覽：地圖／情報／我的；Capture 為地圖操作，Monitor 從場景或關注項目進入。

## 6. 開發順序與完成條件

| 批次 | 工作包 | 依賴 | 完成條件 |
|---|---|---|---|
| 0（本輪） | 審計＋G0 語意修正＋AI 延後載入 | 最新 source 與隔離 worktree | 測試、build 閉包對比、證據與限制記錄 |
| 1A | Embed 引擎邊界、載入成本／RPC 基線 | 批次 0 | embed 靜態閉包無意外 Mapbox／Three；受支持圖層與互動 browser 驗收；同場景前後量測 |
| 1B | 共用搜尋＋會員 icon＋本機收藏／已開啟 | stable layer key、既有 auth | 桌面／手機搜尋同結果，收藏重整仍在，切換與 gate 一致；首屏不新增重型依賴 |
| 2 | 私有資料表與雲端同步、命名場景／地點 | 1B 契約；上游 migration 先行 | staging RLS 兩帳號隔離、配額／衝突測試；跨裝置 round-trip；讀回證據 |
| 3A | 按依賴拆 LayerHost／legend／registry | 1A profiler 找到明確熱點 | 相同操作 render 次數改善，不增加 RPC 次數，subscription 開關不累積 |
| 3B | 半徑／nearest／AOI 分析與結果保存 | G0、搜尋；保存用批次 2 | fixture 與真實資料比對、缺值與完整性可理解；手動表單可獨立用 |
| 4 | AI 引用結果、AnalysisPlan | 3B typed tools | 計畫可檢查，結果可引用，取消與失敗可恢復，未執行不得聲稱完成 |
| 5 | Intel 地理／時間品質、事件 × AOI、Monitor 關注 | D1 品質先過；2、3B | 位置資格、時窗、去重驗收；對保存區域的關係可追溯 |
| 6 | 路網／DEM／KDE／viewshed；App device spike | 對應資料／授權／運算與 mobile 基線 | 逐項達到方法與實機驗收，不綁成一次大發布 |

1A 與 1B 可獨立安排；會員保存不必等所有 GIS 最佳化。D1 資料品質盤點與 D2 容量／排程治理應從批次 1 持續進行，避免到情報分析時才發現資料不可用。每批都以可操作的流程交付，不以完成幾個檔案判定完成。

截至本次續作，1A／1B／2 已完成本地交付，正式會員 408 已套用。前端合併與部署另留發布證據；真實 Google 帳號驗收仍須補齊。批次 3 起維持後續計畫。

## 7. 檔案配置與發佈策略

保留 `src/data` loader、`src/hooks` layer hook、`src/map` renderer、`src/three` scene、`src/state` store 的既有分層。新增會員 UI 收在 `src/components/member/`，保存 loader 沿用 `src/data/`，schema validator 放純邏輯模組；純 metadata 不 import React hook、Three scene 或 Mapbox runtime。

registry／manifest 可逐領域拆檔，由既有入口聚合維持 stable key 和派生流程；不要再建立第二份手寫圖層清單。LegendPanel 改讀純 legend descriptor，渲染器在自己邊界使用同一色盤。大型資料外移依 source/loader/deploy URL 契約一起驗證，不靠搬 public 檔案宣稱減少下載。

DB 變更在上游獨立提交單元；前端功能預設可降級到本機模式，migration 未就緒不偷偷送寫入。優先 additive schema，確認讀回再切換；回退先停新功能寫入，保留使用者資料。UI、migration、資料上架與 production browser 各自列驗收，不用單一「測試通過」取代發佈確認。
