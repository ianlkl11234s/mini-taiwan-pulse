> 2026-09-06 續作：以下為批次 0 的歷史證據；最新會員／搜尋／Embed／DB 狀態請看 [批次 1–2 驗收](batch-1-2-validation.md)。

# 本輪驗收紀錄

日期：2026-09-06（UTC+8）。基準 `44f85e6`，分支 `codex/project-foundation-member-audit-20260906`。本輪修改未提交／未部署。

## Code 與測試

| 範圍 | 結果 | 限制 |
|---|---|---|
| G0 人口與截斷語意 | 24 tests passed | fixture 驗證，未用真實 BYOK 模型生成回答 |
| AI lazy engine | 4 tests passed | mock 引擎：首次呼叫才 import、參數轉送、載入中 abort、固定錯誤 |
| 全套回歸（G0 階段） | 111 files passed；1,109 passed、3 skipped | 執行於 lazy adapter 加入前；adapter 後跑上述 28 focused tests |
| TypeScript | `npx tsc -b` exit 0（含 lazy adapter） | 使用既有 node_modules，非乾淨安裝 |
| 整合 focused | 2 files、28 tests passed | 2026-09-06 02:22 UTC+8 |
| Diff hygiene | `git diff --check` 通過 | 沒有 commit／push |

三個正式 skipped tests 為缺少 worktree 的 ignored runtime assets：embed `public/static-rpc`、NoiseCapture 與 noise control 資產。另有測試對不存在的大型 PMTiles 採條件略過 assertion；因此測試數字不等於完整資產上架驗收。worktree 的 sibling repo 與 node_modules 使用本機既有目錄 symlink，原工作目錄未做清理或 reset。

## 打包前後

同一 Vite 設定，production mode、`publicDir=false`；計算每個 entry 的 transitive static JS dependency closure。gzip 為逐檔計算後加總。原始數據：[before](build-profile-before.json)、[after](build-profile.json)。

| entry | before JS bytes | after JS bytes | before gzip | after gzip | gzip 變化 |
|---|---:|---:|---:|---:|---:|
| main | 6,034,841 | 5,367,997 | 1,624,603 | 1,454,738 | −169,865 bytes（−10.46%） |
| embed | 4,960,278 | 4,960,250 | 1,317,166 | 1,317,217 | +51 bytes（hash／打包微差） |
| bbox | 1,902,973 | 1,902,973 | 532,905 | 532,905 | 0 |

before build 8.05 秒、after 8.76 秒，兩次 exit 0；不是可比較的整體 build speed benchmark。改動後三個 entry 的靜態依賴閉包均不含 `ai/dist/index.js` 或 `@ai-sdk/*`，主站 AI 引擎改由 dynamic import 引入。AI 實際使用時仍需下載其 chunk，總功能成本沒有消失。

保留 ChatPanel 掛載，不以關閉面板卸載草稿或正在執行的對話。新增載入失敗中文訊息、loadingRegistry 與 abort 行為。Embed 的 Mapbox／Three 問題仍存在，此次沒有修改 renderer adapter。

## Supabase

metadata-only session 確認 `read_only=on`，最終輸出 errors 為空。受限環境第一次連線失敗；允許網路後完成相同唯讀查詢。未讀使用者列、沒有寫入或 migration apply。

結果檔涵蓋指定 public 表名、欄位、RLS flags／policy 摘要、table grants、索引及函式名稱；另查 DB size、top 10 relation size、queryid／calls／mean_exec_time、24 小時 cron status 聚合。未查 SQL 本文或排程命令。這證明物件存在與 metadata 狀態，沒有證明兩帳號 RLS runtime 隔離、profile trigger 實際 signup 或每支 RPC 的 p95。

## Production browser 唯讀觀察

使用 Codex in-app browser 開啟主站公開 URL。初始 loading 完成，地圖 state 顯示台北中心、z12.5；公開側欄與 Google 登入入口存在。開啟 Intel 後可見新聞／警報／全球情勢 tab 與事件項目。沒有登入、會員寫入、capture 上傳或修改發布內容。

本次 Intel 在未先啟用地圖 Global Events 圖層時已有全球情勢列表，因此舊的「情報必須依賴已啟用圖層」限制不應再當成尚待修正事項。

觀察到兩組需要後續驗證的產品品質線索：

- 面板標頭「共 1 則」與不同 tab 的計數並列，需釐清各自時間窗／資料來源／去重口徑並改善標籤。不能把各 tab 數字直接相加當 bug 修正。
- 部分事件文字提及的地點與列表地理標籤不一致，例如底特律相關事件旁出現 Spain。這是 UI 一致性觀察，未查原始事件／定位血緣，因此不擅自重設座標，也不把這些新聞敘述當經查證事實。須在用作周邊分析前完成位置資格審核。

本環境 browser evaluate 未提供 Performance API，故未取得可信的 LCP／INP／FPS、network timing 或 heap。沒有實測手機、Monitor 長時間運作、Capture 輸出、模型供應商連線或新程式的 production 行為。

## 本機 build browser smoke

使用 `vite preview` 於 127.0.0.1:4187 開啟本次 after build。地圖 loading 完成；AI 面板可開啟，未設定 key 時送出正確 disabled；設定頁的 provider／model／key 控件可見；面板可關閉並重新開啟。沒有填入或送出 API key。引擎首度呼叫、失敗與 abort 已由 focused mocks 驗證，供應商端到端仍未驗。檢查後停止本輪 preview process。

## 發佈前仍需完成

- 使用有額度的 BYOK 設定補供應商端到端驗證；不得輸出金鑰。首度引擎載入／網路失敗／取消的 browser 整合仍需補證，現有證據為 build dependency 檢查與 mock 測試。
- 完整 public 資產與 CDN URL／cache／壓縮驗收；本輪 build 明確略過 public 複製。
- 新會員功能在獨立批次實作後，做兩帳號、跨裝置、失效 session、同步衝突、配額及 RLS 寫入／讀回驗收。
- 發佈後再做 production browser；本輪沒有發佈。
