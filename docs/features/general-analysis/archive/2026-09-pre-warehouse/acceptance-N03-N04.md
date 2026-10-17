> ⚠️ 歷史文件（已被 [PLAN-warehouse-20260926](../../PLAN-warehouse-20260926.md) 取代），只作查證，不作施工依據。

# N03 線面與 N04 事件交叉驗收

2026-09-23 更新：下方原驗收保留歷史；**00:25 原始邊界重驗取代舊版空間精度結論**。本地隔離工作樹，未發布。計畫見 [plan.md](./plan.md)。

## 固定輸入與獨立答案

| 案例 | 原始來源與操作 | 獨立答案 | 真實 MCP / Gateway / browser |
|---|---|---|---|
| N03 / A10 | TDX 嘉義市 `CYI0714_中山快捷(綠B線)B_0`，296 個座標的完整路線；COUNTY_MOI_1140318 邊界；line_intersects | Python Shapely/GEOS 對全 22 縣市逐一 intersects，僅 10020 嘉義市 | 4-step plan complete，4513ms；1 條匹配、22715 segment comparisons、2849 topology comparisons；accepted→ready r2→browser readback 2 features；截圖可見橘色完整路線及藍色市界 |
| N04 / A08 部分 | CWA replay event 115064；震央 [120.54,23.21]；直線10km學校；所屬縣市背景 | Python 獨立 Haversine：3 所（國中1、國小2）；震央位於臺南市 | 7-step plan complete，4704ms；學校分組及數量相同；accepted→ready r1→readback 4 Point features；DOM 列出1事件、3學校 |

上述毫秒只計單次工具 plan，不含模型、配對、呈現及最後答案。不是 warm p95 或完整90秒SLA。query limit 1/2只縮減回傳頁面；計算仍使用完整有界結果，N04 bbox候選12所→10km精算3所。

## 來源與解讀範圍

- TDX snapshot SHA `ea6ccd99b9e6a181654323f7d7a800569f1c2a86891fea245bbbed007b79f2a7`，530765 bytes、31路線、17038座標；TDX原始版本 unknown，公開路線形經5位小數量化，不是車輛軌跡。來源 gate 見 [line-source-gate-20260923.md](./line-source-gate-20260923.md)。
- 本次市界使用公開統計 immutable SHA `3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c`，不是人口本地原始邊界的 SHA；二者不可直接混稱同版可比較。
- 地震發生 2026-09-21T21:16:13Z（臺灣9/22 05:16:13），規模4.2、深度7.5km；震央原發布精度兩位小數，不能當建築級定位。
- RPC acquired snapshot SHA `406864d4ec20a974aacde14e2b245c3ed2d1542c645a9b6ae376c165d182d7d2`。每次 event_id 等值過濾、最多2列，不將未命中解釋成沒有事件；unknown freshness 不冒稱最新。
- 學校是目前取得的來源背景，未證明是事件當時的完整設施清單；臺南市生師比12.089401777424062為114學年（2025-08-01至2026-07-31），非地震災情，也非震央10km內比率。
- N04 尚未交付事件時點人口、完整stale/retraction runtime或fresh feed驗收，因此 A08–A09/S4 只標partial。

## 實測修復

真實多結果 bounds plan 暴露 MCP preflight 將所有 reference 換成同一暫時ID，誤觸 unique validation，直接回 generic error。改為依 step/output 保留不同 placeholder；不同reference可過、相同reference仍拒絕且不呼叫relay。修正後上表7-step真stdio成功。

線面操作拒絕無效、自相交、巢狀洞及跨180度幾何；總拓樸/segment工作量有上限。不是端點或中心點代理。實際bus reader有stream byte cap、caller abort、timeout與loading registry。

## 可重跑收據

相鄰 ignored runtime：`n03-line-plan.json`、`n03-line-plan-result.json`、`n03-independent-shapely-oracle.json`、`n03-browser-readback.json`；`n04-event-plan.json`、`n04-event-plan-result.json`、`n04-independent-school-oracle.json`、`n04-browser-readback.json`。resultId限當次paired session/TTL；重跑必須重新取得，不複用文件中的舊ID。

## 原子提交

Mini `3d51e9a7`（共用線面kernel與呈現）、`272ef3b1`（CWA bounded reader）、`f4eda599`（TDX線reader）；Gateway `3f269ef`（typed relay）；MCP `8d74d49`（line契約）、`d0f79e5`（多結果plan修復）。所有提交均留在隔離branch。


## 00:25 原始邊界重驗：取代上方公開邊界的空間分析資格

P1：同名 COUNTY_MOI_1140318 不代表相同 geometry。公開統計檔 12,986 vertices，原始檔 332,091；22/22 面不相等，最大平面 Hausdorff 約 0.001142 度（不能當公尺誤差上限）。公開統計現標 generalized/ineligible，仍可按行政代碼比較數值及呈現；不能拿它判斷點歸屬／路線跨界。Skill 同步修正。

改用原始 SHA `5044636b840fba57230f15b6728030a09f3d6dc801a86c2301052514acc684d6`，14,719,725 bytes、22 縣市、CRS84。來源比例尺分母 5000，並非地籍／法定界址精度。DEV-only mount，未發布新資料。

- N03 真實 4-step plan **2170ms**：原始嘉義市 1940 vertices，line_intersects matched 1；572005 segment / 1876952 topology comparisons。獨立 Shapely 對 22 縣市僅匹配嘉義市。accepted → ready → readback 2 features，實際截圖見完整橘色路線與原始藍色市界。
- N04 真實 7-step plan **3814ms**：CWA 115064、12 候選學校 → 10km 3 所（國中1／國小2），原始縣界 contains_center 僅臺南市，獨立 Shapely covers 一致。accepted → ready → readback 4 features，截圖見1震央與3學校。這一輪只重驗地理歸屬；上方114學年背景的來源限制仍適用，不把它說成事件時點統計。
- 學校首次分片下載 123196 bytes／5 requests，261 rows scanned；warm 0 downloaded bytes／0 requests。對整包原始來源逐列 Python bbox filter，12 筆 stable IDs **順序完全相同**。詳見 N06。
- 分片首次端到端驗收抓到 `INVALID_PARTITION_CONFIG`：本地 mount 首字 `_` 被過嚴路徑驗證拒絕。修正並增加實際 mount 負正例後重新載入及配對；失敗收據保留，不計入成功耗時。

重跑收據：`n03-raw-line-plan.json`、`n03-raw-line-result.json`、`n03-raw-browser-readback.json`、`n04-raw-event-plan.json`、`n04-raw-event-result.json`、`n04-raw-browser-readback.json`、`n03-n04-raw-independent-oracle.json`、`n06-partition-browser-oracle.json`。皆在 ignored runtime；IDs 不能跨配對重用。
