# 統計圖層維護與驗收規則

適用新增、整合、改名、衍生計算、來源更新及統計 UI 修改。入口以 Statistics 為主；不得因整合而遺失原始指標或來源資訊。

## 1. 資料意義先於地圖外觀

- 保留 dataset、indicator、release、dimensions 的 exact selector；名稱相近不代表可互換。
- 同時標示觀察期間、單位、地理層級、分母與來源。發布日／下載日不得當成觀察年份。
- 人均／每平方公里／占比必須說明分子、分母、倍率、年份及母體。居民人口率不是服務使用率；登錄人次不是不重複人數；學校所在地不是學生居住地。
- 同口徑、同母體及相容年份才可跨區比較；不可靠或不相容的分母不得硬算。不同單位的相同顏色不可直接比較。
- 縣市與鄉鎮切換只能使用該層級的來源或有證據的彙總；不可把縣市值複製到每個鄉鎮。全臺占比的分母不可使用部分已知縣市的合計冒充全臺。
- reference geometry 不等於統計當年的原生界線；保留 boundary version、geometry role 與來源界線定義。

## 2. 缺值、零值與資料狀態

- observed 0 是真零，使用數值色階；null、來源「-」、not_reported、suppressed 不得補 0。
- 缺值（null、未發布、not_reported）用**透明底＋單向 45° 細斜線**，遮蔽（suppressed）用**透明底＋交叉斜線**，兩者都不上色、不畫成 0；圖例同時提供文字（2026-09-28 地圖圖層規格 F-3 A，對齊 viz-library N1；見 `design-system-map-layers.md` §3.3）。不可反推遮蔽資料。recipe 的 `legend.missing_color` 已不用於地圖與圖例。
- `PARTIAL`、`STALE`、分子／分母 coverage、未分配量和來源限定範圍必須保留。有值的地區先顯示，不等全臺完整。
- 讀取失敗顯示錯誤及重試，不能改成「沒有資料」或宣稱全區為零。

## 3. 清單、群組與操作

- 台灣統計的主題與群組只有一套（TWL-12，2026-11-08）：正本是 `src/data/statisticsTabThemes.ts`，統計入口、完整目錄（資料來源總覽、搜尋）與 manifest `section` 都從它產生，所以統計層的 `section` 就是它在統計入口的位置。新增台灣統計層時把 key 登記進這份正本，不要在 manifest 手寫主題名；recipe 的 `group`／`data_theme` 是來源分類，不決定擺放位置（選舉 atlas 例外：不在正本裡，仍依 `data_theme` 併進 GIS「政治」主題）。
- 一般圖層與整合群組共用滑動 toggle；toggle 只控制顯示，箭頭／標題展開詳情，select 切換指標或統計口徑。不要另做文字「開／關」圓鈕。
- 期別、指標、細項、群組「指標／口徑」一律是共用規格的**連動選單**（`kind: "linkedSelect"`，設計系統 spec §5.37）：由 `data/statisticsParamsSpec.ts` 依 recipe 目錄派生，不在元件裡手寫 select。新增 recipe 時：releaseSelector 要宣告 `dimensionKeys`（＝`resolve` 輸出的鍵與順序，連動的上下游順序）；農業／社會／勞動／比較讀 catalog 的維度鍵順序；群組成員加進 `medicalStatisticsGroups.ts` 就會自動有「指標」列與群組列（`LayerDef.variant`）。
- 連動規則：上游改變時下游目前值仍合法就保留，否則改成第一個合法值；只有一個值的維度不顯示，目前選擇寫在「說明・來源」。說明・來源固定在展開區最後，含位置口徑、資料限制、來源與處理紀錄。
- 參考邊界與說明文字裡的邊界代碼顯示中文（`boundaryVersionLabel`／`humanizeStatisticsText`）；新邊界版本要在 `statisticsLabels.ts` 對照表補一列，否則顯示「未命名的參考邊界版本」。
- 名稱保持主文字色：深色主題白色、淺色主題對應深色。關閉狀態由 toggle 表達，不將名稱變灰；權限鎖定仍保留既有提示。
- 統計主題 icon 在關閉時仍可辨識；不要用回收／圖層堆疊 icon 當所有統計的預設圖案。
- 教育固定學制入口維持學校端、老師端、學生端；醫療依機構／病床／人力等群組整理；住宅保留主要使用類型，縣市／鄉鎮與比例在相應群組內切換。
- **多年份並排**（`StatisticsSmallMultiples`，設計提案 Q-F 方案 1，2026-11-11；2026-11-12 改版面 b）：資料期別選單右側的小圖示鈕（可並排 ≥2 年才出現），不用逐層登記。視窗上方勾年份、最多 4 期（預設最早、最新與平均分布的中間兩年），只載勾選的期別；大圖同步描邊並顯示各期數值與跟最早一期的差，缺值與未發布寫明原因。年份＝非時間維度與目前相同的期別依年分組，每年取與目前期別同跨度（起訖月日）的一期，沒有就取該年最後一期；期別不一致時視窗上方用一句話說明（由實際期別產生），不在個別圖上標示。各年一律用目前選擇的分級門檻與色階（固定門檻，不依年重算），缺值／遮蔽畫法同主地圖；總量類小圖仍是面量圖，大區或人口多的區顏色本來就深，視窗會提示適合看同一區各年變化，不適合跨區比大小。新的維度鍵要在 `data/statisticsSmallMultiples.ts` 分類成時間或系列維度（測試守門）。村里層與統計區不提供（邊界 80 MB 以上，需另做簡化檔）。
- 切換到另一口徑需維持可配對期別與共用 dimensions。無相同期別應說明不可用，不能靜默跳到不同年份冒充比較。
- 不以 UI 分組變更資料 recipe 身分；完整來源選項仍需能在資料來源總覽被找到。
- 保留 loading、透明度、數字圖例、點擊資訊；單一／可重疊模式及統計全關需同時涵蓋群組、隱藏相容 key 與教育 views。
- 手機檢查名稱換行、icon 不縮掉、toggle／select 可操作、詳情可捲動、無水平溢出；viewport 模擬不可稱實體手機驗收。

## 4. Icon 與配色

唯一視覺規則入口為 `src/data/statisticsVisuals.ts`。manifest 派生 icon/accent；map 與 legend 透過 `statisticsRenderRecipe` 使用同一份數值色階。不要在群組元件硬寫藍色或自行建立另一套 legend 色票。

| 主題 | icon 例 | 數值色系 |
|---|---|---|
| 教育 | 學校／教學板／學士帽 | Purples 紫 |
| 醫療長照 | 醫院／病床／聽診器／照護 | BuGn 藍綠 |
| 住宅 | 房屋 | Oranges 橙 |
| 交通 | 公車／自行車／汽機車／飛機／船／軌道／事故警示 | Blues 藍 |
| 農業、畜牧 | 麥穗、牛 | YlGn 黃綠、YlOrBr 黃棕 |
| 漁業、林業 | 魚、樹木 | PuBu 紫藍、Greens 綠 |
| 環境、公用事業 | 回收／垃圾／噪音、電力／水 | BuPu 藍紫、GnBu 綠藍 |

- icon 與清單 accent 是分類提示；圖形、文字共同辨識，不能只靠不同色相區分主題。
- 數量、密度、率、占比使用有序順序色階，**兩種底圖同方向：淺 → 深代表低 → 高（越深越多）**（2026-11-10 使用者決定，design-system map-layers §3.6 K-4 統計例外、§3.9）：
  - 淡色底圖（light、streets）：`colors`（ColorBrewer），填色透明度預設 0.55。
  - 暗色底圖（dark、Pure Black、衛星等其餘）：`darkColors`，方向相同，只調明度下限與彩度：最深一級用中低明度、高彩度的飽和色（不用近黑深色），填色透明度預設 0.75。
  - 透明度滑桿顯示實際值；沒動過時換底圖跟著換預設值，動過就保留（`regionalStatisticsMap`）。
  - 門檻（每個 render key 的實際輸出、含重新取樣的級數，以 0.75 疊在暗陸 `#292828`）：對比單調、最淺一級 6–9、最深一級 ≥ 2.2 且 OKLCH 彩度 ≥ 0.10、相鄰級 OKLab ΔE ≥ 4（目標 8）（`statisticsDarkRamp.test.ts`）；新主題要同時給 `colors` 與 `darkColors`。
  - 不要彩虹色，也不以紅／綠暗示好壞。圖例說明文字兩種底圖相同（「淺 → 深」「最淺／最深」）。
- 有正負意義的增減使用雙向 PuOr：棕負、紫非負；現有分級以 0 為分界，沒有單獨的「零值中性色」類別。暗底版同方向：近 0 最淺（對比約 7.9）、兩端最深最飽和（約 2.5、彩度 0.13–0.15）。
- 政黨色（藍綠差、依政黨得票率、最高黨類別）不分底圖；暗底下依政黨得票率最高級、藍綠差兩端對比偏低，已登記在對比契約基準（`statistics-party`），改不改另行拍板。
- 分級門檻屬比較契約：不可為了每張圖都五顏六色而按當次資料任意重算 quantile。變更門檻需另寫理由及對跨期比較的影響。
- 色票至少有 `breaks.length + 1` 色；重複門檻經 `statisticsColorStops` 合併，map／legend 必須一致。
- 同一主題的原始數、人均值與面積平均保持同色系；切換指標後同時刷新 map 色階與 legend 的數值／單位。
- 色覺驗證包含一般及 protan／deutan／tritan 模擬的明度順序（淡底與暗底兩組都驗）；目前測試以相鄰 CIELAB L* 差大於 5 作為護欄。這是色票測試，不是所有視覺障礙的可用性保證；還要檢查底圖與透明度下的真實畫面。
- 獨立 renderer（如犯罪統計）應單獨檢查 map／legend，不可假設共用 recipe 的色階會自動套用。行政邊界不是數值色階。

方法參考：[ColorBrewer](https://colorbrewer2.org/learnmore/schemes_full.html)、[Matplotlib](https://matplotlib.org/stable/users/explain/colors/colormaps.html)、[Machado 2009 模擬矩陣](https://github.com/njsmith/colorspacious/blob/master/colorspacious/cvd.py)。

## 5. 資料來源總覽是必要交付

- 新增／改名／合併圖層、增加指標或 selector 時，一併更新「資料來源總覽」的可發現性與詳細來源卡，不能只補 sidebar。
- 一個群組可有多個來源；總覽應涵蓋可用的原始與衍生選項、固定教育入口，並去重、遵守正式 UI 啟用開關。
- 來源卡需交代：中文名稱、原始／衍生性質、來源 dataset／indicator、觀察期間、單位、地理層級、來源說明／可用原始連結，以及衍生方法與限制。
- 發布 CDN 是傳輸位置，不是資料生產機關。不能把 R2、平台自身或 manifest 的 `verified` 當成官方認證。
- 本地 recipe 已有的來源定義不得因遠端 catalog RPC 未收錄而消失；缺少機關／URL／授權等資訊要明示未知，不得捏造。
- 總覽搜尋需找得到合併群組內的選項。驗收至少含教育入口、醫療衍生值、住宅比例及農／交通指標，另確認其他圖層仍在。

## 6. 發布與驗收

- 統計值沿用 `regional-statistics-cdn-v1`：immutable artifact → immutable manifest → `current.json`，SHA／bytes／selector 驗證失敗就報錯。不 fallback 到資料庫讀值。
- 增量資料合入全量 manifest，保留既有 selector 與 geometry；不能拿交付包的小 manifest 覆蓋全量 CDN。
- 來源契約、色階與 UI 測試後跑 `npm test`、`npm run build`、`git diff --check`；必要的 browser：All Off → 單層 → 原始／比例切換 → 缺值與圖例 → 來源總覽 → 手機代表情境 → 全關。
- 分別記錄本地測試、真實 browser、CDN readback、正式部署，不互相替代。修改 changelog 與驗收證據；PR 保留一般 merge commit。

## 7. 呈現方式（面量圖／比例圓／點密度）

設計提案 Q-A 方案 2、Q-B 方案 1、Q-C 照表（使用者 2026-11-11 拍板）。地圖畫法見 [`design-system/map-layers.md`](./design-system/map-layers.md) §3.10。

- **預設一律面量圖**。可選清單由 recipe 的 `unit`／`aggregation`／名稱**自動推導**（`src/data/statisticsPresentation.ts`），不在 recipe JSON 手填；判斷不了的只給面量圖。
- **比例圓**只給總量：單位在總量白名單（人、件、處、戶、公頃、元…）、`aggregation` 沒寫或是 `sum`、沒有負值門檻、名稱與維度選項不像比率／平均／密度／中位數／有正負號（自然增加、淨遷徙、變動），而且是台灣縣市／鄉鎮市區／村里。**比率、每十萬人、占比、密度、中位數、平均、類別碼一律不給**（測試守門）。一個 key 可切多個指標（教育、勞動）時，每個指標都是總量才給。
- **點密度**（2026-11-12 露出）：只給比例圓可用、單位是人／件／戶、鄉鎮與村里層（縣市太大，點會集中在少數幾區的大面裡）；**據點數（處、所、站…）不給**，因為已有真實點位圖層。目前推導出 50 層（鄉鎮 42、村里 8）。點在區內隨機、**不代表實際地點**，圖例一定要寫；撒點規則見 map-layers.md §3.10。
- **逐層例外**寫在 `src/data/presentationOverrides.ts`（`default`／`hide`，每列寫理由；改了要發版）。目前：台糖公告列數（未去重）不給比例圓。
- **控制項**：「呈現方式」由規格產生（≤3 個選項＝分段鈕），排在資料篩選之後、透明度之前；**圖例只顯示、不放切換**。分享網址 `pm=` 只記非預設值。比例圓與點密度合計同時最多一層（兩層點疊在一起分不出是哪一層的點）。
- 新增統計層時不用另外登記：推導結果進 `layer-golden.json` 的 params，CI 會擋意外變動；推導猜錯就加覆寫或修推導規則並補測試。
