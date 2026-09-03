# Changelog

## 2026-09-03 — PR #205

完整情勢／低重要性與臺灣無關不排除、七天總覽、同位置避讓、跨國關聯弧線，沿用既有圖層與兩層判斷。包含 unknown 事件列表、candidate keyset 分頁、真實 immutable 回放與延遲導入擴窗修正。

城市／國家可先以概略代表位置上圖，不冒充精確發生地；原始座標不因畫面避讓而變動。修復深色列表黑字（改 theme token、11px）及四國代表點缺 country code 時的關聯線。

本地 tsc-b、1027 tests（1 skipped）通過；PR #205 merge ab813b0 已部署。Production 實測最近七天、AI開關、來源國家點popup、同位置7件群組展開、跨國線與透明度開關。9/2尚未導入時為0，9/3可讀實際導入版本。

## 2026-09-03 — PR #206 pulse hotfix

修正requestAnimationFrame時間戳早於pulse起點時產生負opacity；phase限制為[0,1]。Regression先重現舊碼失敗，修後11 focused／tsc／CI通過。Merge def3dc6，Zeabur 6a994975c3fffb61baebd2b3 RUNNING，新資產main-Bblqfkou.js。Production歷史scrub後讀出163件／58件待定位（Qwen補正前快照），新版console無error；最後恢復即時／最近七天。
