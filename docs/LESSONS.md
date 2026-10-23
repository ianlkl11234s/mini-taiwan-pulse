# Mini Taiwan Pulse 經驗總集

> 用途：把這個專案踩過的坑、驗證過的做法、做得好的結果、網站哲學與小實驗**依主題**放在一頁，給人和 agent 讀，避免重蹈覆轍。每條一句白話，後面連到**正本**（真正寫規則或事件細節的地方）；這頁只當目錄，不重抄細節。
>
> 建立：2026-10-16（以 develop `efcabfd9` 盤點）。
>
> **怎麼維護**
> 1. 新教訓**先寫正本**：規則進 [`PRINCIPLES.md`](../.claude/memory/PRINCIPLES.md) 或 [`development-rules.md`](./development-rules.md)，事件進 [`INCIDENTS.md`](../.claude/memory/INCIDENTS.md) 或 [`.claude/pitfalls/`](../.claude/pitfalls/)，SOP 進 [`PLAYBOOKS.md`](../.claude/memory/PLAYBOOKS.md)，功能脈絡進 `docs/features/<slug>/`。
> 2. 再到這頁對應主題**加一行**：一句話＋連結。§6 哲學與 §7 小實驗沒有其他正本，可以直接寫在這裡（每條 2–3 句，註明出處）。
> 3. 規則過時：**不要刪**，用 `~~刪除線~~` 劃掉，後面註明日期與取代者，例如 `~~舊規則~~（2026-10-16 過時，改見 …）`。正本那邊也要同步改或加過時標注。
> 4. 每主題維持 5–8 條；超過就把較細的併進正本，這裡只留最常用的。

## 目錄

1. [動態／即時資料視覺化](#1-動態即時資料視覺化)
2. [圖層呈現](#2-圖層呈現)
3. [設計系統與介面](#3-設計系統與介面)
4. [效能（前端＋Supabase）](#4-效能前端supabase)
5. [AI、Agent 與 MCP 分析](#5-aiagent-與-mcp-分析)
6. [網站哲學與產品原則](#6-網站哲學與產品原則)
7. [小實驗（含失敗的）](#7-小實驗含失敗的)
8. [資料契約與跨 repo](#8-資料契約與跨-repo)
9. [工作流程、git 與發布](#9-工作流程git-與發布)
10. [過時文件索引（2026-10-16）](#10-過時文件索引2026-10-16)

## 給 agent：遇到這些詞先看哪一節

| 你正要做的事 | 先看 |
|---|---|
| 動態圖層、時間軸、回放、`currentTime`、RAF | §1、[development-rules §8](./development-rules.md#8-動態圖層時間訂閱external-time-store) |
| 新增或修改圖層、圖例、popup、透明度、PMTiles | §2、`layer-onboarding` skill |
| 面板、按鈕、樣式、文案、多語系 | §3、[spec](./design-system/spec.md) |
| RPC 慢、資料少一半、Disk IO、快取、bundle | §4 |
| Agent、MCP、題庫、分析倉庫 | §5 |
| 要決定「該不該做」「怎麼呈現缺資料」 | §6 |
| 想試新做法、上次好像試過 | §7 |
| migration、collector、RLS、跨 repo 交接 | §8 |
| git、PR、合併、發布、平行 session、子代理派工 | §9 |
| 3D、Three.js、CustomLayer、addLayer | §2 第 5 條＋[pitfall 2026-04-22](../.claude/pitfalls/2026-04-22-mapbox-load-once-fired.md) |

---

## 1. 動態／即時資料視覺化

1. **時間不進 React deps**：RAF 讀 `timeStore.getTime()`、篩選用 `subscribeThrottled`、跨日載入用 `subscribeDate`，UI 用 `useSyncExternalStore`。→ [development-rules §8](./development-rules.md#8-動態圖層時間訂閱external-time-store)、[TIMELINE_ARCHITECTURE timeStore](./TIMELINE_ARCHITECTURE.md#timestore外部時間來源)
2. **render body 不寫被訂閱的 store**：這個警告只在 remount／StrictMode／HMR 才穩定出現，很容易漏測，一律搬進 `useEffect`。→ [PRINCIPLES「render body 禁止寫入被訂閱的外部 store」](../.claude/memory/PRINCIPLES.md#render-body-禁止寫入被訂閱的外部-store-p02026-07-22-教訓)
3. **「平滑過渡」指資料層插值（lerp），不是 CSS／GL transition**；公車改用 1D 進度插值，跨 trip 改淡入淡出不插值。→ [公車圖層設計 §2–3](./features/bus/design.md)（使用者偏好原本只在個人 memory，2026-10-16 收錄於此）
4. **曲線平滑只給真實 GPS 軌跡**；時刻表這類「邏輯順序」的點用直線插值，否則會 overshoot 看起來倒退。→ [PRINCIPLES「Catmull-Rom 平滑只用於真實連續軌跡」](../.claude/memory/PRINCIPLES.md#catmull-rom-平滑只用於真實連續軌跡2026-05-10-教訓)
5. **事件級回放用獨立的 scoped 時鐘**，scrub 就是 set 時鐘；多層共用時取範圍聯集、`setRange` 只呼叫一次。→ [TIMELINE_ARCHITECTURE scoped 回放時鐘](./TIMELINE_ARCHITECTURE.md#scoped-回放時鐘)
6. **修好穩定性後畫面變跳格，是真實頻率露出，不是回歸**；需要高頻時拆成便宜高頻＋昂貴低頻兩條訂閱。→ [PRINCIPLES「視覺順暢可能是 bug 副產物」](../.claude/memory/PRINCIPLES.md#視覺順暢可能是-bug-副產物2026-06-13-教訓)
7. **跨站比較用「當日變化量」不用絕對值**，時間軸播放時數字才會動、才有故事。→ [PRINCIPLES「跨站可比視覺指標」](../.claude/memory/PRINCIPLES.md#跨站可比視覺指標2026-04-25-教訓)
8. **動畫圖層也只在時間真的變動時重畫**；驗收標準是「全關＋暫停 5 秒，map render＝0」。→ [PRINCIPLES「3D 效能」](../.claude/memory/PRINCIPLES.md#3d-效能2026-04-23-教訓)

## 2. 圖層呈現

1. **新圖層只寫 manifest 一筆＋params spec 一筆**，其他登記簿自動派生；面板一律用共用元件。→ [development-rules §4](./development-rules.md#4-新增-layer-流程manifest-first-觸點表)、[PRINCIPLES「圖層面板只用共用元件」](../.claude/memory/PRINCIPLES.md#圖層面板只用共用元件2026-10-03-取代一前端兩-sidebar-同步改)、[pitfall「Layer 接線常見漏項」](../.claude/pitfalls/2026-07-01-layer-integration-common-misses.md)
2. **UX 四鐵則（透明度、圖例、popup、select）缺一不可**，缺口不能用 `null` 靜默豁免；哪條有測試守、哪條要人工看，見對照表。→ [development-rules §4a](./development-rules.md#4a-圖層-ux-標配四大鐵則)；篩選 select 切了地圖沒反應，先查 `rebuildOnParamChange` 填的是 layer suffix 不是參數名 → [pitfall 2026-07-16](../.claude/pitfalls/2026-07-16-rebuildonparamchange-suffix-not-param.md)
3. **大面積覆蓋、等時圈一律做成 PMTiles**；全區和分區分開算，分級用環差。→ [PRINCIPLES「大面積覆蓋／等時圈圖層」](../.claude/memory/PRINCIPLES.md#大面積覆蓋等時圈圖層-p02026-05-26-加)、[PB-16](../.claude/memory/PLAYBOOKS.md#pb-16-大面積覆蓋等時圈圖層-soppmtiles--全區聚合--分區-filter2026-05-26-加)
4. **圖例是在描述畫面，不是在宣稱資料**：畫面上分不出來的類別，圖例就不要分。→ [PRINCIPLES「圖例不憑空發明分類」](../.claude/memory/PRINCIPLES.md#圖例不憑空發明分類2026-08-08)
5. **Mapbox 掛載不要信 `isStyleLoaded()`，也不要用 `once('load')`**；用 try addLayer＋idle 重試。也不要對隱藏圖層 `setPaintProperty`，transition 會讓地圖永不 idle。→ [PRINCIPLES「Mapbox 掛載與 isStyleLoaded」](../.claude/memory/PRINCIPLES.md#mapbox-掛載與-isstyleloaded三段合一2026-10-16)、[pitfall 隱藏圖層 transition](../.claude/pitfalls/2026-09-30-hidden-layer-paint-transition.md)
6. **Mapbox expression 只有 runtime 驗得出錯**：zoom 只能在頂層、除以 0 得 Infinity 不報錯、`undefined` 進 spec 會讓整批 source 失敗。→ [pitfall expression／GLSL](../.claude/pitfalls/2026-06-20-mapbox-expression-glsl-shader.md)、[PRINCIPLES「比值分色必先擋分母」](../.claude/memory/PRINCIPLES.md#比值分色必先擋分母--mapbox-除以-0-得-infinity-不報錯-p02026-08-13-社福長照)
7. **疊圖先估熱區疊幾層，再回推單層透明度**（`1-(1-a)^n`）。→ [PRINCIPLES「疊圖的單層 alpha 要依疊加層數縮放」](../.claude/memory/PRINCIPLES.md#疊圖的單層-alpha-要依疊加層數縮放2026-08-03)
8. **視覺尺寸要在低、中、近三種縮放各看一次**，只在單一縮放調參幾乎必錯。→ [PRINCIPLES「跨主題工作原則」](../.claude/memory/PRINCIPLES.md#跨主題工作原則2026-10-16-從-reflections-升級)、[map-layers §1.3 驗收步驟](./design-system/map-layers.md#13-驗收步驟每改一層)

## 3. 設計系統與介面

1. **token 優先，不引入 CSS 框架、不抽通用元件庫**；共用的是規格和少數共用元件。→ [spec §1 原則](./design-system/spec.md#1-原則)
2. **guard 紅燈要修程式，不改基準**；違規真的減少了才降基準（ratchet）。→ [spec §9](./design-system/spec.md#9-自動檢查guard)
3. **標籤跟著目前語系、不印內部代碼、null 顯示「—」**。→ [spec §6 文案規則](./design-system/spec.md#6-文案規則)
4. **不放沒有功能的按鈕**（「規劃中」「敬請期待」都不做）。→ [spec §1 原則](./design-system/spec.md#1-原則)
5. **大改版分階段**：比較頁選代號 → 共用底層 → 三組平行 → 接線驗收，一階段一個 PR。→ [PB-42](../.claude/memory/PLAYBOOKS.md#pb-42-ui-分階段改版比較頁代號選--共用底層--三組平行--接線驗收2026-10-03-定型監看-p1p5-五輪)
6. **高度跟內容走的容器有兩個陷阱**（svg viewBox 自算高度、`%` 高度在 auto 鏈上塌成 0），要實機量。→ [PRINCIPLES「高度跟內容走的容器裡，有兩個尺寸陷阱」](../.claude/memory/PRINCIPLES.md#高度跟內容走的容器裡有兩個尺寸陷阱2026-08-10監看模式九版)
7. **介面類 review 意見先對規格**（spec、map-layers），規格沒寫的才問使用者，決定後補進規格。→ 根目錄 `AGENTS.md`「Code Review Rules」；[map-layers](./design-system/map-layers.md)

## 4. 效能（前端＋Supabase）

1. **RPC 超過 1 秒或 1 萬列就預聚合**（普通表＋每日 refresh＋pg_cron＋薄 RPC），refresh 有 OOM 五條守則。→ [supabase-optimization](./supabase-optimization.md#關鍵坑必讀)
2. **PostgREST 有 2 萬列上限，超過會靜默截斷**（踩過兩次）；大集合用降頻或 grouped JSONB。→ [PRINCIPLES「Supabase PostgREST 20K cap」](../.claude/memory/PRINCIPLES.md#supabase-postgrest-20k-cap-p02026-04-25-教訓)、[PB-13](../.claude/memory/PLAYBOOKS.md#pb-13-大集合-rpc-設計-sop避-postgrest-20k-cap)
3. **靜態資料走 CDN 快照，不要擠 RPC 的併發排隊**（多人同打是 O(N)，CDN 是 O(1)）。→ [PRINCIPLES「靜態層讀取走 CDN 快照」](../.claude/memory/PRINCIPLES.md#靜態層讀取走-cdn-快照別擠-rpc-併發排隊2026-07-04bc-8-教訓)
4. **規則寫了不代表被遵守，量測腳本比規則文字有效**：「靜態 3D 不 triggerRepaint」4 月就寫了，9 月仍有 13 層違反。→ [perf-audit 2026-09-30 §5 教訓](./audit/perf-audit-2026-09-30.md)
5. **換內容一律換檔名**，immutable 快取只給帶日期或內容雜湊的檔；部署前探測新 URL 要加 cache-buster，否則 404 會被快取數小時。→ [PRINCIPLES「immutable 快取只給…」](../.claude/memory/PRINCIPLES.md#immutable-快取只給檔名含日期或內容雜湊的檔2026-08-08-立2026-08-09-擴充)、[PRINCIPLES「deploy 完成前探測新 URL」](../.claude/memory/PRINCIPLES.md#deploy-完成前探測新-url一律加-cache-buster2026-08-10)；Cloudflare 規則不要罩整個父路徑，會把 `current.json` 這類可變指標一起凍住 → [INCIDENTS 2026-09-10](../.claude/memory/INCIDENTS.md#2026-09-10-statistics-r2-broad-cache-rule-凍結-mutable-pointer)
6. **保存層求完整、成品包求小**，前端不直讀保存層（S3 egress 一年比儲存還貴）。→ [PRINCIPLES「保存層 vs 成品包分離」](../.claude/memory/PRINCIPLES.md#保存層-vs-成品包分離-p02026-08-08-nightly-trails-教訓)
7. **先量再改，估算要標「估算」**：road_congestion 類比得 81%，實測只有 57%。→ [PRINCIPLES「跨主題工作原則」](../.claude/memory/PRINCIPLES.md#跨主題工作原則2026-10-16-從-reflections-升級)
8. **Disk IO 要看 pg_stat_io**：pg_stat_statements 看不到 autovacuum（實測約佔讀取 58%）；前端 anon RPC 全部加起來只有約 0.7 GB／天，壓力在 collector 寫入與 cron。→ gis-platform `docs/research/2026-10-12-disk-io-round2.md`（正本在 gis-platform，本 repo 只有 BACKLOG DIO-*）

## 5. AI、Agent 與 MCP 分析

1. **有 manifest 且能自動入倉就算可分析**；地圖看得到不等於分析可用，受限的標 `DISPLAY_ONLY`／HOLD 並寫解鎖條件。→ 根目錄 `CLAUDE.md` §5b、[PLAN-warehouse](./features/general-analysis/PLAN-warehouse-20260926.md#倉庫契約c)
2. **題庫標準答案要先用唯讀 SQL 驗算並存檔**；Agent 和題庫答案不同時兩邊都驗，修根因，不放寬檢查。→ [PRINCIPLES「題庫答案必須用查詢驗證過」](../.claude/memory/PRINCIPLES.md#題庫答案必須用查詢驗證過agent-的分數不能拿未驗證的答案判2026-10-02)
3. **擴充分析能力的方法：先量測 → 失敗分類 → 一輪只改一類 → 每項補回歸題**（Agent v2 從 6 題到 26/26）。→ [REFLECTIONS 2026-10-02～03 Pulse Agent v2](../.claude/memory/REFLECTIONS.md)
4. **驗收一定要有「接真地圖」那一輪**；倉庫工具分數高不代表使用者體驗好，相機動了也不代表結果已顯示（要 `shown:true` 或 browser readback）。→ [INCIDENTS「2026-10-02 Agent 回歸測試第一次接真地圖」](../.claude/memory/INCIDENTS.md#2026-10-02-agent-回歸測試第一次接真地圖四個潛藏-bug-一次現形)、[general-analysis STATUS](./features/general-analysis/STATUS.md#指標)
5. **要規則穩定生效，寫進 MCP server 指示**，不要只改 SKILL.md；Agent 有時根本不載 skill。鐵則要寫成能從工具紀錄檢查的條件，不寫「畫面要有動靜」這種無法驗的描述。→ MCP repo `src/research/server.ts`；[REFLECTIONS 2026-10-02～03](../.claude/memory/REFLECTIONS.md)
6. **Jev 只做候選分類**，schema、權限、資料健康與執行一律由 deterministic code 決定。→ [jev-routing-accelerator](./features/agent-research-workbench/jev-routing-accelerator.md)
7. **倉庫資料有已知坑，回答時要提醒**：再生能源許可一列是一筆地號不是一座電廠；A1 事故一列是一個當事人；北北基市區公車要用另一張站牌表；WRA 河道線沒有河名。→ [DATA_SCOPE](../.claude/memory/DATA_SCOPE.md)（部分）；完整清單目前在 MCP repo 題庫與個人 memory，待整理成 repo 內文件
8. **回答分清楚五種狀態**：找資料、授權、回讀、結果、呈現；地址內插點不稱精確門牌，直線距離不稱路網距離。→ [REFLECTIONS 2026-09-20～21 Layer Discovery](../.claude/memory/REFLECTIONS.md)

## 6. 網站哲學與產品原則

> 這一節沒有專屬正本，散在 spec、PRINCIPLES、feature README 與 REFLECTIONS；以下直接寫，並註明出處。

1. **誠實優先：沒有資料就說沒有。**
   null 不是 0、未涵蓋不是 0、缺值斷線不補 0，RPC 不准 `COALESCE(…, 0)`。
   統計缺值顯示「—」並保留原因；AI 回答把沒資料的地方說成「未涵蓋」，不說成 0。
   出處：[spec §6.5](./design-system/spec.md#65-null-不當-0)、[PRINCIPLES「NULL 與 0 語意分離」](../.claude/memory/PRINCIPLES.md#null-與-0-語意分離2026-08-02-共機資料教訓)、pulse-research MCP 指示。
2. **時間只用資料本身的時間。**
   拿不到就顯示無資料，不假裝即時；監看卡的「更新於」讀資料自帶的時間戳，不是抓取時間。
   出處：[PRINCIPLES「監看卡」](../.claude/memory/PRINCIPLES.md#監看卡資料本身的時間缺值不補-0顏色走主題舊版不動2026-10-03)；反例：監看卡只看傳輸狀態、缺值補 0，18 格停更看不出來（[INCIDENTS 2026-10-03](../.claude/memory/INCIDENTS.md#2026-10-03-監看模式壓力指數永遠更新中斷18-格停更看不出來)）。
3. **資料有限制就主動降級揭露，不為了畫面好看硬算總數。**
   共機只能誠實呈現「出現天數」，不宣稱合計架次；待審資料進表但預設排除、popup 標「待核實」；授權不足的圖層寧可缺席，lineage 留下缺口紀錄。
   出處：[pla-activity README](./features/pla-activity/README.md)、REFLECTIONS 2026-08-03 共機戰情板、2026-08-19、2026-08-29、2026-09-18~20。
4. **文案不越界。**
   地表溫度不是氣溫、多年中位數不是即時值、ΔT < 0 不等於涼爽；空白可能是沒資料，不是沒有現象。
   同理，地址內插點不稱精確門牌，直線距離不稱路網距離。
   出處：[urban-heat-lst README](./features/urban-heat-lst/README.md)「⚠️ 限制（UI 文案不要越界）」、REFLECTIONS 2026-09-20～21。
5. **使用者看不到內部代碼，回答第一句就是答案。**
   不露 layer key、表名、wh-N；技術但書最多一句；結尾只給一個「接下來可以看什麼」的問題。
   出處：[spec §6.3](./design-system/spec.md#63-不印內部識別碼)、pulse-research MCP 指示。
6. **不做占位功能，每階段可以獨立回退。**
   沒有功能的按鈕不放；大改版一個 Phase 一個 PR，使用者驗收的心理門檻比較低；拍板前先講清楚「改了 X 會變得像 Y」。
   出處：[spec §1](./design-system/spec.md#1-原則)、REFLECTIONS 2026-06-18 Design System。
7. **「能修」不等於「該現在修」；調查和動手分開。**
   過夜只查根因、備好修法，owner 一句話拍板再執行；順手發現的問題記 backlog，不塞進這個 PR。
   出處：REFLECTIONS 2026-06-13 衛星、2026-08-10 監看、2026-08-21/22 Monitor 微調。
8. **功能要對得上資料的形狀；政策做成資料。**
   船舶資料不跨年，所以不進「歷史模式」（那是給跨年度資料的 slider）。
   能用一個欄位表達的決策（例如 `fit: "content"`）就做成欄位，改決策是改兩行，不是改渲染邏輯。
   授權未標示的資料照常上線、標「授權待確認」，只有明確受限才不接。
   出處：[vessel-watch README](./features/vessel-watch/README.md#為什麼不做歷史模式)、REFLECTIONS 2026-08-10 監看、`AGENTS.md`「已決定事項」。

9. **要被搜尋引擎與 AI 找到，內容必須在原始 HTML、而且一篇一個網址。**
   蓋在地圖上的彈窗沒有獨立網址，GPTBot、ClaudeBot、PerplexityBot 也不跑 JavaScript；所以長文放同網域 `/blog/`，build 時產生靜態頁，地圖改用嵌入版放進文章。
   出處：[blog README「為什麼不做成地圖上的彈窗」](./features/blog/README.md#為什麼不做成地圖上的彈窗)、REFLECTIONS 2026-10-24。

## 7. 小實驗（含失敗的）

> 格式：試了什麼 → 結論。沒有其他正本的直接寫在這裡；出處多半是 [REFLECTIONS](../.claude/memory/REFLECTIONS.md) 的段落日期。

**動畫與視覺**
1. **垃圾車時刻表動畫試了 7 個方案**（gap 淡出、對稱停留、Catmull-Rom、距離淡出、trip 斷點 600→1500 秒）
   → Catmull-Rom 與距離門檻都失敗；根因是地廣區的 gap 差 10 倍，量化 gap 分布後才找到。三個方案沒解就先量分布。（REFLECTIONS 2026-05-10）
2. **raster-color-mix 係數：照原始碼推導 vs 像素取樣**
   → 推導版讓整層飽和成單色；像素取樣才是證據，既有能動的圖層就是對照組。（REFLECTIONS 2026-07-29/31；[PRINCIPLES「raster-color-mix 係數」](../.claude/memory/PRINCIPLES.md#raster-值編碼圖層的-raster-color-mix-係數-p02026-07-31-實測定案)）
3. **Bloom 發光實驗**（4 個測試層、三種技法）
   → 學到「同一個 gl context 只能掛一個 Three.js 實例」「光暈要隨縮放自適應」，兩條都升級成規則；視覺本身沒上線，2026-07-02 後暫停。（[bloom-experiments](./features/bloom-experiments/README.md)）
4. **夜景三條路線**（Mapbox 原生、Three.js bloom、離線點集）
   → 使用者選 Mapbox 原生；能用原生畫的就不上 Three.js。（REFLECTIONS 2026-07-22）
5. **浮空柱與雨量熱區的尺寸**
   → 柱體浮高 `FLOAT_Z` 近景出框、半徑縮到 0.00002 在 z5 不到 1px，補回 0.00005；雨量 heatmap 低值站大量疊加看起來像豪雨，weight 要壓低值。都是只看單一縮放調參的結果。（REFLECTIONS 2026-04-23、2026-06-19）
6. **R6 箭頭沒對到軌道**
   → 量距離只差 <0.4px，問題不在座標；根因是底圖切換時 RailTracksHost 沒重建。先量再猜。（REFLECTIONS 2026-10-06～15）

**資料與管線**
7. **警察等時圈從 convex 改 concave(0.5)＋dissolve**
   → 26,644 片降到 73 片、14 MB 降到 5.8 MB，從不能用變成能用，現在是 Mode B 預設。（REFLECTIONS 2026-07-01 警政；[PRINCIPLES「Isochrone Mode B」](../.claude/memory/PRINCIPLES.md#isochrone-mode-b-的預設就是-concave_hull05--buffer--dissolve2026-07-01)）
8. **用 Overpass mirror 與 pyrosm 跑全台路網**
   → 卡 8 小時、吃到 50 GB RAM，失敗。改成本機 PBF 優先、跑前先試算 RAM。（INCIDENTS 2026-06-22；[PRINCIPLES「跑 osmnx / pyrosm 前先 find PBF 本機」](../.claude/memory/PRINCIPLES.md#跑-osmnx--pyrosm-前先-find-pbf-本機2026-07-01)）
9. **共機航跡圖向量化自創幾何指標**（填充率、空心度）
   → 兩次失敗，改用圖面上的表格項次當 ground truth。（REFLECTIONS 2026-08-01/02；[PRINCIPLES「守門優先用資料自帶的 ground truth」](../.claude/memory/PRINCIPLES.md#守門優先用資料自帶的-ground-truth2026-08-02)）
10. **軌跡幾何簡化逐車比對 2,975 次**
    → p50 1.66m／p95 7.31m，訂下 p95<30m、max<100m 的關卡。「無損」要用下游消費者的行為驗，不用肉眼。（REFLECTIONS 2026-08-06~09）另一個坑：平面簡化守約，但用 geography 量距離會把長弦當測地線，誤差 290–405 m → [pitfall 2026-08-20](../.claude/pitfalls/2026-08-20-simplify-planar-vs-geography-distance.md)。
11. **VW-9 唯讀 POC**
    → 「進入事件數」174 天只有 8 天有值，改做「距離趨勢」。先做最小 POC 再定設計。（REFLECTIONS 2026-08-20）
12. **LST 衛星 pipeline**（STAC → 位元遮罩 → 分位數門檻 → 多年 median → 相對正規化 → 值編碼）
    → 成功，並寫成可遷移的方法論文件；上線後被問到的問題直接回收成 FAQ——被問的問題就是文件的缺口。（REFLECTIONS 2026-07-29/31）

**工具與平台**
13. **MapLibre × Three.js 數值 spike**
    → 和 `map.project` 誤差 ≤0.01px，可行；但誤取 `mainMatrix` 會把物件靜默投到畫面外約 −54,000px，不報錯。（REFLECTIONS 2026-08-06~09；[GLOSSARY](../.claude/memory/GLOSSARY.md)「`mainMatrix`」）
14. **衛星：Mapbox globe 能不能取代 Three.js？**
    → satellite-art 從沒試過 Mapbox，當初選 Three.js 是為了畫太陽系；「不需要 X」要附驗證紀錄，不能憑印象。（REFLECTIONS 2026-06-13 衛星）
15. **TVBS 直播嵌入失敗**
    → 先猜網域白名單，四格並排嵌入對照實驗才證明是 `channel=` 路徑問題；用 curl 打 player API 的檢查法對任何影片都失敗，整段證據作廢。對照實驗勝過猜測。（REFLECTIONS 2026-07-26/27）
16. **Python 預設 User-Agent 抓正式站資產被 Cloudflare 擋 403**
    → 改用 curl 就正常；是工具差異，不是缺檔。（REFLECTIONS 2026-09-18~20）
17. **road_congestion 去重省量估算**
    → 用類比估出 81%，實測（LAG）只有約 57%；估算數字要標「估算」。（REFLECTIONS 2026-09-01）
18. **效能 P2「關閉的圖層開站不建」**
    → 量測後發現值得做的是「換主題時跳過隱藏層」，280ms 降到 0.1ms，原構想改掉。（REFLECTIONS 2026-10-02～04 效能）

## 8. 資料契約與跨 repo

1. **上游先動、下游後動**：analytics → gis-platform → collectors → pulse；反過來會讓前端硬依賴不存在的欄位。→ 根目錄 `CLAUDE.md`「跨 repo 同步順序」、[git-workflow](./git-workflow.md#跨-repo-同步順序有資料契約變動時)
2. **「0 筆是合法結果」的表不能當心跳**；降低輪詢頻率一定要配「上游恢復」告警。→ [PRINCIPLES「0 筆是合法結果…」](../.claude/memory/PRINCIPLES.md#0-筆是合法結果的表不能當心跳-p02026-08-07-三連斷供教訓)、[pitfall 上游靜默斷供](../.claude/pitfalls/2026-08-07-silent-upstream-outage.md)
3. **RLS 要同時授權 anon 和 authenticated**；驗 anon 權限一律在交易內用 `SET LOCAL ROLE`。→ [PRINCIPLES「RLS policy 角色完整性」](../.claude/memory/PRINCIPLES.md#rls-policy-角色完整性-p02026-07-26-登入半殘站教訓)、[pitfall live RLS](../.claude/pitfalls/2026-07-26-live-rls-anon-only.md)
4. **契約 ratchet 守得住型別，守不住筆數**；筆數位移要另外守。→ [PRINCIPLES「資料契約 ratchet 守不到筆數位移」](../.claude/memory/PRINCIPLES.md#資料契約-ratchet-守不到筆數位移2026-08-06)
5. **handoff 裡的「預期數字」會過時**，開工前實查。→ [PRINCIPLES「跨主題工作原則」](../.claude/memory/PRINCIPLES.md#跨主題工作原則2026-10-16-從-reflections-升級)
6. **在 worktree 驗證會靜默 skip 跨 repo 測試**（假綠）。→ [PRINCIPLES「worktree 驗證會靜默 skip 跨 repo 測試」](../.claude/memory/PRINCIPLES.md#worktree-驗證會靜默-skip-跨-repo-測試-p02026-08-20-教訓)
7. **修資料前先確認寫入端已部署新版**，否則修完又被壞資料蓋回去。→ [PRINCIPLES「跨主題工作原則」](../.claude/memory/PRINCIPLES.md#跨主題工作原則2026-10-16-從-reflections-升級)
8. **新增 `public/` 子目錄要三處接線**（upload 腳本、pull 腳本、nginx），漏一處就是容器上 404、本機正常。→ [PRINCIPLES「部署資產三處接線」](../.claude/memory/PRINCIPLES.md#部署資產三處接線2026-06-12林班事件)

## 9. 工作流程、git 與發布

1. **PR 一律進 develop；develop→master 是正式部署，要使用者拍板；只用 merge commit**（不 squash、不 rebase）。→ 根目錄 `CLAUDE.md`「Git Workflow」、[RELEASING](./RELEASING.md#發布步驟)
2. **平行 session 是常態**：不 `reset --hard`（改 `reset --keep` 或 `branch -f`）、不 `git add -A`、commit 前確認分支、不碰別人的髒檔。→ [PRINCIPLES「共用 worktree 有平行 session 時的 git 紀律」](../.claude/memory/PRINCIPLES.md#共用-worktree-有平行-session-時的-git-紀律2026-07-24-教訓)
3. **「已完成」必須有工具佐證**（git、psql、curl、CI 結果），不靠記憶或敘述。→ PRINCIPLES「⚠️ P0 『已完成』必有工具佐證」（[PRINCIPLES](../.claude/memory/PRINCIPLES.md)）
4. **合併前等 CI 檢查出現並跑完**，PR 顯示 CLEAN 不代表 CI 已跑完。→ [PRINCIPLES「跨主題工作原則」](../.claude/memory/PRINCIPLES.md#跨主題工作原則2026-10-16-從-reflections-升級)
5. **PR 依「能獨立驗證、能獨立回退」的單位拆**。→ [PRINCIPLES「PR 依可獨立驗證與回復的 release unit 拆分」](../.claude/memory/PRINCIPLES.md#pr-依可獨立驗證與回復的-release-unit拆分2026-08-24)
6. **平行派工先分檔案所有權＋禁改清單**；長跑子代理每個子階段先 commit；派工附可量化的驗收關卡。→ [PB-37](../.claude/memory/PLAYBOOKS.md#pb-37-多-agent-worktree-平行開發-wave2026-08-10-定型稽核執行-8-批-7-pr-一次成型)、[PRINCIPLES「跨主題工作原則」](../.claude/memory/PRINCIPLES.md#跨主題工作原則2026-10-16-從-reflections-升級)；用 agent-browser 的 worker 要給唯一 session 名＋每呼叫 60 秒上限，同名 daemon 會互卡 → [INCIDENTS 2026-10-02](../.claude/memory/INCIDENTS.md#2026-10-02-r5-校正子代理兩度停滯-600-秒同名-agent-browser-daemon-互卡)
7. **「沒有」的證據先驗量測手段看不看得到**：Resource Timing 只留 250 筆、lazy chunk、本機 `grep` 是會吞輸出的 shell function（否定結論用 `/usr/bin/grep` 或 `rg` 複驗）。→ [PRINCIPLES「跨主題工作原則」](../.claude/memory/PRINCIPLES.md#跨主題工作原則2026-10-16-從-reflections-升級)
8. **migration 取號前 `git fetch` 看 origin 最大號**。→ [PRINCIPLES「跨主題工作原則」](../.claude/memory/PRINCIPLES.md#跨主題工作原則2026-10-16-從-reflections-升級)

## 10. 過時文件索引（2026-10-16）

本次盤點改寫或標過時的項目。標過時的段落保留原文供追溯，段首有 `⚠️ 過時（2026-10-16）` 或「2026-10-16 改寫／補註」字樣。

| 位置 | 處理 | 現行做法見 |
|---|---|---|
| `docs/TIMELINE_ARCHITECTURE.md` | 改寫成現況（實作狀態表＋timeStore 一節），2026-03 設計稿留作附錄 | 同檔 |
| `docs/known-issues.md` | 併入 INCIDENTS 末段後歸檔到 `docs/archive/2026-10-16/known-issues.md` | [INCIDENTS](../.claude/memory/INCIDENTS.md) |
| development-rules §4 params 流程 | 改寫（`useLayerParamsRuntime.ts` 已退役）；#10 `DEFAULT_ON` 路徑、檢查清單、§7 部署指標更正 | [development-rules §4](./development-rules.md#4-新增-layer-流程manifest-first-觸點表) |
| development-rules §4a | 新增四鐵則／產品政策／視覺驗收三份清單的對照表 | [development-rules §4a](./development-rules.md#4a-圖層-ux-標配四大鐵則) |
| `docs/layer-ux-policy.md` | 「UI 一律繁中」改為跟目前語系；2026-08-29 基線數字標過時 | 同檔、[spec §6.6](./design-system/spec.md#66-多語系2026-10-12自動切換-2026-10-16) |
| `docs/supabase-optimization.md` | `realtime.*`→`live.*`；cron `*/10`→`*/15`；`statement_timeout` 統一（一般 30s、大 payload 60s、cron 0）；範本 cron 改台北日期；搬入 OOM 五條 | 同檔 |
| PRINCIPLES：新增 Layer 7 步、四鐵則實作路徑、Design System 快照、資料來源／Loading／時間訂閱／Supabase 優化摘要 | 縮成一行指標 | development-rules、spec、supabase-optimization |
| PRINCIPLES：cherry-pick hook、Stacked PR（squash／master）、`realtime.*`、`SET ROLE anon`、boolean overlayParams 範例 | 改寫成現行規則 | 各段段首註記 |
| PRINCIPLES：isStyleLoaded 三段 | 合成一段 | [PRINCIPLES「Mapbox 掛載與 isStyleLoaded」](../.claude/memory/PRINCIPLES.md#mapbox-掛載與-isstyleloaded三段合一2026-10-16) |
| PLAYBOOKS PB-01、PB-03、PB-XX、PB-17 衛星、PB-20、PB-25～29、PB-32、PB-37、PB-40 | 改 manifest-first、PR→develop、`--merge`、`reset --keep`、`npm`、`scripts/deploy/` | 各 PB |
| PLAYBOOKS PB-21 | 標過時（只適用 2026-09-15 前的 squash 歷史） | 同段 |
| INCIDENTS 2026-04-07 船舶全空 | 補註同日兩事件，以 pitfall 為正本；行號引用改段標題 | [pitfall 2026-04-07](../.claude/pitfalls/2026-04-07-empty-ships-flights.md) |
| pitfall 2026-07-01 A2、B 段；pitfall 2026-04-22 的 `lessons.md` 引用 | 改寫成現況 | 同檔 |
| `.claude/README.md`、`.claude/HARNESS.md`（L1／L3）、`.claude/memory/README.md` | 目錄樹、SessionStart 描述、選讀順序改成現況 | 同檔 |
| DATA_SCOPE、GLOSSARY | 檔頂註記 `realtime`→`live` 與快照性質；寫死數字標時點；路徑更正 | 同檔 |
| `docs/archive/2026-10-16/claude/memory/FORESTRY_GROUP_STATUS.md`、`PMTILES_STATUS.md`、`.claude/SATELLITE_CONSOLE_STATUS.md` | 已完成的 campaign，另一軌移到 `docs/archive/2026-10-16/` | — |
| REFLECTIONS 已被推翻的舊反思 | 檔首加索引列出（兩個 sidebar、pnpm、hook 預載、squash、EM-16 等） | [REFLECTIONS](../.claude/memory/REFLECTIONS.md) |
