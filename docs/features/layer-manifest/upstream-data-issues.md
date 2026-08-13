# 上游資料問題彙整（W2 popup 補強期間發現）

> 產出脈絡：`no-popup-audit.md` 的 29 筆 CANDIDATE 接線期間，為了「不猜著接欄位」逐欄查證上游
> catalog / pipeline，順手記錄下來的資料品質問題。
>
> **本檔只收「上游該修」的問題**（taipei-gis-analytics pipeline / 政府原始資料）。
> 本 repo 自己的預處理問題不收（例如 `real_estate_points_buffer.bin` 改二進位格式時掉了
> 地址／行政區／總價／坪數四欄——那是 mini-taiwan-pulse 的 `scripts/preprocess` 議題）。
>
> ⚠️ 本檔**只寫在 mini-taiwan-pulse**，沒有去改 `taipei-gis-analytics` 任何檔案。
> 要落地時請 owner 決定是開 issue、改 pipeline，還是回報給政府資料提供者。

---

## 摘要

| # | 資料 | 問題 | 前端目前怎麼繞 |
|---|---|---|---|
| 1 | `water_basins` | `area_km2` 實際單位是 m² | 顯示前 ÷ 1e6 |
| 2 | `levees` | `length_m` 值域與「公尺」矛盾 | 整欄不顯示 |
| 3 | `water_rivers`（線層） | 3 個欄位 100% 空字串 | 只接面層 |
| 4 | `canals` | 宜蘭 9,918 條的 `n`/`t` 恆空 | panel 走 fallback |
| 5 | `irrigation_canal.md` | catalog frontmatter 漂移 | 無（文件問題） |
| 6 | `cycling_routes` | `FinishedTime` 的 ROC→西元轉換有 bug，24.4% 壞值 | 嚴格格式驗證，過不了不顯示 |
| 7 | `cycling_routes` | `CyclingType` / `AuthorityName` 全量回傳字串字面 `"NULL"` | 兩欄不顯示 |
| 8 | `provincial_road` / `national_highway` | `WIDTH` 規格書未載單位 | 整欄不顯示 |
| 9 | `provincial_road` / `national_highway` | `ROADCOMNUM` 規格定義與資料自相矛盾 | 整欄不顯示 |
| 10 | `provincial_road` | `DIR` 65% 標「單行道」，語意存疑 | 整欄不顯示 |
| 11 | `national_highway` | PMTiles 少 3 欄（GeoJSON 25 / 切片 22） | 取值一律走 key 存在性守門 |
| 12 | `ftw_fields_2025` | `confidence_mean` 值域只有 [0.500, 0.581] | 不畫成 0~100% 進度條，標明區間 |

前 5 項來自前一棒（水資源 8 層），後 7 項是本棒（道路三層 + 田區）新發現。

---

## 1. `water_basins` 的 `area_km2` 實際單位是 m²

**現象**：欄名與 catalog 都寫「平方公里」，但數值大三個數量級。

**證據**：三個獨立對照組（高屏溪／淡水河／濁水溪）以真值比對，除以 1e6 後都落在公告面積 2% 內。
116 個流域面全部同一量級，不是個案。

**建議上游怎麼修**：欄位改名 `area_m2`，或在匯出時 ÷ 1e6 後維持 `area_km2` 名稱；
兩者擇一並在 catalog frontmatter 註明單位。

**前端 workaround**：`waterPanels` 的流域 panel 顯示前 ÷ 1e6，並在註解記錄理由。

---

## 2. `levees` 的 `length_m` 與 catalog 標示矛盾

**現象**：欄名與 catalog 都寫「公尺」，實測值域 0.0038 ~ 12.17。

**證據**：堤防長度不可能是 0.0038 公尺；若單位是公里則 12.17 km 合理、0.0038 km（3.8 m）仍偏短。
上游匯出腳本沒有任何換算步驟，所以不是「腳本換算後忘記改欄名」。

**建議上游怎麼修**：回頭確認原始資料的長度單位（疑似是度或投影單位），
確認後在 pipeline 明確換算成公尺並在 catalog 記錄。

**前端 workaround**：整欄不顯示。這是本檔的通用判準——**單位存疑的數值欄一律不顯示**，
顯示一個可能差 1000 倍的數字比不顯示更糟。

---

## 3. `water_rivers` 線層 3 個欄位 100% 空

**現象**：`water_rivers.geojson` 2,015 筆線，`river_name` / `river_code` / `river_type`
三欄全部是空字串（不是 null，是 `""`）。

**證據**：實測全 2,015 筆。同 layer key 的**面層** `river_polygons` 的
`river_name` / `river_type` 則正常有值。

**建議上游怎麼修**：確認線層的屬性是否在轉檔時掉了；若原始資料本來就沒有屬性，
catalog 應標明「線層僅幾何、屬性請用面層」。

**前端 workaround**：`gisClickRegistry` 只收面層 `water-river-polygons-fill`，
線層不接（接了只會開空白面板）。已在 registry 就地註解。

---

## 4. 宜蘭 9,918 條 canals 的 `n` / `t` 恆空

**現象**：`canals` PMTiles 的 `n`（渠道名）與 `t`（引灌需求屬性）在 `src='arcgis'`
的那批全為空。

**證據**：`src` 欄位可切分來源，`arcgis` 那批共 9,918 條、全部落在宜蘭，`n`/`t` 皆空。
其餘來源的同兩欄正常有值。

**建議上游怎麼修**：宜蘭那批走的是不同的 ArcGIS 服務端點，欄位對應可能沒補齊；
確認該端點是否有對應欄位可補，或在 catalog 標明「宜蘭批次僅幾何」。

**前端 workaround**：panel 對 `n`/`t` 走 fallback（無名稱時顯示來源與管理處）。

---

## 5. `irrigation_canal.md` 的 frontmatter 漂移

**現象**：catalog 文件的 frontmatter 與實際 pipeline 產物不一致（欄位清單與語意描述
對不上 `01_fetch_wfs.py` 的白名單）。

**證據**：`o` 在文件裡被描述成一種語意，實際白名單顯示是「管理處」（17 處）；
`t` 被當成「渠道等級」，實際是引灌需求三分類。前一棒因此改了 manifest 的 description。

**建議上游怎麼修**：跑一次 `data-catalog-audit`，讓 frontmatter 對齊 fetch 腳本白名單。

**前端 workaround**：manifest description 已改為正確語意（commit `a19f408`）。

---

## 6. `cycling_routes` 的 `FinishedTime` ROC→西元轉換有 bug ⚠️

**現象**：24.4%（427/1,749）的 `FinishedTime` 是 `2902202` / `2891101` / `2881331`
這種 7 碼壞值。

**證據**：上游 `taipei-gis-analytics/pipelines/transportation/bike/04_fetch_cycling_shape.py:85-91`

```python
roc_year = int(finished[:3])
finished_ad = str(roc_year + 1911) + finished[3:]
```

腳本假設輸入一律是 7 碼民國日期（`YYYMMDD`），但 TDX 也會回 6 碼的
`YYMMDD`（例如民國 99 年 12 月 2 日 = `991202`）。6 碼輸入被 `[:3]` 切成 `991`，
`991 + 1911 = 2902`，再接上剩下的 `202` → `2902202`。

分布：1,243 筆合法 `YYYYMMDD`、9 筆 6 碼 `YYYYMM`、**427 筆壞值**、70 筆空。

**建議上游怎麼修**：依輸入長度分支（7 碼取 `[:3]`、6 碼取 `[:2]`），
或改用「總長度 − 4」推年份位數；並加一條 assert 擋掉輸出年份 > 2100 的結果。

**前端 workaround**：`CyclingRoutePanel` 用嚴格 regex
`^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$` 驗證，過不了就不顯示該列。

---

## 7. `cycling_routes` 的 `CyclingType` / `AuthorityName` 全量是字串 `"NULL"`

**現象**：兩欄不是空字串、不是 JSON null，而是**四個字元的字串 `"NULL"`**。

**證據**：`CyclingType` 1,749 筆 distinct = 1（全是 `"NULL"`）；
`AuthorityName` 1,748 筆 `"NULL"` + 1 筆空字串。上游腳本（`:112`、`:115`）是 passthrough，
所以是 TDX API 本身這樣回。

**建議上游怎麼修**：pipeline 端把字面 `"NULL"` 正規化成真正的 null／空字串
（否則每個下游都要各寫一次守門）；另外向 TDX 反映這兩個欄位無資料。

**前端 workaround**：panel 的 `clean()` helper 把 `"NULL"` 當空值，且這兩欄一律不顯示。

---

## 8. 道路中線 `WIDTH` 欄位規格書未載單位

**現象**：`provincial_road` / `national_highway` 的 `WIDTH` 值域 2~88（省道中位數 20、國道中位數 11）。

**證據**：內政部《臺灣通用電子地圖圖層內容說明》修訂 114.01.08 §貳一(一) 定義
`WIDTH` = 最大路面寬度（含中央分隔島），但**全文未載此欄單位**——PDF 裡唯二提到「公尺」
的地方都是在講 E/N 座標欄位。值域雖與公尺相符，但沒有一手依據。

**建議上游怎麼修**：向內政部確認單位並補進 catalog frontmatter。
（本兩層目前在 `docs/audit/data_sources_pending_catalog.md:53-54` 仍列為 pending，尚無 catalog 文件。）

**前端 workaround**：整欄不顯示（同 #2 的判準）。

---

## 9. 道路中線 `ROADCOMNUM` 規格定義與資料自相矛盾

**現象**：規格書定義為「共線路段數（不含本身）」，但省道有 37,813 筆宣稱 ≥1，
實際填了 `ROADNUM1`（共線第二編號）的只有 2,260 筆。國道更明顯：
`ROADCLASS1=HW` 的 2,230 筆一律 0、`HU` 的 3,164 筆一律 ≥1，但 `ROADNUM1` 只有 12 筆有值。

**證據**：如上，兩層各自的欄位交叉統計。國道那組的分布看起來 `ROADCOMNUM`
被拿來當「是否為附屬道路」的旗標，而非規格書寫的計數。

**建議上游怎麼修**：向資料生產端確認這欄實際編碼什麼；在釐清前 catalog 應標為「語意待確認」。

**前端 workaround**：整欄不顯示。

---

## 10. `provincial_road` 的 `DIR` 語意存疑

**現象**：`DIR` 代碼語意查得到（0=雙向道 / 1=單行道，車行方向 = 數化方向），
但省道有 65%（32,042/49,101）標成「單行道」。

**證據**：省道實際單行道比例不可能達 65%；國道則是 5,320/5,394 標 1，
兩者都比較像「分向數化（每個方向各一條線）」而不是法定單行道。

**建議上游怎麼修**：確認是否為分向數化的副作用；若是，catalog 應改述為
「是否為單向數化線段」而非「單行道」。

**前端 workaround**：整欄不顯示。

---

## 11. `national_highway` PMTiles 比 GeoJSON 少 3 欄

**現象**：GeoJSON 有 25 個屬性 key，PMTiles 只有 22 個 vector layer field。

**證據**：少的是 `RDNAMESECT` / `RDNAMELANE` / `RDNAMENON`，這三欄在國道那份資料裡
100% 為 null，被 tippecanoe 整欄丟掉。

**這其實是正確行為**（不必修），但下游必須知道兩件事：
1. MVT 也會**逐 feature** 丟掉 null 屬性 → 同一層不同 feature 的 key 集合不一樣
2. 因此前端不可假設 key 存在

**建議上游怎麼修**：不用修，但 catalog 應標明「切片欄位 ⊆ 原始欄位，null 欄會被丟棄」。

**前端 workaround**：`roadPanels` 的所有取值走 `str(props, key)` helper
（`props[key] == null ? "" : String(...)`），不用 `props.X as string`。

---

## 12. `ftw_fields_2025` 的 `confidence_mean` 值域只有 [0.500, 0.581]

**現象**：欄名叫 confidence、看起來像 0~1 機率，實際 386,829 筆的值域是
min 0.500001 / max 0.580953 / mean 0.5384。

**證據**：以 pipeline 的 parquet SSOT 全量統計；上游 catalog
`agriculture/ftw_fields_2025.md` 的「已知陷阱」段也明載「confidence 上限只到 0.6」，
所以不是切片 tilestats 的截斷假象。0.5 是模型輸出的**篩選門檻**，不是「五成把握」。

**建議上游怎麼修**：catalog 欄位表直接把值域寫進去（現在只寫在「已知陷阱」段，
容易被跳過）；或在 pipeline 端輸出一個 rescale 後的 0~1 欄位供 UI 使用。

**前端 workaround**：`AgricultureFieldPanel` 顯示原始數字並標註「值域 0.5–0.6」，
**不畫成 0~100% 進度條**。同時揭露 catalog 記載的另外兩點——
這是衛星 AI 推論不是法定農業分區、且公園與規則形狀空地會被誤判導致面積高估。
