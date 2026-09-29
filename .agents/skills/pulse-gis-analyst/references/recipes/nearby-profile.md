# 點周邊生活機能（空間）

**適用**：「這裡附近有什麼」「這個地址生活機能如何」「走路範圍內有沒有 X」。

**工具鏈**
1. 地址 → `pulse_geocode_address`（說明 exact／interpolated 精度）；座標或地圖點直接用。
2. `pulse_nearby_profile({points:[{label, center}], radiusM: 500–1000})`；只問某類時加 `categories`。
3. 要上地圖：`pulse_wh_present` → 回條 resultIds → `pulse_set_result_collection`（framing＝結果範圍）→ `pulse_wait_scene_ready` → `pulse_get_map_context`。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：結果的 `caveats` 原樣帶上；距離是「到資料點位的直線距離」，不是步行距離；`notCovered` 講「此資料未涵蓋本縣市」，不可說成 0。

**停止**：八類摘要＋最近距離出來就回答，不逐筆列完。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：最少的那一類要不要看更遠？要不要跟另一個地點比？要不要換成步行等時圈（需外部服務同意）？
