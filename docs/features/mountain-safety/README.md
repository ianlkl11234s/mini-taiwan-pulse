# 登山安全 Mountain Safety

> **Slug**：`mountain-safety`（上游批次 handoff：`pulse-batch-20260801`）
> **狀態**：dev
> **Owner**：migu
> **上線日期**：（待 PR merge）
> **相關 PR**：#（待補）

## 一句話說明

把「山域意外事故 2,465 件（2019-2024）」與「全台山屋・高山營地 136 處」接上地圖，
配合既有的步道（7,339 條）與通訊點，讓「哪裡容易出事 / 出事時附近有什麼庇護與通訊」
可以疊在同一張圖上讀。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 主題群 | 狀態 |
|---|---|---|---|---|
| `mountainRescueIncidents` | point (2,465) | GeoJSON `public/hazards/mountain_rescue_incidents.geojson` | 災害 Hazard / 山域事故 | ✅ |
| `mountainHuts` | point (136) | GeoJSON `public/forestry/mountain_huts.geojson` | 林業 Forestry / 點位 | ✅ |

## 「登山安全」怎麼看（組合開法）

本站**沒有情境 preset 機制**，這組敘事靠手動疊圖（刻意不為此新增機制）：

1. 側欄按 **All Off** 清空
2. 開 **災害 Hazard → 山域事故**（先看全部年份的分布）
3. 開 **林業 Forestry → 全台步道 + 通訊點 + 山屋・高山營地**
4. 讀法：事故點密集但無通訊點覆蓋的路段 = 高風險；山屋附近的事故多為「疲勞 / 高山症」，
   稜線與溪谷段多為「墜谷 / 創傷」

## 視覺設計決定

| 項目 | 決定 | 理由 |
|---|---|---|
| 事故分色 | `cause` 17 個原始值 → **9 族**（SSOT `src/data/mountainSafetyTypes.ts`） | 原始值有「迷路,遲歸」這種複合值與 5 種自然危害細分，直接 match 會碎成 17 色讀不動 |
| 事故點大小 | 出動總人次 4 級倍率（<10 / 10-29 / 30-79 / ≥80 人） | 中位數 7 人、max 799 人，級距拉開才看得出大規模搜救 |
| 死亡標示 | 紅描邊（223 件） | 用描邊而非改填色，才不會跟 cause 分色打架 |
| 年份篩選 | 原生 `<select>`（全部 + 2019-2024） | 7 個選項 > 3 → 走四鐵則 #4 的 dropdown |
| **不接全域時間軸** | 走 filter 不走 timeStore | 全域時間軸是「即時 / 當日」語意，年度歷史資料掛上去語意不合且成本高 |
| 山屋分色 | `facility_type` 4 類（山屋 / 山莊 / 營地 / 避難山屋） | 上游 trust chain 已正規化，直接可用 |
| 無名山屋 | popup 顯示「無名山屋」 | 12 筆 name=null 是上游誠實保留的無名工寮，不該憑空造名 |

## 授權標示（⚠️ 必須保留）

`mountainHuts` 含 OSM 來源（126/136）→ **ODbL**：
- 圖例：`LegendPanel.tsx` 的 `MountainHutTypesLegend` 底部一行
- Popup：`forestryPanels.tsx` 的 `MountainHutPanel` 底部一行

移除任一處都違反 ODbL 姓名標示要求。

## 關鍵檔案

- 配色 / 分類 SSOT：`src/data/mountainSafetyTypes.ts`
- Overlay：`src/map/overlayRegistry.ts`（`mountainRescueIncidents` / `mountainHuts`）
- Catalog：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + THEMES）
- Legend：`src/components/LegendPanel.tsx`（`MountainRescueLegend` / `MountainHutTypesLegend`）
- Popup：`src/components/featureInfo/hazardPanels.tsx` + `forestryPanels.tsx`
- 參數：`src/hooks/useTransportParams.ts`
- 部署：`nginx.conf`（`location /hazards/`）+ `scripts/deploy/{upload,pull}-deploy-assets.sh`

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/pulse-batch-20260801.md`。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/pulse-batch-20260801.md`
- 開發規則：`../../development-rules.md`
