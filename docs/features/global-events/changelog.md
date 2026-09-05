# Changelog

## 2026-09-05 — INTEL 全球情勢 feed 與國內新聞對齊（待發布）

分頁行為改成與國內新聞同一套契約：面板自己載資料，不再依賴 `globalEvents` 圖層是否開啟。新增 `fetchGlobalSituationFeed(dateKey)`（今天走滾動 24 小時、歷史日走 Asia/Taipei 當日 [00:00, 24:00)），組合既有 `get_global_event_places_window` ＋ `get_global_event_candidates_window` 分頁 ＋ `selectGlobalSituationEntries` 的 available_at 篩選，沒有新增 RPC，也沒有動圖層 hook 的渲染邏輯。資料落在面板自己的 `globalSituationFeedStore`，刻意不共用被地圖 effect 綁死的 `globalEventsViewStore`。載入時機比照新聞：面板開啟 + `timeStore.subscribeDate`，日期跨天才重抓；額外每 10 分鐘背景刷新（collector 每小時跑），刷新與失敗都保留舊資料不清空。

格式統一：移除 `<details>` 清單，改用新聞的 `IntelCard`（adapter `toIntelCardEvent`）。事件時間一律取 `valid_from`（＝候選的 `observed_at`），不用 `available_at` 假裝發生時間；分類 enum 與新聞完全同名（accident／crime／disaster／traffic／health／policy／other），直接吃 `getNewsCategoryDef` 不做轉換。卡片多兩顆 chip：「國際」（`scope`）與「AI 初判」／「已研究」（`origin_label`），讓「全部」分頁混排時仍分得出來源。移除「開啟全球情勢圖層以載入」CTA，刪掉沒人再引用的 `GlobalEventsList`。

預設過濾 decision：feed 只顯示已研究與 `keep_core`，分頁頂端「含觀察中」toggle 才加入 `keep_watch`，`drop_noise` 在 INTEL 永不顯示（地圖圖層與 sidebar 行為不變）。理由是使用者要「一定時間內看到世界上正在發生的重要事情」，而低價值條目集中在 `drop_noise`——2026-09-05 對 `get_global_event_candidates_window` 近七天窗口的 anon 唯讀探測：812 件候選、首頁 491 件的 decision 分佈為 keep_core 116／keep_watch 133／drop_noise 170／未判斷（null）72，`drop_noise` 約佔 35%，全部塞進 feed 等於讓重要事件被埋掉。注意 `decision = null`（未判斷）約 15%，依本次規格也不顯示。RANGE 1H／6H／24H 沿用新聞的前端過濾（以事件時間），分頁按鈕數字＝過濾後筆數，「全部」的數字併入國際筆數，header 的「共 N 則」維持新聞語意不動。點擊有座標的卡片飛到 zoom 4（新聞是 12），未定位只展開不飛；不開 popup、不自動開圖層。

**已知落差**：正式事件 RPC（`get_global_event_places_window`，migration 396）沒有 `source_urls` 欄位，所以「已研究」卡片沒有原文連結與來源網域，只有「AI 初判」卡片有。要補需要上游加欄位，本次不動。另外 RANGE 邊界沿用新聞的 `now - RANGE`（掛鐘），所以時間軸切到過去某天時 feed 會是 0 件——這是既有的新聞行為，國際 feed 刻意繼承同一個算式，將來修新聞會一起修好。

**⚠️ 待決策：本次規格的 24 小時窗口在目前資料下必然是 0 件。** 2026-09-05 02:30Z 對 prod 的 anon 唯讀探測結果：

- 候選 RPC 以 `observed_at` 開窗。全庫最新的 `observed_at` 是 `2026-09-04T00:30Z`（約 26 小時前），而 `available_at` 一路到 `2026-09-05T01:33Z`（約 1 小時前）——收集→研判的延遲約 25–49 小時。所以 `[now-24h, now)` 的 `observed_at` 窗口回 **0 件**，七天窗口回 812 件。
- 正式事件 RPC 以 `display_from`/`display_to` 開窗，24 小時窗口確實回了 3 件（皆 `lifecycle_state=published`，沒有被 overview 濾掉），但它們的 `valid_from` 是 09-02／09-03，被「RANGE 以事件時間過濾」擋掉。
- 兩半都不是程式缺陷，是「最近」的定義問題：**要的是「最近發生」還是「最近才知道」**？在目前的延遲下只有後者拿得到資料。選項：(a) 全球分頁的窗口與 RANGE 改以 `available_at` 計算，卡片仍顯示 `valid_from` 當事件時間（誠實，但 1H 的卡片可能寫「26 小時前」）；(b) 今天的窗口改成七天（與圖層 `recent7d` 一致），全球分頁不套 RANGE 或給另一組選項；(c) 維持現狀，改治上游延遲。
- 順帶一提：`observed_at` 的最小／最大值都落在 :00／:30 整點，看起來是批次時間而非真正的事件時間。若是如此，「`valid_from` ＝事情何時發生」這個前提本身就要打折，值得上游確認。

tsc -b 與 `npm test` 全套（109 檔／1084 tests，3 skipped）通過。

## 2026-09-03 — 全球情勢列表移至 INTEL（待發布）

將兩個sidebar的GlobalEventsList與統計搬到「即時情報 INTEL → 全球情勢」獨立第四分頁；sidebar只留原圖層controls。全球分頁不混入全部／新聞／警報總量，不顯示新聞LIVE／更新健康列、1H／6H／24H、警報篩選或IntelReplay。統計與unknown／定位展開完全沿用既有globalEventsViewStore，依原七天／時間軸窗口，不新增RPC或reader。

圖層關閉時不顯示cached統計，提供「開啟全球情勢圖層以載入」按鈕，走App既有handleBulkSetVisibility；切分頁不暗中開啟圖層。沿用theme與列表資料，取消sidebar用的240px內層捲動上限。19 focused tests與tsc-b通過，正常CI另跑；依使用者要求不做browser／devserver視覺自驗，畫面由使用者確認。

## 2026-09-03 — PR #208 Popup 摘要瘦身

僅 Global Events popup 保留：18px 事件標題、查證狀態、摘要、同列分類／嚴重度、臺灣影響、判斷理由、地點、落點語意、來源收集時間及可點位置來源。隱藏信心／Qwen分類／關聯代碼／座標／避讓／時間軸／lineage等內部細節，底層資料與其他圖層不變。來源用網域標籤、原http(s) URL，拒絕不安全或帶帳密連結；正式事件沒有來源收集時間時顯示—，不挪用事件時間。

依使用者要求，不做browser、截圖或devserver視覺驗收；只跑focused tests、tsc與既有CI。視覺驗收由使用者。

PR #208 merge 5230181，Zeabur deployment 6a997433c3fffb61baebe158 於13:27:27Z RUNNING；17 focused／tsc／CI通過。沒有宣稱視覺已验。

## 2026-09-03 — PR #207 固定地理錨點 hotfix

修正同位置避讓先 `project` 再 `unproject`，導致移動地球後顯示座標重算、點位跳動。事件與群組的 GeoJSON geometry 現在始終保留原國家／城市座標；並排改用 native symbol `icon-offset`，以 viewport 對齊並反向補償 severity 的 icon-size。移除 moveend 資料重送，原避讓短線改為固定位置小錨點；跨國關聯弧線仍用真實 endpoints。

保留 category 分色、severity 大小、AI／選取外框、群組展開、popup、opacity 與原錨點 pulse。同步 SDF image 在 style reload／missing 時補回，layer off 隱藏所有相關圖層並解除 listener。本地 tsc-b、23 focused tests、完整 1031 tests（1 skipped）通過。

本地 browser 通過：加拿大7件群組展開後可分別點出亞伯達特別投票與工會事件；平移、bearing15、zoom2.2→3後錨點保持Canada 60,-96，無moveend重排。分色／大小／popup、opacity0、AllOff／再ON皆正常，console error=[]；style reload 以 regression 驗證，未宣稱 browser 已切換底圖。PR #207 merge 78c90aa，deployment 6a99545bc3fffb61baebd662 於11:10:02Z RUNNING；正式視覺驗收依使用者後續指示交由使用者，不宣稱已驗。

## 2026-09-03 — PR #205

完整情勢／低重要性與臺灣無關不排除、七天總覽、同位置避讓、跨國關聯弧線，沿用既有圖層與兩層判斷。包含 unknown 事件列表、candidate keyset 分頁、真實 immutable 回放與延遲導入擴窗修正。

城市／國家可先以概略代表位置上圖，不冒充精確發生地；原始座標不因畫面避讓而變動。修復深色列表黑字（改 theme token、11px）及四國代表點缺 country code 時的關聯線。

本地 tsc-b、1027 tests（1 skipped）通過；PR #205 merge ab813b0 已部署。Production 實測最近七天、AI開關、來源國家點popup、同位置7件群組展開、跨國線與透明度開關。9/2尚未導入時為0，9/3可讀實際導入版本。

## 2026-09-03 — PR #206 pulse hotfix

修正requestAnimationFrame時間戳早於pulse起點時產生負opacity；phase限制為[0,1]。Regression先重現舊碼失敗，修後11 focused／tsc／CI通過。Merge def3dc6，Zeabur 6a994975c3fffb61baebd2b3 RUNNING，新資產main-Bblqfkou.js。Production歷史scrub後讀出163件／58件待定位（Qwen補正前快照），新版console無error；最後恢復即時／最近七天。
