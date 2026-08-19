# 動物認領養 Animal Adoption

每日快照的公立收容所摘要圖層。地圖使用 `get_animal_adoption_shelter_summary`，只載收容所彙總，不直接讀取約 8 千筆個體；點擊 popup 另以 `get_animal_adoption_daily` 顯示可用的趨勢小圖。

本層不是 realtime：資料時間以 `latest_snapshot_date` 為準，缺值不補 0。
