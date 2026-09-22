# N03 線面與 N04 事件交叉驗收

2026-09-22 本地隔離工作樹，未發布。計畫見 [plan.md](./plan.md)。

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
