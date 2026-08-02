# Backlog — 宗教 Religion

> 本 feature 的待辦。編號 RL-*。

## 待辦

- [ ] **RL-1**：deploy 前跑 `upload-deploy-assets.sh` 上傳 `public/religion/`（temples.pmtiles 12.2MB
      是 gitignored，**沒上傳 prod 會 404**）
- [ ] **RL-2**：Supabase `reference.religion_temples` 補 `deity_family` 欄（gis-platform migration +
      重跑上游 `08_supabase.py`）—— 前端不依賴，但 DB 與檔案不同步會讓日後查詢困惑
- [ ] **RL-3**：無座標尾巴 geocode（temples 2 筆 + 其他表；上游 `data/intermediate/religion/*/no_coords.csv`）
- [ ] **RL-4**：「其他神祇」4,276 筆長尾要不要再細分（保生大帝 268 / 三山國王 184 / 中壇元帥 144…）——
      看實際使用回饋再決定，目前 9 族已能講故事
- [ ] **RL-5**：宗教密度 × 人口的分析視角（哪裡「廟多人少」）——需接人口網格，屬分析層不是圖層層

## 已完成（近期）

- [x] **RL-0**：宗教群 6 層上線 + 百景搬群更名 — 2026-08-02，PR 待開

## 已放棄 / 延後

- **走 Supabase `reference.religion_*`**：5 表已入庫且 COUNT 吻合，但靜態資料走 DB 會佔併發
  （static-to-cdn 的教訓），故選靜態檔。DB 路徑保留備用。
- **前端做 main_deity 歸併**：Mapbox 表達式沒有 regex，1,950 種歸不了 —— 已改由上游算 `deity_family`。
