# 基礎整理執行計畫

> 主線整合入口：[PR #225](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/225)。下方「未合併／未部署」為各批驗收當時的紀錄；當前合併、CI 與發布狀態以 PR 及其 checks 為準。S3 封存尚未上傳。

> 2026-09-07 整合註記：本文件前段是原始計畫，實際進度以末尾批次紀錄及 [近期成果對帳](../audit/recent-delivery-2026-09-07/README.md) 為準。使用者已授權將完成的基礎修正整合主線；S3 上傳、長跑與故障演練尚未執行。

建立：2026-09-07。狀態：**第一批回歸驗證與 5 個原子 commits 完成；整體計畫持續進行，尚未發布**。

執行紀錄：[第一批交付、測試、效能比較與後續缺口](../audit/infrastructure-2026-09-07-batch1/README.md)。實作起點已更新為 `9cf23f9a92eeb5300c654a2fe0e0bfd79d7ac2d1`；以下起點段保留規劃當時的工作區狀態。
問題依據：[2026-09-06 審計](../audit/infrastructure-2026-09-06/README.md)。本文件是本次改造的單一執行入口；保留原審計作歷史證據。

## 已決定的方向

- 使用者確認日本警察局點位已上線，現在可開始規劃基礎整理。
- 保持現有顯示標準，包含遠景細節、資料量、圖例與點選能力。優先消除重複工作，**不以減少顯示點數、隱藏圖層或降低畫質作預設解法**。必要取捨須拿實測比較再決定。
- 資料中斷保留最後成功資料，明示最後成功時間與目前狀態；不得將未知、過期或失敗解讀為零／正常。
- 部分圖層需要登入；公開／登入／管理權限清單尚待整理，不能僅靠前端鎖開關。
- 主要驗收是桌機多圖層與 Monitor 長時間監看；手機先確認基本可用，獨立效能優化後排。
- 不必要運算、故障恢復、負載／容量、資料庫權限全部是必要範圍。

## 起點與保護範圍

目前本地 HEAD 仍是 `484f97a7cd024bfd7978a1dbcad33b47683c94b5`，含其他任務未提交改動。日本警察局 [handoff](../features/jp-police-facilities/handoff.md) 的最終段記載前端 PR #224 merge `9cf23f9a92eeb5300c654a2fe0e0bfd79d7ac2d1`、上游 PR #82 merge `a98e4e96f9c874dd3498edc6430698e892459f47`；該文件未提供正式站 browser 證據。使用者的上線確認作為開始條件，本次沒有重新驗證部署。

**實作必須從最新整合版本開始，不能把舊 checkout 的審計問題直接套回正式版。** 先讀回最新主線／部署版本，逐項標示「仍存在／已修正／不適用／待驗證」，再建立獨立 `codex/` worktree。保留目前 dirty checkout，不 reset、清除、搬走或代交其他人的修改。

日本警察局維持全密度與位置精度語意，加入回歸 fixture；不在本次重做資料源。現行工作區可寫範圍只有 Pulse；gis-platform／data-collectors 的實作需要對應工作區寫入權限。此限制不阻擋本次規劃、唯讀確認或 Pulse 端獨立工作。

## 分階段交付

每一階段都有可獨立 review 的交付；發現已修正的舊問題就關閉，不為符合計畫重做一次。

| 階段 | 工作與主要產出 | 完成條件 |
|---|---|---|
| B0 版本與基準 | 確認主線／部署／資料版本；複核 A1–S1；建立固定桌機場景及原始測量 | 每個問題有當前證據；可重跑同資料／同畫面比較；未知指標明列 |
| B1 權限邊界 | 查 Portal 實際公開性、service-role routes、RPC／RLS／Storage；完成角色矩陣、限定代理、限額與登入隔離 | 匿名／會員／管理員／collector 的 allow+deny 測試通過；正式 ACL 與部署讀回；不能繞過 UI 直接取受限資料 |
| B2 資料狀態與恢復 | 統一成功／過期／錯誤／拒絕契約；保留舊資料；共享 Monitor/Intel 更新責任；取消與序號防競態 | 中斷不變零；恢復自動更新；新結果不被舊請求覆蓋；列表、摘要各自時間可追溯 |
| B3 同畫質效能 | 修 listener lifetime、H3 paint-only 重建、無效 repaint；入口按需載入；隔離相機與各 Host 更新；衛星 CPU 工作有界 | 同 fixture／視角／顯示數量下成本下降；切換無累積；透明度不重建 geometry；未開功能不下載重型模組 |
| B4 供應與承載 | 明定 Supabase/S3/R2 角色；版本化發布、快取與受控 fallback；服務端限流；SQL熱點；collector buffer/restore | CDN／DB／collector 故障演練成立；發布不暴露半成品；限額與回復有效；容量有實測範圍 |
| B5 長時驗收與收斂 | 組合場景長跑、回歸、正式部署讀回；移除舊 owner／過渡路徑，更新必要開發契約 | 效能、視覺、資料、權限與恢復全部有證據；未完成項不能以單元測試通過替代 |

順序：B0 開始後立即複核高權限風險，不等待完整 profiling 才處理。B1 與 B2 可在不同檔案／repo 並行；B3 的 listener/H3 可獨立進行，共享 scheduler 須先定 lifecycle。B4 的容量實測使用 B2/B3 完成後版本，避免對即將淘汰的行為調參；B5 最後整合。

## 實作責任與根本解

### B0：先建立可比較的起點

記錄 build SHA、部署 SHA、資料 manifest/hash/asOf、作業系統、瀏覽器、CPU/GPU、RAM、視窗尺寸與 DPR。測試 fixtures 用固定日期／版本；即時長跑另記每次來源時間，不能以變少的即時資料宣稱變快。

原審計的 bundle 與測試數是舊 checkout 的結果，重建本次 baseline。profiling 必須能輸出 trace、request timing 和記憶體證據；若當前工具無法取得，標為未測，先完成能證明的修正，再補可用的測量環境。不把所有工作卡在工具不足。

### B1：公開讀取和高權限管理拆開

- ownership：gis-platform Portal API、相關 migrations；Pulse auth/gates 與 client cache；物件存取政策。
- 對 `/api/distinct`、`/api/data`、`/api/rpc` 複核實際部署與 middleware；若無外部保護且仍公開代理高權限，先縮限／關閉，再驗證正常消費者。
- 用公開或最小權限角色供公開讀取；表、欄位、filter、排序、筆數與成本都須有界。collector heartbeat 不經公開 generic proxy。
- 檢查現行 SECURITY DEFINER owner、search_path、execute grants、RLS、exposed schemas，不只讀 migration。檢查匿名 telemetry 跨請求限流與保存期限。
- 會員清單未定前維持已有正確政策；無法判定的既有受限資料維持受限。清單決定只阻擋個別圖層政策切換，不阻擋基礎實作。
- cache 依身份／權限隔離；登出、token 失效、權限撤回後移除受限快取與畫面。不能以「中斷保留舊資料」繼續呈現已失去權限的資料。
- BYOK CSP 先收集連線需求再 enforcing；主站與 embed 分別驗證，不直接套一條會破壞既有功能的政策。

### B2：資料只由明確的 owner 更新

- ownership：Pulse `src/data/intelLoaders.ts`、`src/lib/loaderCache.ts`、Monitor/Intel 元件與必要 state；上游缺欄位時再補資料契約。
- 保留已存在的 Promise dedupe／TTL／LRU。選一條既有路徑擴充，不新增永久競爭的第二套 cache。
- 結果至少含 data、health、observedAt/asOf、lastSuccessAt、attemptedAt、source、coverage、errorKind；區分真正空結果和未完成查詢。成功且完整的空結果應正常清空過時項目；不能因保留舊資料而永遠留下已失效事件。
- 今日資料按來源節奏刷新，歷史按版本快取。慢請求不重疊，關閉 consumer 後停訂閱／取消；切換 AOI／日期不讓過時回應落入新畫面。
- 保留舊資料只適用相同查詢範圍與仍有效的權限。查 A 區失敗不能拿 B 區舊資料冒充；不同來源時間不強行包成同一觀測時刻。
- 過期資料可顯示，但情勢結論標為未知／資料不足；設定每資料集 freshness 規則，不以一個全域 TTL 處理所有資料。

### B3：維持細節，減少不必要計算

- ownership 可拆為：App/MapView listener；H3/grid factories；Three custom layers；入口與 Host subscription。不同 worker 不碰同檔。
- 把 map instance 與 style lifetime 拆開；對所有 listener、timer、worker、source、material、geometry 定義唯一 owner 與 dispose。
- H3 幾何按資料版本／resolution 重用，樣式只更新 paint；數值年份與 geometry 變更分離。相同視角比對可選取 ID、圖例、透明度、popup 與幾何。
- 動畫僅在有可見變動時繼續排幀；原本需要持續動畫的效果仍保留。資料計算頻率和畫面插值頻率可以分離，但須維持動態正確性與既有平滑度。
- 衛星 propagation／大型 geometry 轉換視 trace 移入 Worker；減少複製、全量 serialization 與重複 setData。不上來就換 renderer。
- AI／Monitor／管理面板 code 按需載入，先確認關閉時仍必要的資料訂閱，再分離。相機 HUD 不讓整個 App 與無關圖層重新 render。
- 全球資料可使用 tiles、可視範圍傳輸、buffer 重用；須保證視野內現有可見資料不因優化被抽稀。遠景聚合／降細節不列為預設工作。

### B4：故障時不把所有壓力推回 DB

- ownership：analytics 產物契約 → gis-platform 查詢／migration → data-collectors 發布與緩衝 → Pulse loader/nginx/runtime，依實際變更順序交接。
- 一個資料集一個 canonical origin：Supabase 負責授權／可查詢狀態與有界聚合；S3/R2 負責適合的歸檔與版本化物件。是否搬儲存供應商由數據證明，不預設大搬家。
- 可變 manifest 與 immutable asset 分開快取；先上傳、驗 hash/完整性，再切指標；舊版本保留到 consumer 安全收斂。
- staticRpc 等 fallback 必須可觀測、可限流，昂貴查詢不得在 CDN 故障時由每個瀏覽器各自重建。對來源故障做 backoff/jitter，對權限拒絕不盲重試。
- 量測 SQL rows/bytes/time、queue time、pooler/CPU/I/O，確認熱點後預聚合或索引。遵循現有 supabase-optimize 規則；不先建未證明需要的額外資料層。
- collector 緩衝需有 oldest age、volume budget、淘汰前歸檔／明確遺失警報，並驗 idempotent replay、checkpoint 與 restore；不要把「程序活著」當資料持續可用。
- 登入、跨來源資料、AI 任務的限額在服務端成立，不只依賴前端 8 concurrency queue。
- 監控 freshness、連續失敗、cache/fallback、replay lag 與資源使用，指定告警負責人與處理方式；故障演練包含告警是否送達及恢復通知，不只驗證畫面刷新。通知通道設定另依實際授權處理。

## 固定驗收場景

| 場景 | 操作 | 必看結果 |
|---|---|---|
| S0 基本地圖 | 冷啟動／暖啟動／移鏡頭／開面板 | 入口 bytes、可互動時間、long tasks、無不必要資料下載 |
| S1 全密度靜態 | 日本警察局＋代表性台灣 POI，固定遠景與近景 | 可見資料／ID 不退化，近景與 overzoom popup 正確 |
| S2 統計 | H3 多種資料、年份切換、透明度連續拖曳 | paint-only 不 setData；幾何重用、數值與缺值正確 |
| S3 動態疊圖 | AIS／船舶＋衛星＋交通，播放／暫停／鏡頭移動 | CPU/GPU/frame time、軌跡一致、暫停與動畫各自正確 |
| S4 長時間 Monitor | S3＋統計代表層＋Monitor；切底圖20次、toggle20次；先2h再8h | listener不增、記憶體有界、列表刷新、操作延遲不持續退化 |
| S5 故障與權限 | staging 模擬 timeout/429/5xx/斷網/CDN miss/401/403，再恢復 | 正確保留／移除資料；有界重試與fallback；恢復不重複／倒退 |
| S6 容量與恢復 | staging 逐階並發＋冷cache／重連＋collector中斷重播 | p95、錯誤率、DB/queue/緩衝可控；達中止門檻即停 |

不要求台灣與日本固定點位同時塞進同一視角；各用對應地理 fixture。資料／視角／畫質相同才比較前後。視野內 rendering IDs 不一定等於上游總筆數，須分別記錄 source eligible count、實際顯示 count 與原本的過濾規則。

硬性驗收：未知不變零、權限不能繞過、原有資料／視覺契約不退化、paint-only 無 geometry 重建、lifecycle 無累積、過時回應不覆蓋最新結果。效能候選目標：指定桌機動態互動 p95 frame ≤33ms，正常畫面不因優化掉資料；其餘改善量在 B0 量得基準後鎖定，不拿舊測試或估算當達標。

長跑記憶體比較暖機後的相同工作量與可回收狀態，必須呈有界區間；不能只取起終點或把正常 cache 暖機誤報洩漏。記錄 heap、GPU可取得指標與cache bytes。2h/8h 是實際執行時間，未跑完就保持未驗收。

容量目標依 2026-09-07 使用者確認為同時 10–20 人；採 1→5→10→20 虛擬使用者的受控階梯，測試步驟不代表已驗證承載量。先以現行基準定義錯誤率、DB負載、queue與latency中止門檻，再跑受控 staging；不對正式站無上限施壓。產出最大「已驗證」使用情境、資料量與資源配置，不給脫離場景的人數。

## 交付、回復與整潔

每批交付包含：當前問題證據、最小完整修正、對應回歸／效能比較、受影響資料與權限、release readback、回復操作。計畫／本地測試／runtime／browser／部署各自標狀態。

- 前端回復使用上一個已驗證 build；資料資產以 manifest 切回保留版本。不得回到已知公開高權限漏洞；安全修正以 forward-fix 或封鎖路徑為優先。
- migration 先做向後相容的欄位／接口擴充；新舊版本驗收後才移除舊接口。破壞性更動另列復原與消費者確認。
- 新 owner 接手時移除舊 interval／重複cache／無用adapter與import。過渡路徑有移除條件，不能永久雙軌。
- 現有 CLAUDE／開發規則只在行為已改且驗證後更新；遵循 layer-onboarding 的資料／圖層契約驗收。不做全repo格式重排、無關重構或清理其他人的檔案。
- 主 agent 負責契約、架構與最後驗收；Luna 做有界盤點，Terra 做不重疊的實作與review。同時最多3 worker，指定repo/檔案owner，不平行改同檔。

## 使用者還需要決定什麼

現在可先完成 B0、權限現況盤點與不影響產品政策的實作設計，不需重新確認已決定的方向。

| 決策 | 何時需要 | 先行處理方式 |
|---|---|---|
| 哪些圖層公開／登入／管理員 | B1 套用各圖層政策前 | 先產出現有入口與權限對照表；不要求使用者憑記憶列全集 |
| 容量目標與可接受新增成本 | B4 資源採購／擴容前 | 先測現有資源與瓶頸；列出費用、容量與取捨再決定 |
| 若保留畫質仍超出硬體能力 | B3 真正遇到且有trace後 | 先呈現同畫質改善結果；不擅自少畫或降細節 |
| 正式發布／migration apply | 每批具體成果驗收後 | 本地與staging準備完成，附變更範圍與回復方式再發布 |

本次交付是此計畫文件，沒有開始大幅改碼、變更權限、部署或提交。接下來第一個實作批次是 **B0＋B1權限盤點，接續B2資料狀態與B3 listener/H3獨立修正**；共享scheduler與大資料供應改造依前述契約完成後銜接。


## 2026-09-07 Monitor 統一批次

使用者確認管理入口主要自用，容量目標同時 10–20 人，並要求統一 Monitor 實作。本批已在隔離 worktree 完成共用生命週期與卡片遷移，保留原資料與更新頻率；暫時故障保留舊資料，權限拒絕另行處理。TypeScript、145 個測試檔（1277 passed、3 skipped）及 build 通過，完成本地瀏覽器 smoke；未發布，也尚未完成長跑與負載驗收。

程式 commits：7d61935、f9b43b3。詳見 [Monitor 驗收](../audit/infrastructure-2026-09-07-monitor-unification/README.md)。目前 gate metadata 是 34 個 owner 細項，與使用者描述三個的名稱／分類待對齊，本批不改既有政策。


## 2026-09-07 後續排序調整與渲染批次

使用者明確將長時間監看與故障演練延後；2h/8h soak 與故障演練保留待辦，不阻塞本地效能整理，也不得視為通過。先處理可證明的重複工作，再驗後端權限與 10–20 人受控容量。

本批已完成 camera HUD 與 App 更新隔離、GFW 透明度調整重用 geometry、房地產點位移除後的 async/idle 清理。148 個測試檔、1287 項通過、3 skipped；TypeScript/build 通過，真 React 及實際地圖一般/Capture 模式 smoke 通過。尚未執行全站多圖層 frame benchmark 或正式部署。程式提交 d45fd52、088a0a0、34f37e5；[驗收紀錄](../audit/infrastructure-2026-09-07-render/README.md)。
