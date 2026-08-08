# education-layers

> **Slug**：`education-layers`（與 taipei-gis-analytics handoff 一致）
> **狀態**：dev — 本機驗收全綠、**未 push、S3 未上傳**
> **Owner**：migu
> **上線日期**：—
> **相關 PR**：—

## 一句話說明

把全台 **4,315 所**各級學校與 **4,324 筆**校地範圍收進獨立的「教育 Education」主題，
學制分 5 級分色，並單獨標出 **1,152 所**偏遠地區學校。

## 本輪範圍（W1）

上游 9 個 dataset 中的 2 個（`schools` / `campus_polygon`）。
其餘 7 個（幼兒園、補習班、課後照顧、互助教保、國中小學區、高中就學區、大專學生數）見 [backlog](./backlog.md)。

## 8 個圖層

| layer key | 內容 | 筆數 | 型態 |
|---|---|---:|---|
| `schools` | 學校總覽（可切「依學制分色」） | 4,315 | GeoJSON 點 |
| `eduSchoolElementary` | 國小（含附設國小 42） | 2,656 | 同源 filter |
| `eduSchoolJunior` | 國中（含附設國中 228） | 964 | 同源 filter |
| `eduSchoolSenior` | 高中職 | 508 | 同源 filter |
| `eduSchoolUniversity` | 大專（含空大進修 10、宗教研修 9） | 159 | 同源 filter |
| `eduSchoolSpecial` | 特教 | 28 | 同源 filter |
| `eduRemoteSchools` | 偏遠地區學校（偏遠 830／特偏 192／極偏 130） | 1,152 | 同源 filter |
| `eduCampusPolygon` | 校地範圍（濾除 non_school 12） | 4,324 | PMTiles 面 |

**7 個點層共用同一個 source（`edu-schools`）**，2.5 MB 的 `schools.geojson` 只 fetch 一次
——`hydrateOverlayIfNeeded` 以 sourceId 去重，關層走 `visibility:"none"` 不拔 source。

分色／篩選／標籤的 SSOT 全在 [`src/data/educationTypes.ts`](../../../src/data/educationTypes.ts)。

## 三件會影響「怎麼畫」的事

1. **教育主題沒有即時資料**（上游實打 12 個端點確認 `realtime=0`）。
   停班停課即時已在 `src/data/disasterAlertTypes.ts:44` 的 NCDR 鏈上，**不要在教育 tab 重做**。
2. **`campus_polygon` 的 12 筆 `non_school` 由前端濾除**（國家漫畫博物館、退輔會訓練中心、
   臺大實驗林管理處…）。上游刻意標記而不刪除（刪掉等於竄改上游）。
3. **澎湖／金門校地面 0 筆**（來源 119 分帶為死鏈），圖例已標明「空白不代表當地沒有學校」。

## 資料誠實性標示（圖例三句，勿刪）

- `低倍率（約 zoom 7.5 以下）不顯示；澎湖、金門 0 筆（來源圖資死鏈），空白不代表當地沒有學校`
- `國小／國中含附設班（附設國小 42、附設國中 228）；大專含空大進修 10、宗教研修 9`
- `學校點位為 113 學年度`

## 相關

- 上游 SSOT：[`../../../taipei-gis-analytics/docs/handoff/education-layers.md`](../../../../taipei-gis-analytics/docs/handoff/education-layers.md)
- 下游接線摘要 + 與上游的三處差異：[handoff.md](./handoff.md)
- 變更紀錄：[changelog.md](./changelog.md)
- 待辦（W2/W3 七個 dataset）：[backlog.md](./backlog.md)
