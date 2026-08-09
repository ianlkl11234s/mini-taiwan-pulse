# education-layers

> **Slug**：`education-layers`（與 taipei-gis-analytics handoff 一致）
> **狀態**：dev — 本機驗收全綠、**未 push、S3 未上傳**
> **Owner**：migu
> **上線日期**：—
> **相關 PR**：—

## 一句話說明

把全台 **4,315 所**各級學校與 **4,324 筆**校地範圍收進獨立的「教育 Education」主題，
學制分 5 級分色，並單獨標出 **1,152 所**偏遠地區學校。

## 已接範圍（W1 ＋ W2 ＋ W3）

上游 **9 個 dataset 全部接完**，合計 16.86 MB（全走 S3 `deploy-assets/education/`）。
剩餘待辦只有分析層與技術債，見 [backlog](./backlog.md)。

## 16 個圖層

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
| `eduDistrictElementary` | 國小學區（**里級**） | 621 | PMTiles 面 |
| `eduDistrictJunior` | 國中學區（**里級**） | 239 | 同源 filter |
| `eduDistrictSenior` | 高中就學區（**縣市級**） | 15 | GeoJSON 面 |
| `eduKindergarten` | 幼兒園（公立 2,392／私立 4,297 二色） | 6,689 | GeoJSON 點 |
| `eduCramSchool` | 短期補習班（14 類 fold 成 5 組；**每日更新**） | 17,137 | PMTiles 點 |
| `eduAfterschoolCare` | 兒童課後照顧中心 | 782 | GeoJSON 點 |
| `eduMutualCare` | 互助教保服務中心（全數私立） | 148 | GeoJSON 點 |
| `eduUniversityStudents` | 大專校別學生數 bubble | 159 | GeoJSON 點 |

**7 個點層共用同一個 source（`edu-schools`）**，2.5 MB 的 `schools.geojson` 只 fetch 一次
——`hydrateOverlayIfNeeded` 以 sourceId 去重，關層走 `visibility:"none"` 不拔 source。
k12 兩級同樣共用 `edu-district-k12` 一份切片。

**國小／國中學區為什麼拆兩個 toggle**：兩級的面**完全疊合**（同一個里同時有國小與國中學區），
合成一個 toggle 會糊成一片。拆開讓使用者獨立開關，兩者共用 opacity slider 與切片。

分色／篩選／標籤的 SSOT 全在 [`src/data/educationTypes.ts`](../../../src/data/educationTypes.ts)。

## 三件會影響「怎麼畫」的事

1. **教育主題沒有即時資料**（上游實打 12 個端點確認 `realtime=0`）。
   停班停課即時已在 `src/data/disasterAlertTypes.ts:44` 的 NCDR 鏈上，**不要在教育 tab 重做**。
2. **`campus_polygon` 的 12 筆 `non_school` 由前端濾除**（國家漫畫博物館、退輔會訓練中心、
   臺大實驗林管理處…）。上游刻意標記而不刪除（刪掉等於竄改上游）。
3. **澎湖／金門校地面 0 筆**（來源 119 分帶為死鏈），圖例已標明「空白不代表當地沒有學校」。
4. **學區面不是精確邊界，而且面與面本來就重疊**——`village_partial`（654 面）表示該里只有
   部分「鄰」屬這所學校，但村里 polygon 無法表達鄰級切分，整個里都被畫進該校面；
   共同學區（292 面）一個里同時屬 2-3 校，每校各自成面。**這是制度事實，不要 dedup。**
   實際歸屬看 popup 的 `lin_specs`。
5. **幼托四份保留上游原始中文欄位名**（`學校名稱`／`短期補習班名稱`／`地址`…），只有
   `university_students` 是英文欄位。三個顯示層陷阱：`縣市名稱`／`地址` 全 6,689 筆帶
   `[NN]` 方括號前綴（顯示時 strip，不動資料）；`地區縣市` 其實是**機關名**（「臺南市政府」），
   要用 `county`；`立案時間` 兩份**紀年不同**（補習班西元 8 位、課後照顧民國 6-7 位）。
6. **`各地短期補習班數量` 欄絕對不可顯示**——它是全國總數 17772，每列值都一樣。
7. **大專學生數 21 筆為 null**，畫成固定小灰點而非當成 0 或從圖上抹掉。

## 資料誠實性標示（圖例八句，勿刪）

學校／校地：

- `低倍率（約 zoom 7.5 以下）不顯示；澎湖、金門 0 筆（來源圖資死鏈），空白不代表當地沒有學校`
- `國小／國中含附設班（附設國小 42、附設國中 228）；大專含空大進修 10、宗教研修 9`
- `學校點位為 113 學年度`（僅在學校／校地層開啟時顯示）

學區（k12 任一開啟時）：

- `僅供參考，實際學區以各校公告為準`
- `僅臺北、新北、臺中、新竹市 4 縣市有公告；其餘 11 縣市空白是「無資料」不是「無學區」`
- `面與面重疊是制度事實：共同學區 292 面，一個里可同時屬 2-3 校，未去重`
- `淡色 = 該里只有部分「鄰」屬本校（654 面），實際歸屬見 popup 的鄰別`
- `臺北為 110 學年度，其餘三縣市較新`

幼托補習／大專學生數：

- `短期補習班為每日更新的資料源，此為 2026-08-07 快照；低倍率（約 zoom 7.5 以下）不顯示，且切片在 zoom 15 以下有抽稀（放大才看得到完整密度，點少不代表該區補習班少）`
- `半透明的點 = 位置為同路段內插的估計值（全體 84 筆），其餘為門牌精確或官方座標`
- `灰點 21 所無學生數統計（進修學院／空大歸母校、宗教研修不在統計範圍），不是 0 人`
- `圓大小反映學生數（368 ~ 34,941 人），最小尺寸另有下限`

## 相關

- 上游 SSOT：[`../../../taipei-gis-analytics/docs/handoff/education-layers.md`](../../../../taipei-gis-analytics/docs/handoff/education-layers.md)
- 下游接線摘要 + 與上游的三處差異：[handoff.md](./handoff.md)
- 變更紀錄：[changelog.md](./changelog.md)
- 待辦（W2/W3 七個 dataset）：[backlog.md](./backlog.md)
