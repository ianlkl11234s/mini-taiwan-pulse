# R6 交接：Three.js 圖層加「基本點線面」模式

> 狀態：🚧 段 1 實作中（2026-10-05；2026-10-04 交接）。地圖改版 R1–R5、R7、R8 已全部合併（至 #523），R6 是最後一輪。
> 進度總表：[`docs/design-system/README.md`](../../design-system/README.md)「目前進度」。規格：[`map-layers.md`](../../design-system/map-layers.md) §3.4 **G-1**。

## 1. 要做什麼

網站上用 Three.js／CustomLayer 畫的立體圖層（飛機、船、公車、台鐵、光柱、光弧、漣漪…）沒有吃到 R1–R5 的設計系統數值。2026-09-28 已拍板 **G-1**：

- 每個 Three.js／CustomLayer 圖層都加一個**「基本點線面」模式**：用 Mapbox 原生 circle／line／fill 畫同一份資料，套 `map-layers.md` §3 的數值階（點三階、線三階、面透明度、描邊）。
- **預設是 Mapbox 平面模式**；Three.js 立體版保留，可切回。
- 兩種模式都要符合圖層 UX 四鐵則（透明度、圖例、popup、select）。
- Three.js 模式本身的值在 shader／材質裡，不進數值階。

## 2. ⚠️ 使用者要求：影響大，要多次核對

使用者 2026-10-04 明說「感覺有可能會影響較大，要跟我核對比較多次」。所以：

- **先盤點、不動程式**。盤點結果用選擇頁給使用者逐題選，選完寫進提案，再分段實作。
- 每一段實作前後都給對照頁（暗／淡、拉遠／拉近、移動物件要有動態示意），使用者確認再進下一段。
- 子代理自行擴大範圍或做了使用者沒選過的決定，交付時逐項列出請使用者確認（R8 時發生過：面板標題改名、統計主題展開）。

## 3. 開工前要盤點的（第一步）

目前程式裡約有：

- `src/map/*CustomLayer.ts` 19 個：buildingsNightBloom、bus、earthquakeRipple、fireStation、gfwV4Track、historicalFlightTrails、lighthouse、osmPowerLinesGlow、powerGenerationBeam、powerPlantGlow、powerRegionBars、realEstatePoints、reservoir、stationPillar、substationEhvGlow、temperatureWave、wasteFacility、wasteSchedule、wasteTruck。
- `src/three/*Scene.ts` 20 個（含 Flight、Ship、Rail、GlowPoints、WasteMusicNote 等沒有對應 CustomLayer 檔名的）。
- `docs/design-system/layer-style-inventory.json` 中標 `unresolved` 的 Three.js 層（G-1 寫 13 層，有檔案指標）。
- 開關與延後載入：`src/map/lazyThreeLayers.ts`（打開才建，#464／#476）。

每層要記下：圖層 key、中文名、資料來源與幾何（點／線／面／移動物件）、是否時間動態（timeStore 訂閱）、現在有沒有平面替代（例：捷運已有「Mapbox 點位／實際範圍（光暈示意）」兩模式、車站光柱預設關 #393）、點數、popup 與圖例現況、效能（移動物件數量）。

## 4. 要使用者決定的（選擇頁題目草案）

1. **範圍**：哪些層納入？主要移動物件（飛機、船、公車、台鐵）是否納入；純裝飾效果（夜光、光柱、光弧、音符）要不要做平面版或直接維持立體。
2. **開關位置**：每層設定裡一個「立體／平面」切換（建議，照 R8 設定區順序放在顏色附近），或全站一個總開關，或兩者都有。
3. **移動物件在平面模式怎麼動**：點平滑移動（資料 lerp 插值，見全域偏好「平滑過渡＝資料插值，非 CSS／GL transition」）、軌跡線怎麼畫、方向箭頭要不要（P-5 icon 規則）。
4. **預設**：G-1 定的是「預設平面」；使用者現在是否仍要預設平面（會改變開站時飛機、船、公車的外觀，影響大）。
5. **效能**：大量移動物件（公車、船）在 Mapbox circle 上每幀 setData 的成本；必要時的抽樣或 LOD。

## 5. 做法建議（依 R5／R7／R8 經驗）

- 流程：盤點（唯讀子代理）→ 選擇頁（暗／淡、真實樣子、可一鍵複製答案）→ 寫提案 → 分段 PR（每段一支、一般 merge、CI 綠才合）→ 每段對照頁。
- 新增「立體／平面」若做成控制項，照 R7 `palette`／R8 `linkedSelect` 的 6 個接點（spec 聯集型別、`src/state/layerParamsControls.ts`、`LayerParamControls.tsx`、manifest `params.kinds`、`research/layerControls.ts`、`src/lib/memberSceneAdapter.ts`），並同步 MCP 工具說明（mini-pulse-gis-mcp）。
- 每層兩種模式的圖例要分別正確；Agent 讀圖層控制時要看得到模式。
- 動態圖層不得把 `currentTime` 放進 deps（CLAUDE.md 規則 6）；切主題、拖透明度只改 paint、不重抓（#481）；換底圖用快取重建。
- 活的元件頁（`src/design-system/`）有新元件就同時加一段，不要等收尾。

## 6. 執行注意（踩過的坑）

- agent-browser：每個 worker 用**唯一 session 名**，每個呼叫包 `perl -e 'alarm 60; exec @ARGV' --`，連續逾時就只關自己的 daemon 換名重開（`.claude/memory/INCIDENTS.md` 2026-10-02）。WebGL 啟動參數見全域記憶 `agent-browser-mapbox-verify`。
- worktree 缺大型圖資：暫時 vite 設定 `publicDir` 指主目錄 `public/`（不 commit）；改前基準開在 `.worktrees/` 下。
- 絕不 `pkill -f vite`；用 lsof 找 PID。
- 全套測試裡 research 的硬時間預算測試在負載下偶爾逾時，單獨重跑確認即可。
- 合併後更新 `.worktrees/analysis-prod/mini`；MCP 改了要 build，並請使用者 `/mcp` 重連。

## 7. 相關

- 規格：`docs/design-system/map-layers.md` §3.4 G-1、§3.1 P-5（icon）、§4（圖例）；`docs/design-system/spec.md` §5.5／§5.11／§5.36／§5.37。
- 前幾輪：`PLAN.md`、`R3b-report.md`、`R4-report.md`、`r5-compare.html`；配色與面板統一：`docs/features/layer-color-picker/`、`docs/features/layer-panel-unify/`。
- Three.js 元件案例庫：`public/three-showcase.html`；接線手冊：skill `three-3d-component`。
