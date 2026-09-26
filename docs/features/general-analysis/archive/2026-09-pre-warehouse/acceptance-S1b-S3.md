> ⚠️ 歷史文件（已被 [PLAN-warehouse-20260926](../../PLAN-warehouse-20260926.md) 取代），只作查證，不作施工依據。

# S1b–S3 本地工程驗收

日期：2026-09-22。使用者驗收待確認；未 push、merge 或部署。核心實作已原子化 commit；後續更新見本文末。

## 成果與邊界

已打通 `Codex → built MCP stdio → Gateway → paired browser → compare_regions → result collection → ready/readback`。MCP 實際列出 50 tools。新增 typed `pulse_compare_regions`，接入 analysis plan；canonical 統計 adapter 與雙端 schema 同步支援宣告。沿用既有 local/Google geocoding、Valhalla 與 consent，不另建重複 provider。

網站新增「分析範圍與證據」及區域比較表，保留版本、時間、單位、維度、行政邊界、coverage、缺值與 stale。統計 geometry 保留原區域，不能把行政區統計分攤成半徑內統計。研究 skill 同步此流程。淡白光暈綁定網站可觀測的 working/presenting，完成或失敗停止；工具呼叫前的模型思考尚不可觀測。

S3 核心同指標比較完成，不代表全部 A04–A07 情境已做 live 驗收。A05 額外人口來源標準化目前只有契約與 fixture 驗證；尚未有獨立人口 reader 的端到端案例。事件分析、任意線面 overlay、728 個圖層全數可分析，均不在本輪完成宣告內。

## 固定考題與實際結果

| 題目 | 固定輸入及預期 | 實際／證據層級 |
|---|---|---|
| T01 周邊 | [121.5318,25.0464]，直線 2km；全來源學校與圖書館，獨立 spherical atan2 距離計算 | 42 所學校、8 間圖書館，與原始檔 oracle 一致。網站呈現含範圍／行政背景共 54 features，ready。行政背景明示為整區統計 |
| T02 鄉鎮區 | 2020 住宅總數；中山 63000040、大安 63000030，以大安為基準 | 107,888 vs 111,460 宅；差 −3,572；比例 0.9679526287457384。原始檔 oracle 一致，2 區 geometry 實際呈現 |
| T03 縣市 | 114 學年國小師生比；臺北 63000、新北 65000 | 12.053068333162585 vs 13.01270053475936 學生或幼生/教師；差 −0.959632201596774。oracle 一致，網站表格與 2 區 readback 通過 |
| T04 原生人口率 | 2025 每萬人口病床率，同兩縣市 | 107.07491308694748 vs 48.254179222815495，與目前 manifest 指向之獨立 artifact 一致。這是來源提供的率，非自行 join 人口計算 |
| T05 拒絕與缺值 | 錯單位／期別／邊界／duplicate，missing、suppressed、not_reported、零分母，錯用非人口分母 | fixture 通過；另經真實 MCP 將步行等時圈送入行政統計比較，回 `REGION_COMPARISON_REQUIRES_ADMIN_STATISTICS`，網站顯示原因且無殘留光暈 |
| T06 地址與步行 | 公開測試地址：臺北市信義區市府路1號、信義路五段7號 | 本地 TGOS exact_cache 各自定位成功。Valhalla live route 561m／439秒；5、10 分鐘等時圈呈現 2 features。10 分鐘圈內學校 0 筆與獨立 point-in-polygon 一致，不代表沒有教育服務 |
| T07 動作光暈 | 工作時四邊淡白光，完成／失敗消失，不擋點擊 | 明確標記 fixture 的實際元件預覽頁：busy 動畫、1600×900 覆蓋、pointer-events:none、完成／失敗後 0 元件，均驗證。真實網站完成／拒絕後也為 0。真實短查詢 busy 畫面未穩定截獲；reduced-motion 有 CSS，未做 OS 模擬 |

連續值以未四捨五入來源值核對；畫面顯示四位小數。T02/T03 比例皆為本區除以基準；不把比率加總，不據此推因果。

## 來源版本

- T02：`20201108-township-housing_total-2ec42db7ecf1`。
- T03：`114-elementary-student_teacher_ratio-da7390aa65cf`，2025-08-01 至 2026-07-31；county boundary `COUNTY_MOI_1140318`。來源 freshness 為 stale，畫面照實保留。
- T04：`2025-medical_institution_beds_per_10000_population-16c8eb15726e`，artifact SHA256 `729ae7d398576b6a6e3281ec0c5325bbd351d7d89be76ffc5762da0856f5560d`，9,610 bytes。artifact hash 與 runtime values receipt hash 是不同物件。
- 學校原始檔 SHA256 `7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3`；圖書館 `80425ed85d0b5efe237d315c0109efe62d7ee556418977337db380b16e5d98a5`。
- Valhalla engine `3.9.0-e8b4007`；tileset `2026-09-22T11:04:10.000Z`。屬路網模型估計，非實走計時；graph checksum／snap distance 未提供，公共 endpoint 無 SLA。
- 初輪 Google capability 回 `GOOGLE_API_KEY_NOT_CONFIGURED`；後續確認是隔離程序未載入使用者指定的 `.env`，金鑰本身可用。補驗公開地址與「台北101」皆 matched，見本文末。初輪地址結果仍明確屬本地定位。

## 檢查與耗時

| 檢查 | 結果 |
|---|---|
| Mini `npx vitest run src/research` | 42 files；218 passed，6 skipped |
| Mini `npx tsc -b` | exit 0 |
| MCP `npm test`／`npm run build` | 59 passed／exit 0 |
| Gateway `node --test services/research-gateway/*.test.mjs` | 58 passed |
| 三 repo `git diff --check` | 通過 |
| Built MCP stdio、實際 Gateway/browser | 配對、查詢、分析、呈現、readback 通過 |

合計 335 passed、6 skipped。loopback 測試曾受 sandbox EPERM 阻擋，允許 loopback 後完整重跑通過。fixture 的 Supabase 未配置警告不視為資料庫整合測試通過。

本輪周邊 14-step warm plan 10.333 秒；兩組區域比較 6-step warm plan 9.128 秒。地址初次 3.98 秒、第二地址 2.111 秒；live route 2.409 秒、isochrone 1.776 秒。這些是個別工具鏈耗時，尚非「收到問題至回答」完整 90 秒目標，亦非 20 次 p95 統計。

## 本地重現與證據位置

隔離工作根目錄為 `mini-taiwan-pulse/.worktrees/research-streamline`。下列都位於該根的 `runtime/`（ignored，本地驗收證據，沒有提交私人 cache）：

- `s3-oracle.py`、`s3-oracle.json`、`oracle-assets/`：原始檔與獨立距離 oracle。
- `s3-oracle-medical-beds.json`：原生人口率來源核對。
- `warm-plan.json`、`s3-regions-plan.json`、`s3-walk-schools-plan.json`：固定輸入。
- `s3-nearby-result.json`、`s3-regions-result.json`、`s3-regions-warm-result.json`、`s3-medical-comparison.json`：數值結果。
- `s3-walking-route.json`、`s3-walking-isochrone.json`、`s3-walk-schools-result.json`：實際 provider 與後續交叉分析。
- `s3-nearby-readback.json`、`s3-regions-readback.json`、`s3-walking-readback.json`、`s3-final-readback.json`：網站呈現證據；最後為 county comparison，2 features，sourcesReady/layersReady/ready 全 true，loading 0。
- `verify-s3.py`、`s3-verification.json`：9 項固定收據／oracle 核對。於工作根執行 `python3 runtime/verify-s3.py`；收據結果 ID 有 session 限制，換 session 必須重跑固定工具計畫並更新 ID。
- `stdio-receipts.jsonl`：完整本地 transport 收據；含測試座標，不公開發布。
- `s3-mini-tests.log`、`s3-mini-typecheck.log`：最後 Mini 測試紀錄。

網站保留四組結果：步行範圍、2km 周邊、中山／大安住宅、臺北／新北師生比。可用群組 checkbox 切換；預設顯示最後的縣市比較。光暈可另開 `/scripts/research/activity-preview.html` 驗收，其頁面明示是 fixture，非 Agent 正在工作。

## 下一步三項

1. 補 A05：接上可追溯人口 reader，實際完成服務數／人口 join，驗證年度、邊界、population scope 及缺值；不可只靠人口欄位名稱猜測。
2. 做完整 warm 問題 20 次量測：含模型、候選查找、queue、下載、分析、呈現；報 median/p95/max 和失敗率，再判斷距離 90 秒目標差距。
3. 針對量到的大檔做行政區／空間分片與版本快取，以優化前後數值、code 集合及 geometry 等價為放行条件。分類器只縮小候選，不取代來源與可比性守門。

## Google 與原子提交補驗（2026-09-22）

使用者指定原 Mini repo `.env` 中的 `GOOGLE_MAPS_API_KEY` 並授權繼續。只確認欄位存在，金鑰從 env file 載入 server process；未輸出或提交金鑰。新增明確 `PULSE_RESEARCH_ENV_FILE`，host 既有 env 優先，未設定才相容舊 `PULSE_OPENROUTER_ENV_FILE`，不自動掃 sibling 目錄。

透過 built MCP 的 `pulse_geocode_address`，各次明確 `provider:google, externalConsent:true`：

- `臺北市信義區市府路1號`：matched，1 candidate，217ms，座標在臺北測試範圍。
- `台北101`：matched，1 candidate，131ms，座標在臺北測試範圍。
- 僅保留 `runtime/s3-google-validation.json` 的成功狀態、數量及 bounds assertion；Google candidate/完整 response 不落盤。
- 新啟動驗收 MCP driver 的 capability 為 `google.configured`，local geocoder 仍 available。此設定僅覆蓋隔離驗收程序，不宣稱所有 Codex host 或 production 已套用。
- 最初受 sandbox 網路限制回 NETWORK_ERROR，取得執行網路權限後成功；未改 API 權限或 billing。
- MCP 新測試共 62 passed（原 59 + env 3），build 通過；目前跨 repo 合計 338 passed、6 skipped。

原子 commit：Mini `fa05191c` 光暈、`7eb9c745` 區域比較／證據；MCP `6bb3cfe` typed 比較、`1b7a3c8` 明確環境檔；Gateway `f34fccb` relay validation。均為本地隔離分支，尚未整合或發布。

### A05 補查結果：HOLD

公開 `statistics/v1/current.json` 對應 manifest 共 291 indicators／3,834 selectors，未找到 standalone population／resident_population／registered_population release。醫院每萬人口衍生檔只有 159/368 鄉鎮；22 縣市教育衍生檔的 denominator 依附學年指標，無獨立人口 release。不能從衍生 inputs 反推出通用 reader。

本地 analytics `data/processed/demographics/population_by_township_monthly/population_by_township_20260530.parquet` 具有 2024-12／2025-12 各 368 鄉鎮，仍需上游明確人口口徑與 R2 immutable contract。來源目錄 `docs/data-catalog/demographics/population_by_township_monthly.md` 與衍生腳本 `scripts/statistics/build_population_comparisons.py` 分別出現「現住人口」／「戶籍人口」，未以其中一個用詞直接放行。

因此本輪沒有新增繞過 R2 規則的 Supabase 統計 reader，沒有弱化 period／boundary 守門；下一步按計劃的 A05 來源關卡補齊。這是來源與方法尚未完備，不是 Google 或工具數量的限制。
