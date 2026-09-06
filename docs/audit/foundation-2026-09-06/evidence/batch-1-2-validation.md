# 批次 1A／1B／2 驗收紀錄

日期：2026-09-06。接續批次 0 的 [validation](validation.md)，不把先前 baseline 覆寫為新版本。**程式與隔離 DB 整合完成；正式 migration、真實 Google 帳號／實體裝置與前端部署尚未完成。**

## 程式與本地測試

- `npx tsc -b`：exit 0。
- `npm test -- --run`：119 files，1,145 passed／3 skipped；15.42 秒。包含新增搜尋、scene/schema、loader/store、REST 寫入重試與既有全站回歸。
- Production build：exit 0，9.25 秒，保留既有 chunk >500 KB 警告。`publicDir=false`，不是完整部署資產或 clean install 驗證。
- 兩 repo 的 `git diff --check` 通過。續作已建立原子 commit，見 [提交對照](atomic-commits.md)；沒有 push／merge。
- 調試時補上原工作目錄既有的 `weather_stations.geojson`、`medical_hospitals.geojson`、`taiwan_basemap.pmtiles` 唯讀 symlink（ignored），未複製或改寫原始資料。缺少這些忽略資產時，Vite 原本會回 HTML fallback，不能把畫面空白當成圖層沒有資料。

## 初始載入邊界

資料：[build-profile-batch2.json](build-profile-batch2.json)。bytes 是 entry 的 transitive static JS；gzip 為每個檔案壓縮後加總，不是 browser transfer size，不包含 CSS、圖資及 lazy chunks。

| entry | 批次 0 前 gzip | 批次 0 後 gzip | 本次 gzip | 本次相對最初 |
|---|---:|---:|---:|---:|
| main | 1,624,603 | 1,454,738 | 1,464,465 | −9.86% |
| embed | 1,317,166 | 1,317,217 | 710,130 | −46.09% |
| bbox | 532,905 | 532,905 | 530,469 | −0.46% |

新增會員／搜尋相對批次 0 後 main 增加 9,727 gzip bytes（約 0.67%）。不是零成本，但未拉入新的重型引擎。

對實際 rendered modules 檢查：Embed 靜態閉包含 MapLibre、不含 Mapbox／Three／AI SDK；main 含 Mapbox／Three、不含 MapLibre／AI SDK。可選 replay 功能仍可動態載入 Three，沒有刪掉既有 replay 能力。本次修的是 Legend／Timeline 反向依賴場景與 hook；既有 MapLibre PMTiles adapter 保留。

沒有宣稱實機 FPS／INP／LCP 或 memory leak 改善。Browser smoke 是桌面 headless Chromium＋viewport 模擬，沒有 iPhone／Android 真機。

## Browser 使用流程

| 流程 | 實測證據／範圍 |
|---|---|
| 桌機／手機搜尋 | 1440 px 與 320 px 搜尋「氣象」同為 10 筆；相同訪客收藏下，前三項順序相同。世界／日本／alias 另有 unit fixtures。 |
| 訪客收藏 | 從搜尋星號收藏 weatherStations，會員面板出現，重整仍保留；登入不自動匯入。 |
| 手機入口與面板 | 320／390 px header 按鈕均可見；會員面板在 viewport 內，320 px 時 x=8/width=304；底部圖層入口有文字與 keyboard button。 |
| 面板互斥 | Layers → 會員會關搜尋面板；會員 → Layers 關會員；Monitor／Intel／Satellite 開啟時關會員；AI 手機入口同樣關會員。後幾項含程式檢查，不等同每個 console 都做長時間測試。 |
| 本地 DB 收藏／場景 | 合成帳號 c3 手動匯入訪客收藏、保存場景、更新目前圖層、重新命名，寫入後 load 讀回才顯示已同步。 |
| 跨儲存空間讀回 | 從 127.0.0.1:4187 切到 localhost:4187（不同 localStorage origin），同一合成帳號讀回收藏、場景、地點；第二 origin 訪客收藏為 null，證明非靠 guest cache 顯示。這不是兩台真機。 |
| 私人 Point／Polygon | 地圖中心 Point 及視野外接矩形 Polygon 保存後重開；GeoJSON source 保留原 geometry，Polygon rendered feature=1；無自動 URL query。 |
| 帳號切換／登出 | c3 → d4 清空私人收藏／場景／地點；已顯示的 private source 移除，camera 回預設。切回 c3 讀回自己的 rows。 |
| Embed | MapLibre 底圖 PMTiles 收到 HTTP 206；醫院點位、圖例「MEDICAL 醫療據點」、點選 popup、地圖縮放通過。weatherStations 另查到 12 個 rendered points 與 popup。未新增白名單圖層。 |

本地 Auth/REST smoke 使用 `/private/tmp/pulse-member-smoke-api.py` 的**合成 Auth**與實際 PostgreSQL 17。API 僅綁 127.0.0.1:55440、只接受兩個 fixture UUID；每次資料操作都 `SET LOCAL ROLE authenticated`／設定 auth.uid claim，SQL 真的經過 RLS。使用者介面走真實 member loader/store 與 Supabase JS builder，但此 adapter **不是正式 PostgREST／Google JWT 驗證**。未把合成 token 送正式 Supabase；fixture session 已登出。測試程式不放入產品 build。

## DB 驗收

上游 `migrations/407_member_private_storage.sql`，另有 `.test.sql` 及 `.concurrency.test.sh`。

- 隔離 PostgreSQL 17（127.0.0.1:55439）建立 synthetic auth users、角色及 auth.uid stub；migration 重複執行通過。
- A/B auth.uid 的讀／新增／更新／刪除隔離；anon 拒絕存取；owner user_id 不能換成其他人。
- 不合法／越界 geometry、未封閉 polygon、額外或缺少 snapshot 欄位、未來版本、JSON string version、NULL time enum、錯誤日期、非整數 windowDays 被拒。
- per-user favorites 500／places 100／scenes 50 配額；實際兩個 READ COMMITTED 連線搶 499 個收藏後的最後名額，只有一個成功，最後 count=500。
- 滿額時重送同一收藏不佔新名額；updated_at CAS 舊版本更新 0 rows，不覆寫新版本；timestamp 使用單調 clock_timestamp。
- DB 只驗 scalar 形狀／大小，runtime 的 layer/param allowlist 由前端復驗。未知版本 row 不阻擋整份私人清單；可刪除不相容項目。
- 新增 REST 寫入網路錯誤、5xx 不自動重試測試，避免重複 insert；不是完整的離線冪等佇列。

## 正式環境與待確認項目

正式 metadata 預查：[member-db-preflight.json](member-db-preflight.json)，三個表與新 helper function 名稱尚未使用，沒有讀取任何會員 row。公開 RPC 小樣本：[rpc-baseline.md](rpc-baseline.md)，三支各 3 次 HTTP 200；不足以報代表性 p95，不能把 catalog 第一次約 1.9 秒直接定為 SQL 瓶頸。

**正式 migration 套用未執行。** 自動核准審查拒絕了建立正式私有表與權限的動作，理由是使用者尚未對這個具體正式環境 migration 明確拍板；引用工作區 `CLAUDE.md` 第 68 行「migration／刪資料／部署／push／merge → 須 user 拍板」。拒絕發生於命令啟動前，沒有建立或修改正式表。

待使用者確認的確切內容：套用 `gis-platform/migrations/407_member_private_storage.sql`，新增 `user_layer_favorites`、`user_places`、`user_scenes` 及其 RLS／驗證／quota helper，保留既有表與資料；套用後 readback grants/policy/indexes，做真實登入讀回。前端發佈另依原流程，不因建表自動部署。

批次 3 的 LayerHost／大檔拆分、GIS 分析、AI planner、Intel 資料品質、App 真機選型維持後續計畫。這次沒有把尚未驗證的 Intel anchor、資料新鮮度或慢查原因當成已修復。
