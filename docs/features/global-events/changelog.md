# Changelog

## 2026-09-03 — Popup 摘要瘦身（待發布）

僅 Global Events popup 保留：18px 事件標題、查證狀態、摘要、同列分類／嚴重度、臺灣影響、判斷理由、地點、落點語意、來源收集時間及可點位置來源。隱藏信心／Qwen分類／關聯代碼／座標／避讓／時間軸／lineage等內部細節，底層資料與其他圖層不變。來源用網域標籤、原http(s) URL，拒絕不安全或帶帳密連結；正式事件沒有來源收集時間時顯示—，不挪用事件時間。

依使用者要求，不做browser、截圖或devserver視覺驗收；只跑focused tests、tsc與既有CI。視覺驗收由使用者。

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
