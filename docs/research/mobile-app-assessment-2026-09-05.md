# Mini Taiwan Pulse 手機 App 可行性與功能安排

研究日期：2026-09-05。程式碼基準：工作目錄 HEAD `88d2a0a`，含既有未提交修改；本次只新增研究文件。

證據範圍：本 repo 靜態程式碼盤點、競品官方網站／官方商店說明及平台文件。本次沒有操作競品原生 App，也沒有完成 Pulse 實機效能、production 資料或上架驗收。下列功能安排是設計建議，不是已實作功能。暫以一般使用者在手機查詢台灣現況為第一版情境；若核心使用者是進階分析者，首頁可改以地圖與常用圖層組合為主。

後續主站功能規劃見 [主站共用能力、AI 與 GIS 分析開發規劃](../proposal/main-site-ai-gis-roadmap-2026-09-05.md)：先處理搜尋、收藏／場景、分析語意與地點分析，再沿用於 App。新增文件已對照既有 Auth、BYOK 與 GIS 提案；尚未修改應用程式。

## 1. 判斷

適合發展手機 App。最有價值的使用流程是「看現況 → 讀事件 → 在地圖理解位置與周邊 → 分享」，四個指定能力都有位置。

主要改動在手機資訊架構、內容分層與 WebGL／資料載入的執行方式。現有 React、地圖資料契約與服務可作為起點；沒有足夠理由立即把地圖與 Three.js 全部重寫成原生。

建議第一版使用三個固定入口：**地圖、現況（Monitor）、情報**。Capture 是地圖與詳情頁的操作，先不設獨立主分頁。若日後有作品庫、編輯與大量輸出，再升級為獨立創作區。

## 2. 現有功能與缺口

| 區域 | 本次看到的現況 | 手機版工作 |
|---|---|---|
| 圖層 | catalog 有 37 個主題、114 個子群、394 個圖層項目；manifest 有 404 個登記 key，兩者口徑不同 | 保留完整目錄，但用搜尋、收藏、情境組合、已開啟圖層管理降低找尋成本；數量不代表每個使用者可用或資料正常 |
| 手機地圖 | 已有 compact header、時間軸與圖層 bottom sheet；手機圖層選擇器沒有搜尋，兩版 sidebar 未找到收藏／最近使用 UI；另有可搜尋的資料來源瀏覽器，但不能直接切換圖層 | 加共用搜尋、固定主導覽、可拖曳面板、詳情閱讀頁與一致返回行為 |
| Monitor | 桌面主版 layout 有 24 張可見 widget；已有窄容器堆疊，但其所在區塊有 `!isMobile` 條件 | 抽成可獨立閱讀的手機頁，摘要與詳細圖表分層 |
| 即時情報 | 桌面已有全部／新聞／警報／全球情勢四分頁；也位於 `!isMobile` 區塊 | 補手機事件列表、分類與詳情；讓事件定位能轉入地圖 |
| Capture | 隱藏一般 UI，加暗角、品牌、timeline 時間與相機座標；手機有進入按鈕 | 現有範圍是拍攝展示模式；若要一鍵存圖／分享，需新增輸出流程 |
| Share | 可複製位置、圖層、底圖、日期組成的網址及 iframe | 分享網址、分享圖片分開；手機預設使用系統分享面板 |
| App 基礎 | 本次未找到 PWA manifest/service worker、Capacitor 或推播註冊 | 補安裝／封裝、生命週期、deep link、檔案分享等所選路線需要的能力 |

主要程式碼位置（行號為本次快照）：

- `src/App.tsx:1454`：Capture 顯示；`:1574`：桌面限定區塊；`:1732`、`:1743`：Intel／Monitor；`:2043`：手機分支。
- `src/components/ShareModal.tsx:20`、`:107`、`:154`：分享狀態與連結／iframe。
- `src/hooks/useIsMobile.ts:3`：768px breakpoint。
- `src/components/MobileBottomSheet.tsx:13`、`:57`：36／200／420px 高度、點擊把手循環切換，尚非拖曳面板。
- `src/map/MapView.tsx:212`：地圖初始化 antialias；`src/App.tsx:337`：預設 3D。
- `src/components/sidebar/layerCatalog.ts:199`：目錄；`:1545`：七大分類；`src/data/layerManifest.ts:321`：manifest。
- `src/components/LayerSidebar.tsx:231`：手機全主題目錄；`src/components/IconRailSidebar.tsx:960`：桌面搜尋。
- `src/components/intel/monitor/monitorLayout.ts:120`：Monitor layout；`src/components/intel/monitor/MonitorPanel.tsx:594`：容器寬度反應；`:665`：widget 接線。
- `src/components/intel/IntelPanel.tsx:396`：桌面固定定位外殼；`src/components/intel/alerts/FeedTabs.tsx:18`：情報分頁。
- `index.html`、`src/main.tsx`、`package.json`：目前 Web 入口與套件基礎。

## 3. 類似 App 如何收納功能

以下是官方公開功能的比較；「對 Pulse 的啟示」是本次推論，沒有推定競品底層框架。

| App | 官方公開做法 | 對 Pulse 的啟示 |
|---|---|---|
| Windy | 圖層／POI 可釘選；地點 picker 展開詳細資訊；另有關注地點的警報管理 | 把圖層目錄與常用入口分開，讓地點成為理解資料的入口 |
| Ventusky | 地圖視覺化之外，提供地點詳細預報、通知與 Widget | Monitor 可先給摘要，地圖承接空間探索；原生特色可逐步加入 |
| Flightradar24 | 即時地圖、搜尋／篩選、航班與機場詳情、歷史回放 | 用「選到一個實體 → 看詳情」收納資訊，進階工具跟隨該實體 |
| Watch Duty | 即時災害地圖、事件／警報資訊、周邊環境與應變資訊 | 情報與地圖要能互相切換；事件內容應比圖層參數更容易到達 |
| 中央氣象署 W 生活氣象 | 首頁提供日常天氣，延伸預報、觀測、警特報；支援最愛、項目排序、推播與 Widget | 第一屏回答常見問題，其餘資料按目的進入；個人常看地點比完整資料目錄更適合首頁 |

來源：[Windy 收藏圖層與 picker](https://community.windy.com/topic/27232/windy-39-is-here-learn-how-to-masterclass-new-features)、[Windy 地點警報](https://www.windy.com/articles/43906)、[Ventusky App](https://www.ventusky.com/app)、[Flightradar24 App](https://www.flightradar24.com/apps)、[Watch Duty](https://www.watchduty.org/)、[中央氣象署官方商店說明](https://play.google.com/store/apps/details?hl=zh_TW&id=org.cwb)。Windy 收藏文章是較早的功能說明，不代表本次驗證了最新版本的按鈕位置。

共同可借用的模式是：常用內容在前、地圖保有探索能力、詳細內容按需展開，關注地點與事件形成回訪理由。這些產品的單一領域通常比 Pulse 窄，因此 Pulse 還需要跨主題的選擇入口。

## 4. 建議的手機安排

### 地圖

地圖保持主畫面。上方提供地點／圖層搜尋，旁邊放定位與分享；下方有「圖層」按鈕及已開啟數量。點圖徵後開可拉高的詳情面板。

圖層面板第一層建議：

1. 收藏：個人常用圖層。
2. 情境：少量策展組合，例如天氣與災害、交通與移動、環境與生活、全球動態。這些只是導覽組合，需使用現有圖層，不創造額外資料。
3. 全部：保留完整分類與搜尋，不必第一屏展示 37 個主題。
4. 已開啟：關閉、透明度、圖例及進階設定集中管理。

既有七大分類是基準、移動與城市、公共生活、安全與治理、環境與資源、情報、世界，可留在完整目錄。394／404 的計數方式是用 TypeScript AST 解析 `THEME_CATALOG` 的 theme／groups／layers 陣列及 `LAYER_MANIFEST` properties，再核對 `fromManifest` 字串 key 去重；不是計算檔案數，也不代表資料來源數。

「完整目錄可找到」與「同時載入全部圖層」是不同需求。高負載圖層應依視窗範圍、縮放與裝置能力載入；不要只因手機就無差別刪除使用者需要的圖層。

若將情境做成 preset，要明訂套用時是替換或疊加，並可還原，避免悄悄破壞使用者原本的組合。

### 現況（Monitor）

回答「目前情形如何、哪裡值得留意」。由全台／關注地點範圍開始，先給少量重點卡片，再看分類與詳細圖表。桌面多欄儀表板應重排成手機閱讀序列。

卡片至少保留結論、關鍵數值／單位、觀測時間與資料狀態；比較基準、趨勢、方法與來源放詳情。提供查看地圖與相關事件。沒有明確基準的卡片不產生虛構異常分數；過期、缺漏、錯誤不能變成正常或 0。

目前 24 張 widget 包含新聞／警報、情勢／熱區、直播、台股／物價、公衛／急診、共機、災害／氣象、電力、監所、機場、船舶／衛星、台鐵及網路狀態等。第一屏只放經挑選的重點，其餘按主題展開。Monitor 保留事件摘要即可，完整新聞 feed 由情報承接。

首頁預設地圖或現況仍可由使用情境決定。第一版可先以地圖為預設，記住使用者上次所在分頁；不要額外增加一個內容重複的首頁。

### 情報

回答「發生什麼新事件、事件有什麼更新」。以事件列表與詳情閱讀為核心，篩選條件集中在分類、地區與時間。沿用現有分類語意，不把新聞、官方示警與全球情勢的不同時間窗硬併成一個篩選。

列表顯示標題、地點、事件／更新時間、來源與狀態；完整摘要和證據放詳情。只有具備可靠 geometry 才提供地圖定位；待定位仍可閱讀。

建議未來讓「閱讀情報」不依賴地圖圖層先被打開，點「在地圖看」時才啟用所需圖層。切換回情報應保留篩選與捲動位置。

### Capture

維持地圖操作的位置，流程建議為：進入 Capture → 選畫幅／資訊 → 預覽 → 存圖或系統分享。

第一版優先靜態圖片與可重開場景的連結。圖片應保留必要圖例、來源 attribution、資料時間；若圖層各自使用不同時間窗，不能只用單一全域時間戳讓人誤以為全部同步。

現有 HTML 疊字、地圖 WebGL 與 Three.js 不保證一次 canvas 匯出就會全部包含，必須先驗證合成與資產載入。錄影、動畫輸出與作品庫另列後續範圍；目前程式沒有這些能力。

手機沒有 hover，Caption、關閉與返回不能只依賴 hover 或鍵盤。分享 URL 是重開查詢狀態，不能當作不可變的歷史資料快照；若需要精確重現，要另外設計保存範圍。

## 5. 技術路線

| 路線 | 適合情況 | 對此專案的判斷 |
|---|---|---|
| 手機 Web／PWA | 先驗證導航、內容與手機需求，透過網址與主畫面使用 | 最適合第一步，手機 UI 的改動也能被後續 App 沿用 |
| React + Capacitor | 明確需要 App Store／Google Play，以及原生分享、推播等能力 | 優先評估的商店 App 路線，可將現有 Web 應用放入原生容器；需實機驗證 WebGL 與生命週期 |
| React Native／Flutter／Swift／Kotlin | 實測證明 WebView 無法達到必要體驗，或核心轉向大量原生／離線功能 | 較大的重建成本；現有 DOM、Mapbox GL JS 與 Three.js 整合不能直接視為原生 UI，應在有證據後才決定 |

Capacitor 的原生容器與 plugin API 見[官方文件](https://capacitorjs.com/docs)；檔案與文字分享見[Share API](https://capacitorjs.com/docs/apis/share)，前背景、返回與 deep link 見[App API](https://capacitorjs.com/docs/apis/app)。這些是可用的平台能力，尚未接入 Pulse。

PWA 也可提供推播；iOS／iPadOS 16.4 起，Apple 支援主畫面 Web App 的 Web Push，仍需加入主畫面與取得通知許可，不能等同一般 Safari 頁面直接取得原生 App 的所有能力。[Apple Web Push 文件](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)

上架包裝本身不是手機體驗完成的證據。Apple 4.2 要求足夠的功能、內容與 App 體驗，超越重新包裝網站；這不表示必須全原生或強制加入推播。[App Review Guidelines 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)

## 6. 需要修改的範圍與優先順序

| 工作 | 必要性與相對量 | 完成判準 |
|---|---|---|
| 三入口 mobile shell、返回與面板管理 | 第一版必要／中 | 圖層、現況、情報均可到達，返回保留原狀態；鍵盤與 safe area 不遮內容 |
| Monitor 手機閱讀版、情報列表／詳情 | 第一版必要／中至大 | 摘要可讀，能進入詳情、地圖及來源；時間與資料狀態清楚 |
| 圖層發現與已開啟管理 | 第一版必要／中 | 能搜尋、收藏、找到已啟用圖層並調整透明度／圖例 |
| 地圖與資料執行預算 | 第一版必要／大，需量測 | 代表性 iPhone／Android 上疊圖、切頁、前背景與弱網可用；沒有持續無用載入或動畫 |
| Capture 靜態輸出與系統分享 | 若 Capture 包含存圖則必要／中，視合成難度調整 | 地圖、HTML 疊字、Three.js、來源與圖例正確出圖，可取消／重試 |
| PWA 安裝與更新 | 選 PWA 時必要／小至中 | 可啟動、可更新、顯示離線及最後資料時間；不把舊快取當即時 |
| Capacitor、deep link、登入回跳與商店建置 | 選商店 App 時必要／中 | 實機安裝、連結打開正確內容、登入與返回正常 |
| 關注地點、條件推播 | 建議第二階段／中至大，包含後端 | 訂閱、取消、事件去重、更新／撤回、點通知進事件，均有實際證據 |
| Widget、完整離線地圖、錄影／作品庫 | 後續 | 先確認使用需求與資料保存／輸出的可行性 |

工作量是相對比較，不是排程承諾；Monitor 範圍、優先平台與 Capture 是否包含錄影會大幅影響估算。

手機效能重點：考慮預設 2D、裝置對應 pixel ratio／抗鋸齒、粒子與 Three.js 負載、viewport 資料裁切、非可見畫面暫停、返回前景重抓有效觀測、WebGL context 恢復。保留狀態不表示必須讓所有畫面一直渲染。

推播若開發，應由服務端處理訂閱與事件變更；不依賴使用者手機讓整張地圖在背景持續輪詢。資料新鮮度與事件來源應沿用既有實際語意。

## 7. 建議交付順序

1. **手機流程驗證**：地圖／現況／情報三入口，少量既有資料與代表性重負載圖層；驗證找圖層、讀事件、定位、返回及 Capture。
2. **手機 Web／PWA 第一版**：完整接線、狀態保存、靜態分享、前背景與弱網處理。以實機結果決定畫質及載入預設。
3. **商店 App 小型試作**：同一版手機 UI 進 Capacitor，在 iOS／Android 驗證地圖、分享與登入；通過才擴大商店發布工作。
4. **回訪功能**：依使用者實際需求加入關注地點、推播、Widget；錄影與完整離線另外評估。

第一階段要回答的問題是「使用者能不能在手機完成一段有用的流程」。通過這一關，才有可靠依據估算完整 App。
