# Changelog — education-layers

> 逐 PR 變更紀錄。最新在上。

## 2026-08-09 — 未 PR（branch `feat/education-layers`，接續 W2）

**W3：幼托補習 + 大專學生數 5 個圖層 —— 上游 9 個 dataset 全部接完**

- `eduKindergarten` 幼兒園 6,689（公立 2,392／私立 4,297 二色）
- `eduCramSchool` 短期補習班 17,137（PMTiles z8-15，14 類 fold 成 5 組）
- `eduAfterschoolCare` 兒童課後照顧 782／`eduMutualCare` 互助教保 148（單色）
- `eduUniversityStudents` 大專校別學生數 159（bubble，面積正比於學生數）
- 教育主題新增第四個 group「幼托補習 Childcare & Cram」；大專學生數併入既有「學校 Schools」group

**設計決策**

- **補習班 14 類 fold 成 5 組**（文理 12,554／外語 2,585／藝術 1,401／技職 490／其他 107）：
  文理類一家獨大 73%，其餘長尾若逐一列圖例會有 14 列且多數 < 250 筆。
- **`interpolated` 精度淡化到 45% opacity**：同路段內插的估計位置全體 84 筆，
  上游要求「別把它當成跟 exact 一樣可信」，用視覺區隔而非隱藏。
- **null 學生數畫成固定小灰點**：21 筆全部可解釋，畫出來 + popup 說明原因，
  比當成 0（誤導）或從圖上抹掉（不誠實）都好。半徑走 `case` 分支，不能落進 interpolate。

**三個 handoff 沒寫、實測才發現的顯示層陷阱**

1. `kindergartens` 的 `縣市名稱`／`地址` **全 6,689 筆帶 `[NN]` 方括號前綴**（`[01]新北市`）。
   只在顯示層 strip，不動資料——上游 geocode 刻意保留，拿掉命中率歸零。
2. `cram_schools` 的 `地區縣市` 其實是**機關名**（「臺南市政府」），要用 `county`。
3. `立案時間` 兩份**紀年不同**：cram 西元 8 位（`20041103`）、afterschool 民國 6-7 位（`1020812`），
   都要正規化成 `YYYY-MM-DD`，直接印會出現「1020-08-12」這種鬼日期。

**驗收**

- `npx tsc -b` exit 0；`pnpm test` **325/326**（唯一紅燈 `lightningCwa` 為 HEAD 既有）
- 資料層複驗：6,689／17,137／782／148／159 全對；`公/私立` 2,392+4,297；
  補習班 5 組 fold 後合計 17,137；`students_total` null 恰 21 筆（有值 138，368~34,941）
- 部署無需改動（`public/education/` 的 glob 自動涵蓋 5 個新檔）。累計 16.86 MB
- 瀏覽器驗收 8/8：bubble null 處理（全台 qRF **raw 159 / uniq 159 / 灰點 21 / 紫點 138**，
  null 半徑 3 非 0、有實體 hit box）✅；`各地短期補習班數量` 確認存在於 tile properties
  但前端未渲染 ✅；幼兒園全台 6,689 筆公立 2,392／私立 4,297 與源資料逐筆吻合 ✅；
  `[NN]` 前綴已 strip、民國 `1020812` → `2013-08-12` ✅；三層共用 slider 連動正確 ✅；
  console 零錯誤 ✅

**驗收揪出的一個誠實性缺口（已修）**

`cram_schools` 的 PMTiles 用 `--drop-densest-as-needed` 切片，**z8~z14 每層都大量丟點，
只有 z15 完整**（實測台北同一 bbox：z12 只有 15 筆、z13 35、z14 84、z15 204）。
原本圖例只寫「zoom 7.5 以下不顯示」，使用者在 z10-12 會看到零星幾十顆點而誤判
「圖層壞了／資料很少」。圖例已補上抽稀說明。根治需上游重切，列為 EDU-14 待拍板。

順帶修正另一句措辭：bubble 半徑實為 `3 + 0.1·√n`（含 null 用的固定下限），
不是嚴格面積正比，圖例從「圓面積正比於學生數」改為「圓大小反映學生數…最小尺寸另有下限」。

---

## 2026-08-09 — 未 PR（branch `feat/education-layers`，接續 W1）

**W2：學區面 3 個圖層**

- `eduDistrictElementary` 國小學區 621 面／`eduDistrictJunior` 國中學區 239 面
  （同一份 `school_district_k12.pmtiles`，z6-13，共用 sourceId `edu-district-k12` 與 opacity param）
- `eduDistrictSenior` 高中就學區 15 面（GeoJSON，5 色循環）
- 教育主題新增第三個 group「學區 District」

**設計決策**

- **k12 拆兩個 toggle 而非上游規劃的一個**：國小與國中學區的面**完全疊合**
  （同一個里同時有兩級學區），合成單一 toggle 會糊成一片。拆開讓使用者獨立開關。
- **依 `precision` 分色**（整里皆屬 = 飽和色／部分鄰屬 = 淡色）：把「這個面的邊界是模糊的」
  直接畫進視覺，不必等使用者點開 popup 才知道。
- **高中就學區用 5 色循環不列 15 色圖例**：顏色只為區分相鄰區域，沒有語意。
- **重疊未去重**：共同學區 292 面、1,115 組一里多校是制度事實。

**踩到的上游契約錯誤**

`school_district_senior.geojson` 的 `district_no` handoff §3.4 寫 `6`（number），
實際 15 筆**全是字串** `"6"`（同檔的 `county_count`／`area_km2`／`rule_row_count` 都是 number）。
Mapbox 算術運算子對字串做 number assertion 會 evaluation error → `match` 回 null →
**15 個面會全黑**。已在 `districtSeniorColorExpr()` 包 `["to-number", …]` 並回報上游。

**另一個上游沒寫的欄位細節**

`lin_specs`（鄰別）只有 `village_partial` 的 654 筆有值，`village_full` 的 206 筆是**空字串**
（不是 null）。popup 走 `linSpecsLabel()` 三態處理，`village_full` 顯示「整里皆屬本校」。

**部署**：`public/education/` 在 W1 已設好 nginx location / pull sync / upload glob，
兩個新檔（1.40 MB + 0.70 MB）自動涵蓋，**無需改部署**。累計 8.96 MB。

**驗收**

- `npx tsc -b` exit 0；`pnpm test` **320/321**（唯一紅燈 `lightningCwa` 為 HEAD 既有）
- 資產確認用的是 simplified 版（避開 handoff 坑 #7）：k12 PMTiles 的 `generator_options`
  顯示來源是 `web/school_district_k12_web.geojson`（**非** processed 根目錄的 21.71 MB 原精度）；
  senior 本地 736,788 bytes = 0.70 MB（**非** 12.24 MB）
- 資料層複驗：`level` 621／239 = 860 ✅、`precision` 206／654 = 860 ✅
- 瀏覽器驗收：見下方追記

---

## 2026-08-08 — 未 PR（branch `feat/education-layers`）

**W1：教育主題上線，8 個圖層**

- 新增「教育 Education」主題 tab，兩個 group（學校 Schools／校地 Campus）
- `schools` 學校總覽層**從「基礎建設 → 公共設施」搬入教育主題**
  - `sourceId` `schools` → `edu-schools`、`sourceUrl` `./geo/schools.geojson` → `./education/schools.geojson`
  - 連帶改 `useMapInteraction` 的 layer id 字串（`schools-*` → `edu-schools-*`）
  - deep-link `?layers=schools` 保住（key 未改名）
- 新增 7 個 layer：`eduCampusPolygon` / `eduSchool{Elementary,Junior,Senior,University,Special}` / `eduRemoteSchools`
- 新增 `src/data/educationTypes.ts`（分色／篩選／標籤／baseline 數字 SSOT）
- 新增 `src/components/featureInfo/educationPanels.tsx`（`SchoolPanel` 自 `infraPanels` 搬入並補 `region_type`；新增 `EduCampusPanel`）

**順手修掉的兩個既有問題**

- `overlayRegistry` 的 `schools` 分色 match 表過期：列了「空中大學」「專科學校」兩個資料裡
  **不存在**的幽靈值，而真實存在的「空大及大專校院附設進修學校」10 校、「附設國民中學」228 校等
  共 289 校落 fallback 藍。改走 `educationTypes` SSOT，9 種 `school_level` 全覆蓋
- `schools` 層原本**沒有 opacity slider**（違反圖層 UX 四鐵則 #1），本次補上（`eduSchoolsOpacity`）
- `upstreamRegistry` 的 `schools` 對應修正：`layer2_polygon`/LOW → `schools`/HIGH

**部署**

- `public/education/`（整夾 gitignore，6.86 MB 走 S3）
- `nginx.conf` 加 `location /education/`（純 S3 無 dist fallback）
- `pull-deploy-assets.sh` 加 mkdir + sync；`upload-deploy-assets.sh` 加鏡像子前綴上傳段

**驗收**

- `npx tsc -b` exit 0
- `pnpm test` 319/320（唯一紅燈 `lightningCwa → lightning_cwa` 為 **HEAD 上既有**，
  本次 diff 未碰 lightning；上游 catalog 只有 `lightning_taipower.md`，修法在上游補文件）
- 資料層複驗：5 分級 2656/964/508/159/28 = 4,315 ✅；偏遠 1,152 ✅
- 瀏覽器驗收（agent-browser）：8 層渲染 ✅、四鐵則 4/4 ✅、圖例三句逐字 ✅、
  popup 偏遠有值/一般不顯示 ✅、console 零錯誤 ✅

**Breaking / migration**

- 無 DB migration。舊資產 `public/geo/schools.geojson` 與 S3 扁平根的
  `deploy-assets/schools.geojson` 成為孤兒（已無 `sourceUrl` 引用），本次未清理，見 backlog。
