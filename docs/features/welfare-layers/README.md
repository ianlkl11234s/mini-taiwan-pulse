# 社福長照 Welfare

> **Slug**：`welfare-layers`
> **狀態**：dev（tsc ＋ 42 測試檔全綠、瀏覽器實測通過；等 PR review）
> **Owner**：migu
> **上線日期**：（待 PR merge）
> **相關 PR**：#（待補）
> **上游契約 SSOT**：[`../../../taipei-gis-analytics/docs/handoff/welfare-layers.md`](../../../taipei-gis-analytics/docs/handoff/welfare-layers.md)
> **上游 PR**：[taipei-gis-analytics#42](https://github.com/ianlkl11234s/taipei-gis-analytics/pull/42)（尚未 merge）

## 一句話說明

全站第 40 個主題群：把台灣的社會福利與長照供給接上地圖 —— **10,004 個據點**，
從護理之家的床位、身障機構的空床率，到托嬰中心、早療據點與公部門社福單位。

## 圖層（9 層，全部靜態 GeoJSON 點層）

| layer key | 檔案 | 點數 | 視覺 |
|---|---|--:|---|
| `welfareNursingHomes` | `nursing_homes_national.geojson` | 1,611 | `nh_type` 三分色 ＋ **半徑隨總床數** |
| `welfareElderlyHomes` | `elderly_care_homes_national.geojson` | 1,160 | `attr_type` 公私別分色 ＋ **半徑隨核定床數** |
| `welfareDisability` | `disability_facilities_national.geojson` | 334 | **使用率分色**（實際安置／核定量） |
| `welfareLtcInstitutions` | `ltc_institutions_national.geojson` | 3,117 | `sub_code` 四種服務型態分色 |
| `welfareChildcare` | `childcare_centers_national.geojson` | 1,578 | 單色 |
| `welfareChildServices` | `child_services_national.geojson` | 1,396 | `welfare_class` 三類分色 |
| `welfareGovOffices` | `welfare_gov_offices_national.geojson` | 151 | 單色 |
| `welfareMentalHealth` | `mental_health_facilities_national.geojson` | 70 | `sub_code` 五類分色 |
| `welfareSocialWorkOrgs` | `social_work_orgs_national.geojson` | 587 | 單色（灰，刻意降存在感） |

合計 **5.4 MB 全部進 git**（走 dist 供檔，`/data/welfare/` 保留同構以備日後大檔，
同 funeral 慣例）。9 層都走 OVERLAY_REGISTRY 通用路徑 —— **沒有** loader / hook /
CustomLayer，per-layer 邊際成本只有 manifest ＋ spec ＋ registry ＋ panel 四筆。

分色／篩選／精度 SSOT：[`src/data/welfareTypes.ts`](../../../src/data/welfareTypes.ts)。

## 四個設計重點

### 1. 🔴 「長照」有兩套互不相容的登記體系，前端刻意不合併

| | `welfareLtcInstitutions`（本批） | `medLTC`（既有，醫療主題） |
|---|---|---|
| 法源 | 《長期照顧服務法》**立案機構** | 長照 2.0 **特約單位** |
| 筆數 | 3,117 | 23,894 |
| 一筆是什麼 | 一間**機構**（有登記證、有服務型別） | 一個**特約服務項目**（同機構可有多筆） |
| 名稱交集 | \-\- | **只有 2,365** |

兩者都對，量的是不同東西。UNION 起來會**同時**重複計算與漏算。
所以本群不與 medLTC 合併、不共用圖例、不放同一個主題群 ——
要做「長照資源覆蓋」的人必須自己選一邊，這是刻意的摩擦。

⚠️ 另有版本落差：線上 `medical.ltc` 仍是舊版 30,764 筆；上游 2026-08-11 實測已縮量
-20.7%（C 級巷弄長照站 4,232 → 560，-86.8%），**用戶拍板先不同步**待查清。
要顯示「C 級據點數」前先跟上游確認版本。

### 2. 🔴 `welfareCenters` 長得像本群一員但不是 —— 兩層零重疊

基礎建設主題的 `welfareCenters`（社福中心 162 處）走不同 pipeline、不同主題。
本群的 `welfareGovOffices` 在**上游**就把 `T0103 社會福利服務中心` 排掉
（307 → 151），正是為了不跟它重複。

→ **兩層可以放心同時開**；要算「全部公部門社福據點」時記得把 162 筆加回來。
這句話同時寫在 popup 與圖例裡，因為它不是接線細節而是讀圖時會踩的坑。

### 3. 98 筆概略座標：不刪、不假裝，高 zoom 誠實降階

9 層合計座標覆蓋 99.7%（8/9 層 100%）。但 98 筆（約 1%）的 `coord_precision`
是 `approximate` —— 路段／區中心而非門牌，可能差數百公尺。

處理（`welfareTypes.ts` 的 `welfarePrecisionOpacityExpr` / `…StrokeWidthExpr`）：

- **z < 14**：與一般點一視同仁（那個尺度差幾百公尺看不出來，淡掉反而像沒資料）
- **z ≥ 15**：透明度降到 3 成 ＋ 描邊加粗 → 讀起來是空心圈
- **popup**：一律標「⚠️ 位置為概略值：路段／區中心（可能差數百公尺），非實際門牌座標」
- 另給每層一個「定位精度」select（全部／排除概略點／只看概略點）

**不刪點** —— 那些機構是真的存在，只是地址解不到門牌。

⚠️ 本主題的精度值域（`upstream/exact/cached/interpolated/approximate`）與殯葬那套
（`source/tgos/parcel_centroid/…`）**不同套**，`layerParamsSpec` 用的是各自的 encode，
借用會靜默濾錯（值對不上，分支永遠不成立）。

### 4. 上游把空值整個拿掉，且數值欄位是字串

- **空值約定**：空字串與 null 的 property 在匯出時**整個移除**（不是留空值）
  → 前端一律 `"key" in props` / `coalesce`，不可假設 key 一定存在
- **床數／核定量是 `string`**（`"56"` 不是 `56`）→ paint 一律
  `["to-number", ["coalesce", ["get", f], 0]]`

兩個因此而來的守門（漏了就會畫出假象）：

| 陷阱 | 沒守會怎樣 | 守法 |
|---|---|---|
| 護理之家只看 `beds_nh` | 989/1,499 筆是 0（居家護理所 732 沒有床、產後護理之家 257 床數在別欄）→ 三分之二縮成同一顆最小點，看起來像資料壞了 | 總床數 = 一般 ＋ 產後 ＋ 嬰兒室 |
| 身障使用率不擋分母 0 | Mapbox 除以 0 得 **Infinity 不報錯** → 88 筆全落進「超過 100%」桶，畫出「全台身障機構嚴重超收」的假象 | 先 `case ["<=", quota, 0] → 灰`，再 `step` 分級 |

## 已知限制（讀圖前要知道）

- **托嬰中心名單約 21 個月舊**（上游骨幹 `Last-Modified` 停在 2024-11-12，托嬰異動頻繁）；
  **居家托育（保母）仍無全國資料源**。圖例與 popup 都標了。
- **`welfareSocialWorkOrgs` 是組織不是設施**，地址多為辦公室／立案地 ——
  上游明確不建議放進服務可近性分析。故配灰色、最小半徑、最低透明度，popup 明講。
- **`child_services` 是三類混裝**，早療的 `unit_type` **含醫院／診所**（與醫療主題重疊）。
  另 29 筆行動據點與依法保密的安置機構**結構性無地址**，不在圖上（不是等 geocode）。
- **性侵害防治中心不完整**：`welfareGovOffices` 的 T0102 只有 7 筆（22 縣市應各 1），
  上游 datagov 13718 官方下載連結 404。
- **同址不同名機構目前算兩筆**：上游 `trust_chain` 空間層級融合還沒跑，
  `src_datasets`/`n_src` 是名稱＋統編層級的 provenance → 做「這個地址有幾間機構」會偏高。
- **`permit_status` 不是有效／失效**（上游沒發代碼表，已用兩份現行名冊回推證偽）
  → 9 層**完全不使用**，連 popup 都不顯示，免得被當狀態讀。
- **類別中文名是本專案歸納的不是官方定義** —— SSOT 是上游
  `docs/topic-research/welfare/code-table.md`，`welfareTypes.ts` 逐字照抄，不要自己猜。

## 預設全關（與上游建議的差異）

上游 handoff 建議「預設開 3 層」。**本 PR 沒有這麼做** ——
本站 2026-08-10 起的規則是「預設全關：訪客一進站不打任何 RPC、不載任何圖層」
（`layerVisibilityStore.ts` 的 `DEFAULT_ON` 是空 Set）。加進去會讓社福變成**全站唯一**
預設開啟的內容，一進站多載 ~1.9 MB。

改為採納的話是一行的事（把三個 key 加進 `DEFAULT_ON`），但那是站台級決策，需 owner 拍板。
折衷做法：sidebar 群內順序把上游建議的三層排最前面。

## 相關

- 上游契約：[`taipei-gis-analytics/docs/handoff/welfare-layers.md`](../../../taipei-gis-analytics/docs/handoff/welfare-layers.md)
- 代碼表：`taipei-gis-analytics/docs/topic-research/welfare/code-table.md`
- 體系架構：`taipei-gis-analytics/docs/systems/welfare_tic.md`
- 下游視角接線紀錄：[`handoff.md`](./handoff.md)
- 待辦：[`backlog.md`](./backlog.md)
