# Changelog — education-layers

> 逐 PR 變更紀錄。最新在上。

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
