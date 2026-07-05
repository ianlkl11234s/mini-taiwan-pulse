# Changelog — 畜牧 Livestock

> 逐 PR 變更紀錄。最新在上。

---

## 2026-07-05 (b) — 資料更新 v1→v3 final（batch03，PR #TBD）

- **畜禽飼養場資料 9,091 → 13,087**（ARIS batch01+02+03，100% geocode 命中；中途 batch02 12,275 未上線，直接到 batch03 final）。
- 換 CDN 檔 `livestock_farms.geojson`（覆蓋同名檔）+ S3 重上傳 + Zeabur restart 重拉 + Cloudflare purge。
- 低精度 523 → **769 場**（段質心_google）；精度 高 12,271 / 中 47 / 低 769。
- 主畜種 v3：雞 5,176 / 豬 4,584 / 鴨 1,305 / 羊 644 / 牛 574 / 鵝 531 / 其他 273。
- **零程式改動**（layer 全 data-driven：filter 靠值、大小靠 總隻數）；僅更新寫死計數註解 + 文件。
- Supabase `agriculture.livestock_farms` 同步 re-ingest 13,087（雙寫）；上游 catalog/registry 更新。

## 2026-07-05 (a) — PR #55 `5ffe3e3`（feat/livestock，初版上線）

- **新增畜牧圖層群組（10 toggle）**：飼養場 7 層（豬/雞/牛/鴨/鵝/羊/其他）+ 屠宰場/飼料廠/拍賣市場 3 層。
- 走 CDN 靜態 geojson（`public/agriculture/`），不打 Supabase；飼養場 4 層曾為原設計，後依需求拆成 7 層（鴨/鵝/羊 獨立）。
- 各飼養場層：同色系「淺→深」依總隻數、per-species log 大小、透明度/大小 slider、**品項高亮下拉**（種類明細子字串比對）。
- 「其他」層再依主畜種各自 **大小 + 顏色**（鹿/鵪鶉/馬/兔/鴕鳥，量級差極大不共用尺標）。
- 屠宰場依「種類」首字分家畜/家禽；低精度 523 場淡化。
- 預設 scale：飼養場 0.3、設施 1.0。
- **附帶修復**：切底圖後靜態 GeoJSON overlay 重新 hydrate（`overlayManager` + `MapView`），全站 geojson 圖層受惠。
- 跨 repo：gis-platform `agriculture.*` schema 4 表留底；taipei-gis-analytics catalog + registry + handoff §9。
- Breaking：無。（初版資料為 v1 ARIS batch01 ≈60%；後續同名檔覆蓋，見上方 v2 條目。）
- 驗證：`tsc -b` + 190 測試綠 + browser 多輪驗證。
