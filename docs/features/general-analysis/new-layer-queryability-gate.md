# 新圖層上線時的資料查詢關卡

本頁補在 [`layer-onboarding` 的資料完整性及瀏覽器驗收之間](../../../.claude/skills/layer-onboarding/SKILL.md)。適用往後新加入或更新原始資料的圖層；既有 778 層的回補另依[完成清單](./completion-checklist-20260925.md)分批進行。目標是上線時就知道 Agent **能查哪份資料、問哪些問題、不能保證什麼**，不要等展示完成後才發現沒有原表 reader。

## 上線門檻

| Gate | 必留證據 | 未過時 |
|---|---|---|
| Q0 來源身份 | publisher、原始檔／RPC／release、版本／SHA、授權與 access、觀測／取得時間；多 layer refs 指向真正同一原表時才共用 reader | `SOURCE_MISSING`／`RIGHTS_HOLD`／`VERSION_MISMATCH`；不把 PMTiles 或相似名稱當分析原表 |
| Q1 資料格式 | record grain、欄位型別與單位、母體／排除筆數、主鍵與重複、`missing`／suppressed／observed zero；WGS84／CRS、Point／Line／Polygon／格網、geometry role／precision、無效幾何 | 修來源或只保留合格子集；不能把無座標或 proxy 偷換成精確點 |
| Q2 可查契約 | 一個 `DatasetDescriptor` 與有界 reader：合法欄位／filters、範圍／期間、max rows／bytes／timeout、分頁及截斷；權限依來源設 `owner_only` 或公開；來源改版能拒絕或重建 | `READER_PENDING`；僅地圖顯示不算 Agent 可查 |
| Q3 實際查詢 | 以兩個不同地點或一地點加有效反例、分類／期間變體實讀；與 reader 之外的原表 oracle 核筆數、排除及一筆明細；測錯版本／超限 | 保留查詢失敗與修復動作，不勾 `QUERY_READY` |
| Q4 分析語意 | Point 直線距離、Line 點到完整線、Polygon 包含／相交、格網原值或縣市同期同口徑比較，只驗來源真正合格的運算；時間窗與不確定性入答案 | 可標 `ATTRIBUTE_ONLY`；不能把有經緯度直接等同可精確分析 |
| Q5 Agent 與地圖 | 正常配對的 Codex→MCP→Gateway→browser 查詢；合格幾何呈現回 `ready`、讀回 result IDs／features／sources／layers 並目視；純屬性結果不強畫圖；同版展示另核 | 只稱本地 reader／MCP 通過，不稱地圖全鏈通過 |
| Q6 固化 | focused tests、`npx tsc -b`、適用的 build／layerConsistency、來源與查詢收據、逐層台帳／queue 更新、exact-path 原子 commit | 不以口頭成功取代可重建交付 |

**新資料層預設要有 Q0–Q3，才標記「Agent 可查」並作為查詢能力上線。** 若資料本質是純視覺影像、無合法可用原表、權利不明或只能顯示，仍可另行決定展示，但必須在 manifest／台帳／UI 說明中明標 `DISPLAY_ONLY` 或具體 HOLD，並記可解鎖條件；不能承諾它能回答附近、最近或縣市比較。Q4／Q5 按該層實際宣稱的分析／地圖能力驗，不以無關項目阻止純屬性來源。

## 每層最小收據模板

```text
layer key / 真正共用的 source family / datasetId：
來源機關、原檔或 release、版本 SHA、license/access、觀測／取得時間：
原始筆數 → 有效筆數 → 排除原因；主鍵／重複；null／suppressed／zero：
幾何 CRS/type/role/precision；允許與禁止的查詢、分析與距離口徑：
reader 路徑、filters、bbox/time/limit/bytes/timeout、查詢欄位白名單：
新地點＋問題變體與原表獨立 oracle；focused tests、tsc、build：
正常 MCP 查詢證據；若有地圖，ready/readback/目視；舊展示同版：
狀態 QUERY_READY／SPATIAL_READY／ATTRIBUTE_ONLY／DISPLAY_ONLY／HOLD：
未過 gate、解鎖動作、負責方、重查觸發；exact-path commit：
```

查詢接線沿用 `src/research/dataContracts.ts`、`src/research/researchDatasets.ts`、既有 source-family reader 與 `QueryExecutor`；圖層 manifest／catalog／hook／overlay 仍照 `layer-onboarding`。以 `npx vite-node --script scripts/research/capability-audit.mjs --date YYYY-MM-DD --output-base docs/features/general-analysis/capability-audit-YYYYMMDD --family-ledger-base docs/features/general-analysis/p0-source-family-ledger-YYYYMMDD` 產生新日期台帳，再依該台帳更新 queue；不覆寫 2026-09-25 基線。audit 只量登記契約，payload／MCP／瀏覽器驗收仍以各家族收據為準。

若 Q0 權利或完整原表不能證明，先記具體 HOLD，繼續其他家族；補證據後再重試。發布到遠端、Supabase／S3 寫入和對外開放各自另有驗收與授權，不由本頁自動授權。
