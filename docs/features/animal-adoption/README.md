# 動物福利 Animal Welfare

本功能包含三個互補圖層：每日快照的公立收容所認領養摘要、官方月報的縣市收容壓力，以及 7 類動物福利服務據點。

- `animalAdoption` 只載收容所彙總，不直接讀取約 8 千筆個體；popup 另以 `get_animal_adoption_daily` 顯示可用的趨勢小圖。
- `animalShelterPressure` 使用最新非歧義月報套用縣市界，缺值透明、不補 0。
- `animalWelfarePoints` 以 5,000 筆 offset 分頁載入 7,020 個 active located canonical points；類型 filter 不重抓 RPC，history 只在點擊 popup 後載入。

認領養與壓力資料都不是 realtime；服務點的地方名冊是 partial coverage，未列點不表示當地沒有服務。
