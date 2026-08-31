# Handoff — 臺灣電信與網路狀態 MVP

## 產品目的

在 Monitor 顯示臺灣目前的電信與網路狀態。這是多來源狀態卡，不是地圖圖層：
Cloudflare Radar、IODA、RIPE Atlas、RIPE RIS Live 與 NCDR evidence 只顯示文字／數值，
不替 ASN、prefix、國家狀態或缺資料區域製造 geometry。

## 上游契約

- RPC：`public.get_internet_health_status`
- 前端參數：
  - `p_entity_type = 'country'`
  - `p_entity_ids = ['TW']`
  - `p_include_evidence = true`
  - `p_limit = 500`
- 預期欄位：

```text
row_type, source_observation_id, source, evidence_family, entity_type,
entity_id, entity_name, signal, reported_status, effective_status,
incident_kind, value, unit, baseline_value, change_ratio, confidence,
sample_count, observed_at, source_updated_at, collected_at, age_seconds,
is_stale, active_incident_id, incident_status, metadata
```

`effective_status` 是 UI 真相；`reported_status` 只保留溯源。前端接受的保守狀態為
`normal / watch / degraded / outage / unknown`，並防禦性收斂少量舊別名。

## 前端彙整規則

1. `is_stale !== false`（包含欄位缺失）強制 `unknown`。
2. 空 rows、RPC error、unavailable 與 null 都顯示「資料不足」，不補 0。
3. RPC 的 `row_type = status` 中，`evidence_family = composite` 才正規化為 detector；其他 status rows 是 provider evidence，`official_evidence` 是 NCDR 正向證據。
4. 有 fresh detector 時，以 detector composite 加 active official evidence 的 `effective_status` 為總體真相；沒有 detector 時才保守退回 fresh rows。
5. `confidence` 的 RPC 值為 0–1；前端以 `<0.5 / 0.5–<0.8 / ≥0.8` 顯示 low / medium / high。
6. `normal` 只接受 fresh composite detector 且 `metadata.normal_quorum_met = true`；metadata 缺欄或 false 都回到 unknown。
7. NCDR 無 row 或 0 alerts 只能顯示「未通報／無資料」，不可單獨證明正常。
8. active incident 只列 entity name/id、類型與時間。
9. 不新增 LayerVisibility、Mapbox source、overlay、popup 或 ASN geometry。

## RIPE 擴充契約（2026-08-31）

- `source = ripe_atlas`、`evidence_family = ripe_atlas`：active probing evidence。
- `source = ripe_ris_live`、`evidence_family = ripe_ris`：BGP routing evidence。
- detector 維持 `source = internet_health_detector_v1`、`evidence_family = composite`、
  `signal = internet_health`。
- IODA、RIPE Atlas 與 RIPE RIS provider rows 初期皆為 internal-only；public RPC 不回傳其
  normalized/raw 明細。前端以 LIMITED 呈現；只有 composite metadata 明示時才標 fresh／stale，
  metadata 缺欄則顯示 freshness 未知，不把缺 row 說成來源故障。
- Public-safe composite metadata 可包含：`detector_version`、`normal_quorum_met`、
  `fresh_evidence_families`、`stale_evidence_families`、`restricted_evidence_families`、
  `dependency_groups`、`evidence_class_count`、`coverage_gate_met`、`decision_reasons`。
  前端只讀取已知欄位，缺欄保持 unknown。
- `normal` 只接受 fresh composite detector 且 `metadata.normal_quorum_met = true`；不再要求
  永遠不公開的 IODA provider row。Provider-only normal、stale composite 或缺 quorum metadata
  都必須顯示「資料不足」。
- 來源列區分 `fresh / stale / missing / restricted`，公開 evidence 才顯示 signal、value、
  sample count、資料年齡與 confidence。受限來源只顯示 detector metadata 揭露的 family freshness，
  不推測或洩露 raw metrics。

既有 `ripeAtlasProbes` 是 3,000 點全球靜態 connected-probe metadata 概覽，座標經模糊化且有
志願者偏差；本卡不以 country／ASN／BGP 狀態替探針染色。RIPE RIS prefix／ASN 也不建立 geometry。

## 前端觸點

- `src/data/internetHealthLoader.ts`：RPC、runtime parser、來源／incident 彙整。
- `src/components/intel/monitor/TelecomStatusCard.tsx`：5 分鐘輪詢與狀態卡。
- `src/components/intel/monitor/MonitorPanel.tsx`：widget 接線。
- `src/components/intel/monitor/monitorLayout.ts`：dock/wall 全寬位置。
- `src/components/intel/monitor/monitorSplitLayout.ts`：split 全寬位置。

RIPE 擴充只修改 loader、卡片、tests 與本文件。`MonitorPanel`／兩份 layout、layer manifest、
overlay registry、legend、popup、click registry 與既有 `ripeAtlasProbes` asset 均維持不變。

既有 `lifelineAlerts` 仍負責 NCDR CAP 地圖：只有上游真的提供 geometry 才渲染；本卡不複製或推測其範圍。

## 驗收邊界

- RPC migration 未 apply 前，卡片應誠實顯示「資料不足」，不代表前端壞掉。
- Browser live gate 必須把卡片與實際 RPC rows、`source_updated_at`、`is_stale` 逐項對照。
- 單元測試覆蓋 stale、空資料、NCDR-only normal、composite quorum、受限來源、incident 與 null 語意。
- 正式上線仍需 migration apply、collector fresh data、RPC anonymous grant、browser QA 與 deploy 分別確認。

## Browser live gate

1. 確認 migration 已 apply，且 RPC 用 anonymous session 呼叫 country/TW 能回 fresh detector；只有
   `public_rpc_enabled=true` 的 provider rows 會回傳，IODA 與兩個 RIPE provider rows 缺席是預期政策。
2. 啟動前端並開啟 Monitor；`電信與網路 · CONNECTIVITY` 應位於事件區下方、全寬、不壓到下方雙欄卡片。
3. 在 browser Network 面板確認 request 是 `get_internet_health_status`，參數為 country、`[TW]`、include evidence、limit 500。
4. 逐列對照 Cloudflare／IODA／RIPE Atlas／RIPE RIS Live／NCDR；公開來源顯示狀態、metric、
   sample、confidence 與資料年齡，受限來源顯示 LIMITED 與 detector family freshness；null 必須是 `—`，
   NCDR 缺 row 必須是「未通報／無資料」。
5. 用 stale 或空資料 fixture 驗證總體為「資料不足」且 fresh sources 為 0；用 RPC 失敗驗證舊 normal 不會繼續亮綠。
6. 用 fresh detector + `normal_quorum_met=true` fixture 驗證 normal；缺 metadata／false 必須 unknown；
   加入 active NCDR official evidence 時驗證 outage 與 incident 摘要。
7. 縮窄視窗檢查來源列換行、卡片內容不裁切；Mapbox sources/layers 數量不應因本卡增加。

## Production truth（2026-08-31）

- Release：PR #192 已 merge，master baseline 為 `553446598b423822698ff3991b1fc86e28aa9844`。
  Zeabur production deployment `6a9541f89ed7d65609e25e16` 為 `RUNNING`，正式網址為
  `https://mini-taiwan-pulse.itsmigu.com/`。該次 redeploy 的 Zeabur metadata 未回填 commit SHA，
  因此不把 deployment ID 與 Git commit 說成 control-plane 已直接綁定。
- Browser：production Monitor 實際顯示 Cloudflare Radar、IODA、RIPE Atlas、RIPE RIS Live、NCDR
  五個來源列；IODA／RIPE Atlas／RIPE RIS Live 共 3 列為 `LIMITED`。總體維持
  `UNKNOWN / 資料不足`，且顯示沒有 confirmed incident；缺資料與無官方事件沒有被當成正常證據。
- Public-safety gate：針對受限 provider detail 的 8 個 forbidden markers 全部為 false；公開頁面未出現
  被禁止的 observation ID、signal、raw value／unit、sample、timestamp 或 confidence 明細。
- RPC／collector：RIPE Atlas internal scheduled collection 已 live，但 Atlas provider rows 在 public RPC
  仍為 0，符合 internal-only 契約。RIPE RIS Live 仍 disabled；必須先取得 Zeabur control plane 的
  actual Replicas = 1 證據，不能只依賴環境變數宣稱 singleton，才可啟用 bounded worker。
- Console：production browser console errors 為 0。

此 snapshot 證明五來源 UI、restricted evidence 防洩漏與 unknown 語意已在 production 生效；它不證明
臺灣網路正常或正在斷網。當下沒有 active NCDR official evidence／confirmed incident，outage 優先路徑
仍只有 contract 與 unit test 證據。
