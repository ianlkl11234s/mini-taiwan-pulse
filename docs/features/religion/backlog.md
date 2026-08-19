# Backlog — 宗教 Religion

> 本檔只保留 current residual；已完成接線與設計取捨分開記錄，避免把 PR pending 誤寫成已 shipped。

## Release blocker / verifying

- [ ] **RL-1 · `verifying`**：確認 6 層宗教群的 PR、merge 與 `public/religion/temples.pmtiles` production asset。
  - Outcome：正式環境不會因 gitignored PMTiles 未上傳而 404。
  - Next action：核對 PR/CI、S3 HEAD/checksum、HTTP Range 與 browser layer；以無 404、六層可渲染為 acceptance。

## Data quality

- [ ] **RL-2**：Supabase `reference.religion_temples` 補 `deity_family` 欄並重跑上游匯入。
  - Outcome：DB 參考資料與靜態檔分類契約一致，日後查詢不會看到兩套語意。
  - Next action：在 gis-platform 建 migration、重跑 `08_supabase.py`，再做 row/classification 對帳。
- [ ] **RL-3**：補無座標尾巴（temples 2 筆及其他表 `no_coords.csv`）。
  - Outcome：可定位的宗教據點增加，且不改動目前已上線的靜態檔語意。
  - Next action：先驗來源地址與 geocode 命中率，再產新檔與 coverage report。

## Decision needed / product enhancement

- [ ] **RL-4**：決定「其他神祇」4,276 筆是否再細分。
  - Outcome：若使用回饋需要，可增加故事辨識度；否則維持目前 9 族穩定語意。
  - Next action：收集實際使用回饋，再以分類覆蓋與圖例可讀性作 go/no-go。
- [ ] **RL-5**：宗教密度 × 人口分析視角。
  - Outcome：回答「哪裡廟多人少」的分析問題，不把分析層誤列成基礎圖層修補。
  - Next action：先確認人口網格 SSOT、授權與 join 粒度，再開分析設計。

## 已決定（不列入 active）

- 5 張 `reference.religion_*` 表保留為備用，不作前端主路徑：靜態資料走檔案以避免 DB 併發。
- 前端不做 `main_deity` regex 歸併；由上游 `deity_family` 處理。
