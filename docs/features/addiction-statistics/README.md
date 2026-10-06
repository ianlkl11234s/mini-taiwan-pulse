# 成癮與減害統計 Statistics（HIV／執法／行為調查／服務據點）

> **Slug**：`addiction-statistics`（上游：analytics `docs/topic-research/harm_reduction/statistics-release-plan.md`、`candidate-execution/addiction-statistics-recipes.draft.json`）
> **狀態**：dev（前端已接線；DB import 與 R2 增量發布待主 agent 2026-10-06 20:00 後執行，發布前瀏覽器載不到資料）
> **上線日期**：未上線
> **相關**：點位圖層見 [`../harm-reduction/README.md`](../harm-reduction/README.md)

## 一句話說明

Statistics「人口與社會」新增「成癮與減害」主題：疾病（HIV）、執法（毒品、酒駕、地檢署）、行為調查（吸菸、檳榔）、服務據點四組，共 61 層、280 個 exact selector（7 dataset、縣市＋鄉鎮）。第二級毒品嫌疑犯（含比例）與毒品危害防制中心依主 agent 決定不接（recipe 保留 `enabled: false`，selector 不在 R2）。

## 圖層 / 群組

| 小群組 | Statistics 一列 | 成員（選單） | 期別 |
|---|---|---|---|
| 疾病（HIV） | HIV 本國籍新通報（縣市） | 人數／每 10 萬人 | 2003–2025／比例 2018–2025 |
| | HIV 本國籍確定病例（鄉鎮，5 年合計） | 5 年合計人數／年平均每 10 萬人 | 2016–2020、2021–2025／比例只有 2021–2025 |
| 執法 | 毒品嫌疑犯、（施用）、第一級 | 人數／每 10 萬人 | 2002–2025／比例 2018–2025 |
| | 酒駕公共危險罪 | 發生數／犯罪率（來源自帶） | 2001–2025 |
| | 酒駕取締 | 件數／每 10 萬人 | 2003–2025／比例 2018–2025 |
| | 地檢署毒品案件新收 | 毒品／施用／第一級／第二級新收、緩起訴附命戒癮治療（指標） | 2022–2025、2026 1–8 月 |
| 行為調查 | 18 歲以上目前吸菸率；嚼檳榔率（近六個月） | 單一層 | 2024；2013／2017／2021 |
| 服務據點 | 清潔針具衛教站、自動服務機、回收桶、藥癮／替代治療、酒癮治療、HIV 篩檢點、HIV 自我檢測、PrEP、戒菸、網路成癮（10 列） | 縣市：據點數／縣市：每 10 萬人／鄉鎮：據點數／鄉鎮：每 10 萬人 | 名冊快照 2026-10-06 |

- 原始數／比例、縣市／鄉鎮都在同一列的選單切換（`ADDICTION_STATISTICS_TOGGLE_GROUPS` → `medicalStatisticsGroups.ts`）；切換要求同期別，沒有同期別（例：2010 年原始數 → 比例）時沿用既有「不可靜默跳年份」規則不切換。
- HIV 縣市（gecdb 新通報）與鄉鎮（NIDSS 確定病例、依診斷日）口徑不同，刻意分兩列，不放在同一選單互換。
- 本家族沒有 dimensions；期別只有一列「資料期別」，由 exact whitelist 取最新公開期別（`addictionReleaseOptions`）。

## 缺值、0 與圖例

- 地圖沿用既有 hatch（不新增 pattern）：不適用（S7 8 縣市）與無資料（金馬嚼檳榔）用單向細斜線，隱私遮蔽（S6 1–2 例）用交叉斜線；三者都不上數值色。
- 圖例依本層會出現的狀態分列文字：「不適用（地檢署轄區跨縣市或同縣市多署）」「無資料（金門、連江未納入調查，不是 0）」「隱私遮蔽（1–2 例不顯示，不是 0）」（`status_labels`，由 builder 依 bundle 實際 status 產生）。說明・來源另列真 0／不適用／無資料／隱私遮蔽計數。
- 服務據點 0 是真 0（名冊全國覆蓋），落在最淺色；圖例加註「最淺色含 0 處」。門檻全部 > 0，沒有二元 `breaks:[0]`。

## 視覺

- 色階唯一入口 `statisticsVisuals.ts` 的 `ADDICTION_KEY_ICONS`（key 明確指定，避免「酒駕」「HIV」落入交通或 fallback）：疾病／行為調查／服務據點＝醫療 BuGn；執法（警政、地檢署）＝既有治安 Reds。不新增色票。
- icon：HIV Ribbon、毒品 Pill、酒駕 Wine、地檢署 Gavel、吸菸 Cigarette、檳榔 Leaf、針具 Syringe、篩檢 TestTube、PrEP HandHeart、網路成癮 Smartphone。
- 門檻用 recipe `legend.breaks`（release plan §2 手調、固定），不依當期重算。

## 來源與口徑（release plan §3）

- 毒品嫌疑犯／酒駕：查獲（受理）警察機關所在縣市，不是居住地或發生地；反映執法強度，不等於盛行率；署屬單位列未分配。
- HIV（縣市）：本國籍、居住縣市年度新通報；不含危險因子。HIV（鄉鎮）：5 年合計、隱私遮蔽；與縣市層不可並比。
- 吸菸／嚼檳榔：抽樣調查，縣市差距多在誤差內；嚼檳榔不含金門、連江。
- 服務據點：名冊快照 2026-10-06；每 10 萬人分母為 115 年 8 月底戶籍人口（與快照日不同）。點位來源圖層寫在每層說明。
- 地檢署：只顯示轄區恰為單一縣市的 14 署；115 年為 1–8 月累計。
- 授權照交付原文（多數「政府網站資料開放宣告（未逐字確認）」、服務據點為「衍生計數；點位來源授權：unspecified」），未升級成 OGDL。
- 資料來源總覽：每層一張卡（`getStatisticsDataSourceDefinition`），機關＝性平會（疾管署）、疾管署 NIDSS、警政署、法務部、性平會（國健署）、衛福部心理健康司、本專案減害點位圖層。

## 檔案

- 交付 → 前端：`scripts/statistics/build_addiction_statistics_recipes.py`（逐 release 開 analytics bundle 驗 dataset／indicator／unit／level／period／boundary 與 status）→ `src/data/addictionStatisticsRecipes.json` → `npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts` → `.catalog.json`（去掉 `delivery` 收據）。
- `src/data/addictionStatisticsRecipes.ts`：whitelist、群組、圖例狀態列。
- R2 verify 可直接吃 Pulse 檔：`publish_incremental_r2.py verify --recipes <Pulse>/src/data/addictionStatisticsRecipes.json`（enabled × release_options＝280 selector，已與草案及 import 清單比對一致）。

## 分析倉庫（MCP）

- 統計不登錄 `researchDatasets.ts`（同 environment／demographics 先例）；分析走倉庫 `stats_observations`。manifest upstream datasetId＝`addiction_*`，與倉庫同名，不需 alias。
- 14 個減害點位圖層的 upstream id 與 analytics dataset 同名（不需 alias）；倉庫尚未入倉，`layer-status-overrides.json` 先標 `snapshot_candidate`（pending），入倉後 `build-layer-status.mjs` 自動清除。
- R2 發布後要跑（倉庫不會自動更新）：

```bash
# 在 mini-pulse-gis-mcp repo（倉庫工具所在；--only 為 build_warehouse 語意的 dataset id 清單）
cd <GIS>/mini-pulse-gis-mcp
A=<GIS>/taipei-gis-analytics/.worktrees/harm-reduction-20261006   # 或已合入的主 checkout
# 1) 統計：R2 → 倉庫 stats_observations
python3 warehouse/stats_cdn.py download
python3 warehouse/update_store.py --analytics-dir "$A" --stats-cdn --only addiction_hiv_county,addiction_hiv_township,addiction_drug_suspects_county,addiction_dui_county,addiction_prosecutor_drug_county,addiction_tobacco_betel_county,addiction_service_points
# 2) 14 個減害點位（analytics data/processed/poi/<id>/_manifest.json）
python3 warehouse/update_store.py --analytics-dir "$A" --only harm_reduction_needle_points,drug_treatment_facilities,hiv_selftest_outlets,hiv_testing_sites,drug_prevention_centers,alcohol_treatment_facilities,prep_service_sites,internet_addiction_services,offender_aftercare_offices,smoking_cessation_providers,anti_drug_pharmacies,condom_outlets,therapeutic_communities,dui_crash_points
# 3) 上傳（plan 確認表列數只增不減）
npm run warehouse:upload -- plan && npm run warehouse:upload -- execute
# 4) Pulse：以新倉庫快照重算狀態表（pending overrides 自動清除）
cd <Pulse checkout> && PULSE_WAREHOUSE_DIR=<新倉庫 catalog 目錄> npx vite-node --script scripts/research/build-layer-status.mjs
```

## 待辦

- 發布後瀏覽器驗收：All Off → 單層 → 原始／比例 → 縣市／鄉鎮 → 不適用／無資料／遮蔽圖例 → 來源總覽 → 手機。
- S7 地檢署轄區層（`prosecutor_district`）屬架構級，見 release plan 附錄 B。
- 衛教站台數 773 小於據點數 805（點位 owner 確認；不影響據點數）。
