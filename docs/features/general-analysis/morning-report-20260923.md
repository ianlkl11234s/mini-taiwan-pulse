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
| N06 優化 | schools local全鏈通過 | 首次bytes2504719→123196（-95.08%）；warm0下載；12IDs與原始來源逐列完全一致，見acceptance-N06-20260923 |
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


## 00:30 檢查點（優先於上方歷史狀態）

- P1：公開統計邊界與同版本名 raw geometry 不同，22/22不相等。公開統計現在 generalized/ineligible，數值比較與展示保留；精確點歸屬／線面交叉改用已驗SHA原始縣界。26c68718、1d47968f，Skill同步。原始面比例尺1:5000，不冒稱地籍精度。
- N03 raw重新實測2170ms，Shapely22縣僅嘉義市；2 features ready/readback＋截圖。N04 raw＋分片7-step3814ms，事件位臺南市、3學校，4 features ready/readback＋截圖。新證據取代舊簡化面空間資格，不取代時間／來源限制。
- N06：82 content-addressed shards，4 shards+manifest實下載123196 bytes／261候選，再精篩12筆；原始2,504,719 bytes／4315 rows。Python逐列12 IDs完全一致。warm query577ms、0 downloadedBytes、0 requests。完整鏈曾抓到本地底線路徑拒絕，dcdf8306修正後重新配對通過。
- 新原子commit：26c68718 boundary role、1d47968f raw reader、653e6a2c partition builder、441336ec bounded loader、dcdf8306 localpath regression、2c0553a1 opt-in DEV接線。
- Mini目前全套1868 passed／11 skipped；補最後localpathfocused16 passed；npx tsc -b通過；npm run build通過（既有大chunk警告）。MCP64／Gateway59前輪通過且此片未變，未無故重跑。
- 前端PID59293，3734；Gateway8794沿用。DEV flags VITE_RESEARCH_POINT_PARTITIONS=1、VITE_RESEARCH_RAW_BOUNDARIES=1。重啟工具 /private/tmp/pulse-streamline-restart-vite.mjs 只重啟本輪Vite。driver83031仍存活，get_session後再用；reload/HMR可能需重新pair，禁止重用舊結果。
- 下一片：N02 standalone人口DEV-only browser接線仍未做；每萬人口A05因無合格同期分子保持HOLD。N07新20次warm與數值比較展示待完成；N01 metadata候選不得稱來源已驗證。8am截止與heartbeat停用規則不變。


## 07:46 恢復檢查點

- 00:30後subagent曾因用量限制中斷；不把heartbeat訊息視為有完成工作。人口browser接線仍未完成，A05同期分子仍HOLD。
- N07已完成的20-run收據現確認20/20通過、fingerprint一致：median4186ms／p956534ms／max7864ms。不是完整問答時間。版本與窗口見performance-N05。
- 原checkout仍只有既有5個dirty paths，未混入commit；本地Vite59293、Gateway93890皆存活。driver83031仍可get_session；結果TTL需重新查。
- 新待修查核：partition取消只終止caller等待，底層共享fetch可繼續至自身timeout。正在以subscriber reference counting補最後caller離開即abort，同時保留其他caller；未測完前不宣稱完整取消驗收。

- 07:48 fresh regional 6-step7923ms，兩區住宅／雙北生師比數值oracle一致；雙北比較result accepted→ready→browser readback2 features，DOM與截圖確認面仍可展示。這不重新授予generalized面空間運算資格。收據 n07-regional-live-result.json / n07-regional-browser-readback.json。
