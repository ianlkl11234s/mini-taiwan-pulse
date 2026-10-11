# 圖層／主題名稱翻譯覆蓋率

> 全部為**機器草稿翻譯**（Claude 產出），未經母語者校稿。盤點腳本：`npx vite-node scripts/i18n/export-layer-names.ts [輸出路徑]`。

## 數量

| 項目 | 數量 |
|---|---|
| 有 section 的圖層總數 | 1072 |
| en：沿用 manifest alt（拉丁字母） | 428 |
| en：`en/layers.json` 補譯 | 644 |
| ja：沿用 manifest alt（日文／含漢字） | 53 |
| ja：`ja/layers.json` 補譯 | 1019 |
| 主題＋子群字串（distinct） | 277 |
| `en/themes.json`（僅無英文半段者） | 193 |
| `ja/themes.json`（全部） | 277 |

驗證：en 皆解析為非中文主名、ja 皆有條目或日文 alt（0 缺）；`npx vitest run src/i18n` 通過。

## 不確定、建議校稿

1. 土地使用「占…同類比」：en "Share of National Total"、ja「全臺同種比」（或「全臺構成比」較自然）
2. `statsComparison*NursingHome／CareWorker`：「人口比較」基準依 key 推定（每千名 65 歲以上）
3. `statsComparisonHousingOccasionalSharePct*`「偶爾自住」：譯為 Occasionally Used Dwellings
4. `weakSoil*` 六筆：中文同名，依 key 補深度（0–5／5–10／10–20 m），單位為推測
5. `satellitesTJS`：ja「静止軌道情報衛星」為意譯
6. `plaActivity`「共機」：ja「中国軍機」
7. `coastGuardStation`：ja「海巡（海岸巡防）」
8. `statsComplaintCasesPndCounty` 陳情件數 vs 案件數：英文難區分
9. `statsLaborCountyEmploymentByIndustry`：Employed Persons by Industry
10. `jpMarineEbsaCoastal`：EBSA 已展開
11. `iPostBoxes`：ja 括號說明為自加
12. 民國年份主題／圖層：en 換成西元，ja 保留民国（如 115 年 1–8 月 → Jan–Aug 2026）
13. 「投放點」「整體公司」「樞紐節點」等主題字串
14. 期末營業里程（bus）：Operating Route Length at Period End
