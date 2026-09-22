# 過夜通用分析進度與晨間驗收

狀態：執行中，非完成報告。截止 2026-09-23 08:00 Asia/Taipei。
計畫 SSOT：[plan.md](./plan.md) 的 N01–N07；本表隨實測更新，不以測試數取代產品完成。

| 關卡 | 狀態 | 證據／下一步 |
|---|---|---|
| N01 圖層能力 | 已完成第一輪登記盤點，review修正中 | 778 manifest layers、54 descriptors、51 layers queryable；121 GeoJSON metadata candidates仍需來源驗證，725缺descriptor不可宣稱可分析 |
| N02 人口 | 原始資料gate與local preview通過，已commit；reader待接 | 368 township、22 county、23,299,132，code/hash核對；只稱來源『行政區人口數』，不自行改稱戶籍/現住 |
| N03 線面 | 純函式5 tests通過；typed接線中 | LineString/MultiLineString與Polygon/MultiPolygon、holes、boundary與預算；還不是網站已可用 |
| N04 事件 | 候選來源實際讀回通過；context待接 | tw-news-events 是 township proxy；CWA RPC已bounded取得10筆，115064有actual震央與occurred_at，grid缺失保留 |
| N05 效能 | 20次診斷通過；正式穩定版本基線待重跑 | 固定6-step regional plan，20/20成功且row fingerprint一致；median4189ms/p954853ms/max7623ms。worker patch可能同時變更，不能當受控優化基線，不含模型思考／呈現 |
| N06 優化 | 待N05 | 先量測再選瓶頸 |
| N07 整套驗收 | 逐關進行 | 本輪工具程序重启后須重新配對，已透過網站UI恢復；單輪regional plan成功6.518秒 |

## 恢復入口

- heartbeat automation id `pulse`，每30分鐘接續本任務；截止後停用。
- 工作根 `.worktrees/research-streamline/{mini,mcp,gateway}`，runtime receipts在相鄰`runtime/`。
- 目前driver shell session `26545`，程式 `/private/tmp/pulse-streamline-driver.mjs`；重新啟動不會繼承pairing，要重新走網站UI配對。只知Google configured不代表paired。
- Frontend 3734／Gateway 8794；Gateway不存在`/health`路由，404不代表服務死亡。網路sandbox的curl connection failure也不可直接判定進程故障。
- MCP raw receipts包含公開測試資料及配對資訊，僅存runtime；勿提交.env/secret。
- 主agent ownership：plan/morning report、效能summary腳本、researchDatasets.ts最後登記、整合驗收；Terra geometry ownership詳見agent訊息，勿同檔平行改。

## 本輪 commit

- `d5f6a285`：今晚順序、驗收、執行限制及恢復計畫。
- `f501e3b9`：人口來源驗證器與22縣市local preview建置；無發布。
- 既有區域比較／光暈／Google配置的6筆提交，见 [S1b–S3驗收](./acceptance-S1b-S3.md)。

## 尚未宣稱

未部署、未push／merge；未完成全778圖層分析；未完成任意人口分母標準化；未達成完整問答90秒SLA；尚無本輪線面／事件的真實browser分析證據。

## 23:30 前檢查點

- 20-run診斷結果 `runtime/overnight-warm-baseline.json`，輸入window同名`-window.json`；summary重現：`python3 scripts/research/summarize-plan-benchmark.py --receipts ../runtime/stdio-receipts.jsonl --window ../runtime/overnight-warm-baseline-window.json --output ../runtime/overnight-warm-baseline.json`。summary會拒絕少跑／錯值／partial；生成後仍需標示本輪codeStability非受控。
- CWA probe `runtime/earthquake-replay-probe.json`；臨時只讀程式 `/private/tmp/pulse-earthquake-probe.mjs`，最多10筆並保留null。未調整DB權限、未寫DB。N04不再因『找不到static fixture』停止：可從bounded RPC snapshot固定event115064展開，但還需typed adapter與全鏈驗收。
- N03 reviewer `provider_env` 檢查跨row總工作量、invalid geometry、契約對齊；`overnight_geometry`正在補總預算後才能commit。MCP/Gateway源碼與dist版本需完成後重啟且重新pair，不可拿旧driver验证新schema。
