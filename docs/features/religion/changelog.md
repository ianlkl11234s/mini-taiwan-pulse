# Changelog — 宗教 Religion

> 逐 PR 變更紀錄。最新在上。

---

## 2026-08-02 — PR #（待補） `（待補 squash hash）`

- 新增「宗教 Religion」主題群（第 36 主題，插在 文化 Culture 與 觀光 Tourism 之間），6 層：
  temples / churches / ancestral_halls / foundations / other_worship / top100
- temples 走 PMTiles（19,201 點 12.2MB，`-r1` 全點保留）；其餘 5 層 GeoJSON
- `deity_family` 9 族分色（上游衍生欄）+ 主祀 select（10 選項）+ 登記態切換（3 選項）
- churches / ancestral_halls 各自的登記態切換（後者標籤為「登記宗祠 / 文資祠堂」，語意不同）
- **`tourReligion` → `religionTop100` 更名搬群**（觀光「玩・人文」→ 宗教「精選」），
  資料路徑 `./tourism/religion_national.geojson` → `./religion/top100.geojson`；
  同步修好 `upstreamRegistry` 的 broken catalog ref（`religion` → `top100`，上游已搬檔）
- ODbL 標示：圖例 + popup（`source === "osm_overpass"` 才顯示）
- 新 SSOT `src/data/religionTypes.ts`；新 `src/components/featureInfo/religionPanels.tsx`
- 部署：`nginx.conf` 加 `location /religion/`、pull/upload 腳本加 religion 前綴、
  `.gitignore` 加 temples.pmtiles
- 上游同批：`taipei-gis-analytics` 加 `deity_family` 欄 + `08_build_pmtiles.py`（commit `7db94ce`）
- Breaking：`tourReligion` key 消失（僅內部 key，無外部 API）
