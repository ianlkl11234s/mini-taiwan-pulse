# Changelog

## 2026-09-03 — PR #205

完整情勢／低重要性與臺灣無關不排除、七天總覽、同位置避讓、跨國關聯弧線，沿用既有圖層與兩層判斷。包含 unknown 事件列表、candidate keyset 分頁、真實 immutable 回放與延遲導入擴窗修正。

城市／國家可先以概略代表位置上圖，不冒充精確發生地；原始座標不因畫面避讓而變動。修復深色列表黑字（改 theme token、11px）及四國代表點缺 country code 時的關聯線。

本地 tsc-b、1027 tests（1 skipped）通過；production 上線進度與最後 readback 記錄於 PR #205／上游 handoff。
