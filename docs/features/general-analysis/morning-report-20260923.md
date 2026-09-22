# 過夜通用分析進度與晨間驗收

狀態：執行中，非完成報告。截止 2026-09-23 08:00 Asia/Taipei。
計畫 SSOT：[plan.md](./plan.md) 的 N01–N07；本表隨實測更新，不以測試數取代產品完成。

| 關卡 | 狀態 | 證據／下一步 |
|---|---|---|
| N01 圖層能力 | 登記盤點完成 | 778 manifest layers、56 descriptors、53 layers queryable；121 GeoJSON metadata candidates仍需來源驗證，723缺descriptor不可宣稱可分析 |
| N02 人口 | 原始gate、local preview及materializer通過；未公開接線 | 368 township、22 county、23,299,132，code/hash核對；只稱來源『行政區人口數』，不自行改稱戶籍/現住 |
| N03 線面 | bounded真實網站案例通過 | 嘉義TDX完整路線×市界，Shapely oracle一致；ready＋readback＋截圖通過，見acceptance-N03-N04.md |
| N04 事件 | 歷史背景案例通過，完整S4仍partial | CWA115064＋10km學校3所（國中1/國小2）＋臺南市背景，全鏈4704ms；人口／fresh feed待補 |
| N05 效能 | 固定版本20 warm通過 | 6-step regional plan，20/20成功且row fingerprint一致；median4399.5ms/p955625ms/max5740ms。首次housing來源load12285ms另列；不含模型思考／呈現 |
| N06 優化 | 待N05 | 先量測再選瓶頸 |
| N07 整套驗收 | 逐關進行 | 本輪工具程序重启后須重新配對，已透過網站UI恢復；單輪regional plan成功6.518秒 |

## 恢復入口

- heartbeat automation id `pulse`，每30分鐘接續本任務；截止後停用。
- 工作根 `.worktrees/research-streamline/{mini,mcp,gateway}`，runtime receipts在相鄰`runtime/`。
- 目前driver shell session `83031`，程式 `/private/tmp/pulse-streamline-driver.mjs`；重新啟動不會繼承pairing，要重新走網站UI配對。只知Google configured不代表paired。
- Frontend 3734／Gateway 8794；Gateway不存在`/health`路由，404不代表服務死亡。網路sandbox的curl connection failure也不可直接判定進程故障。
- MCP raw receipts包含公開測試資料及配對資訊，僅存runtime；勿提交.env/secret。
- 主agent ownership：plan/morning report、效能summary腳本、researchDatasets.ts最後登記、整合驗收；Terra geometry ownership詳見agent訊息，勿同檔平行改。

## 本輪 commit

- `d5f6a285`：今晚順序、驗收、執行限制及恢復計畫。
- `f501e3b9`：人口來源驗證器與22縣市local preview建置；無發布。
- 既有區域比較／光暈／Google配置的6筆提交，见 [S1b–S3驗收](./acceptance-S1b-S3.md)。

## 尚未宣稱

未部署、未push／merge；未完成全778圖層分析；未完成任意人口分母標準化；未達成完整問答90秒SLA；線面與事件已取得本地browser證據；尚未驗收任意線／事件來源。

## 23:30 前檢查點

- 20-run診斷結果 `runtime/overnight-warm-baseline.json`，輸入window同名`-window.json`；summary重現：`python3 scripts/research/summarize-plan-benchmark.py --receipts ../runtime/stdio-receipts.jsonl --window ../runtime/overnight-warm-baseline-window.json --output ../runtime/overnight-warm-baseline.json`。summary會拒絕少跑／錯值／partial；生成後仍需標示本輪codeStability非受控。
- CWA probe `runtime/earthquake-replay-probe.json`；臨時只讀程式 `/private/tmp/pulse-earthquake-probe.mjs`，最多10筆並保留null。未調整DB權限、未寫DB。N04不再因『找不到static fixture』停止：可從bounded RPC snapshot固定event115064展開，但還需typed adapter與全鏈驗收。
- N03 reviewer `provider_env` 檢查跨row總工作量、invalid geometry、契約對齊；`overnight_geometry`正在補總預算後才能commit。MCP/Gateway源碼與dist版本需完成後重啟且重新pair，不可拿旧driver验证新schema。

## 00:00 檢查點（2026-09-23）

- N03/N04 完整證據見 [acceptance-N03-N04.md](./acceptance-N03-N04.md)。Mini `3d51e9a7`、`272ef3b1`、`f4eda599`；Gateway `3f269ef`；MCP `8d74d49`、`d0f79e5`。
- 修掉plan多result reference preflight撞ID的P1；修掉query_records動作紀錄把資料筆數叫候選圖層，Mini `41bc0c7b`。
- 人口materializer `fb876e87`；實際local artifact再驗hash/code/22區，23,299,132；雙北2439507／4044831，差-1605324。local node materialization 93ms，不是browser或傳輸時間。來源未知license維持local-only；沒有找到已核實的2025全年縣市服務設施分子，不能假稱A05完成。
- `n05-warm-window.json`明列固定runtime commits及首輪prewarm；`n05-warm-benchmark.json`20 warm，所有失敗均納入。另保留含首次load的20-run `n05-stable-benchmark.json`，不刪較慢結果。
- Mini全套1850pass/10skip（人口最後負例及activity修正另有focused通過）；MCP64pass；Gateway59pass。MCP初次sandbox loopback EPERM，允許本機網路後64/64通過，非程式回歸。
- 當前driver83031，新session fbb1389fa62138e8919f426b370e1b19；frontend3734、gateway8794。配對及results隨session/TTL過期，續測先get_session，不硬用舊resultIds。
- 下一片N06：既有學校來源首次2,504,719 bytes整包；Terra正評估generic spatial partition pushdown，尚未改runtime。原始checkout dirty files未動。
