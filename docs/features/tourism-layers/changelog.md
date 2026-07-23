# Changelog — 觀光 Tourism

> 逐 PR 變更紀錄。最新在上。

格式：
```
## YYYY-MM-DD — PR #NN <squash commit hash>
- <what changed>
- <why (optional)>
- <breaking? migration needed?>
```

---

## 2026-07-23 — PR 待開 `feat/tourism-layers`

- 首發：新開「觀光 Tourism」主題分組（四子群），一次接上 12 個全國靜態圖層（31,333 features）
- 特殊行為：tourAttractions 分類/熱度雙著色模式（log10 色帶、null=灰「無統計」）、tourHotels 四類 select 篩選 + minzoom 9 zoom-gate、tourEvents 三態時間篩選（ISO 時間戳 slice 日期比較）、兩個面層仿 activeFaults 樣式
- 部署：9 檔 C 類進 git `public/tourism/`；attractions/hotels/restaurants 3 檔 D 類走 S3→volume（.gitignore / upload / pull / nginx 四處已接，docker-compose 為既有技術債刻意跳過；S3 實際上傳待拍板）
- 資料 bug 修復：attractions `"yoy_pct":Infinity`（前一年 0 除零）令瀏覽器 JSON.parse 整檔失敗 → 快照 patch 為 null + 上游 `08_pulse_export.py` 加 `math.isfinite` 守門 + `allow_nan=False`
- 驗收：`npx tsc -b` 0 error、197 tests 全綠、agent-browser 12/12 圖層 browser 驗收 PASS（All Off 起測、含熱度模式切換 / hotels 類別篩選 691→21 / events 三態 593/108/134 / 面層 popup）
- Breaking：無（純新增；upstreamRegistry 用上游真實 catalog dataset_id 12 筆 verified）
