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
- 缺值用灰色、遮蔽用斜線，圖例同時提供文字；不可反推遮蔽資料。
- `PARTIAL`、`STALE`、分子／分母 coverage、未分配量和來源限定範圍必須保留。有值的地區先顯示，不等全臺完整。
- 讀取失敗顯示錯誤及重試，不能改成「沒有資料」或宣稱全區為零。

## 3. 清單、群組與操作

- 一般圖層與整合群組共用滑動 toggle；toggle 只控制顯示，箭頭／標題展開詳情，select 切換指標或統計口徑。不要另做文字「開／關」圓鈕。
- 名稱保持主文字色：深色主題白色、淺色主題對應深色。關閉狀態由 toggle 表達，不將名稱變灰；權限鎖定仍保留既有提示。
- 統計主題 icon 在關閉時仍可辨識；不要用回收／圖層堆疊 icon 當所有統計的預設圖案。
- 教育固定學制入口維持學校端、老師端、學生端；醫療依機構／病床／人力等群組整理；住宅保留主要使用類型，縣市／鄉鎮與比例在相應群組內切換。
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
- 數量、密度、率、占比使用有序順序色階：淺→深代表低→高。不要彩虹色，也不以紅／綠暗示好壞。
- 有正負意義的增減使用雙向 PuOr：棕負、紫非負；現有分級以 0 為分界，沒有單獨的「零值中性色」類別。
- 分級門檻屬比較契約：不可為了每張圖都五顏六色而按當次資料任意重算 quantile。變更門檻需另寫理由及對跨期比較的影響。
- 色票至少有 `breaks.length + 1` 色；重複門檻經 `statisticsColorStops` 合併，map／legend 必須一致。
- 同一主題的原始數、人均值與面積平均保持同色系；切換指標後同時刷新 map 色階與 legend 的數值／單位。
- 色覺驗證包含一般及 protan／deutan／tritan 模擬的明度順序；目前測試以相鄰 CIELAB L* 差大於 5 作為護欄。這是色票測試，不是所有視覺障礙的可用性保證；還要檢查底圖與透明度下的真實畫面。
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
