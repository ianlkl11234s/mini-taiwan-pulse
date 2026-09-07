# 基礎整理第一批：本地實作與驗證

2026-09-07。**第一批已原子化提交；未合併、部署或套用資料庫 migration。整體 B0–B5 尚未完成。**

起點為最新整合主線 `9cf23f9a92eeb5300c654a2fe0e0bfd79d7ac2d1`（含日本警察設施 PR #224）。實作在 `/private/tmp/mtp-infrastructure-20260907`，分支 `codex/infrastructure-foundation-20260907`。原工作目錄內其他任務的修改保留。本報告另存原專案 docs；最終程式碼以本分支 Git commits 為準。原專案保存的前輪 patch 僅為當時快照，不是最終版。

## 本批改變

1. **地圖監聽器依 map instance 管理。** 同一張 map 換 style 不再重複綁定相機、縮放與設施點選事件，也不重複初始化 session。idle 與 4 秒保底只完成一次，map 移除會清 timer/listener。原點選 popup 欄位與 privacy ref 判定保留。
2. **H3 樣式調整不重建資料。** 五類人口/統計 factory 依 map、資料參照與數值參數快取 GeoJSON；透明度、高度等 paint 變更不再掃描 cells 或 setData。資料/指標/contrast 改變仍更新。快取依賴目前 loader 的 immutable 資料參照約定，未新增資料抽稀。
3. **補上換底圖的格網回填。** Browser 發現 style 更換後 source 雖重建卻空白。grid hosts 現在在 style.load 重新套用同一份資料與顯示參數，cleanup 移除訂閱，涵蓋 People 五格網與 YouBike host。
4. **Monitor/Intel 的指定讀取流程有明確狀態。** 新聞列表每 60 秒刷新；pressure、market、alert summary 分辨 ready/error/denied。相同 query 失敗保留最後成功資料與時間；有效空結果清除舊項目，換日期/篩選不沿用舊範圍。拒絕存取清空資料。新聞保留 Supabase error code；power generation 收到 denied 也清掉舊 plants。
5. **指定 polling 不重疊。** 一次請求完成才排下一輪，換 query 的慢回應不能覆蓋新範圍；關閉/卸載後不再排下一輪。這是上述流程的生命週期處理，未宣稱已統一所有 Monitor 卡片或完成全站取消/退避機制。

## 驗證結果

- `npx tsc -b`：exit 0。
- `npm test -- --run`：**139 files passed；1,244 passed、3 skipped**。其中日本警察 hook/面板原有 8 項測試通過。見 [tests.log](tests.log)。
- 完整 `npm run build`：exit 0（含 `tsc -b`、public 資產複製與 production bundle）；仍有既有大型 chunk warning。前輪 `publicDir:false` 編譯檢查也曾通過，本轮補完完整命令。這仍不是正式部署讀回。見 [build.log](build.log)。
- 基線：131 files、1,213 passed、3 skipped；archive 起初因缺 Git index 使 deployContract 的 17 tests 失敗，補回來源 tracked-file index 後該 suite 17/17 通過，並非產品 bug。
- 新增回歸包含 20 次 style-ready 不累積 listeners、map 移除/timer cleanup、paint-only 不讀 cells、不 setData、source 替換回填、style.load 五份 grid 恢復、失敗保留/成功空值清理/denied 清理、query race、polling timer、行情 stale 標示。
- Polling 使用 fake-timer + React hook lifecycle harness（deps/effect/cleanup 模擬）；**不是 jsdom 或真 React renderer 測試**。市場狀態另有 return-tree 文案測試。
- 本地 browser（Codex in-app browser，1280×720）：五個 People 圖層同開有格網；修正後 Dark→Light→Dark/Light 的可見格網能恢復。Monitor 能開啟，新聞由「讀取中」到「LIVE 9 則」，行情可載入。這是短程功能 smoke；沒有進行真瀏覽器斷網注入、完整 rendering-ID 比對或 2/8 小時長跑。
- `git diff --check` 通過。前輪 patch 曾對精確 baseline apply-check 通過；此次最終修正與測試改以分組 commits 保存，不重複追蹤 patch/檔案雜湊副本。

## 同資料效能比較

使用實際完整 res8 JSON，比較基線與修改版產出的全份 GeoJSON SHA-256，再連續改 10 次透明度。四份 geometry、數值與輸出順序 hash 相同。總 setData 包含最初載入；額外 10 次透明度更新由 10 次 setData 降為 0。

| 資料 | cells | 含首次載入 setData | 10 次透明度 CPU 時間 | 輸出 hash |
|---|---:|---:|---:|---|
| population | 56,376 | 11 → 1 | 1055.20 → 0.041 ms | 相同 |
| demographics | 56,217 | 11 → 1 | 838.49 → 0.052 ms | 相同 |
| socioeconomic | 56,436 | 11 → 1 | 878.30 → 0.108 ms | 相同 |
| spatial | 47,512 | 11 → 1 | 719.72 → 0.115 ms | 相同 |

這是 **Node/mock-map CPU 比較，不是實際 GPU 或 FPS**，不能把這個比例推廣為整站快幾倍。原始數據含 input/output hash：[h3-benchmark.json](h3-benchmark.json)。沒有調低 minzoom、刪減 points、修改日本警察資產、manifest 或顯示標準。

重跑方式（baseline 需有相同依賴，H3 目錄含四份 res8 檔）：

```sh
MTP_BASELINE_DIR=/path/to/exact-baseline \
MTP_H3_DIR=/path/to/public/h3 \
node --import tsx docs/audit/infrastructure-2026-09-07-batch1/h3-benchmark.ts
```

## 權限與下一批

[權限來源盤點](security-inventory.md) 發現 gis-platform Portal 的 `/api/data`、`/api/distinct`、`/api/rpc` 存在無 end-user auth 的 service-role proxy 路徑；若公開可达且無外部保護，必須優先處理。**目前只確認程式碼，沒有證明正式環境可被匿名存取，也沒有查正式 ACL/RLS 或讀取敏感資料。** Portal 是私人管理工具或面向一般使用者、是否已有外層保護，仍待確認。

階段狀態：

- B0 部分完成：主線、測試/build、H3 比較基線；部署 SHA、硬體與 browser profiler 指標尚未驗收。
- B1 來源盤點完成，Portal 改造、角色矩陣、正式 ACL/Storage 與身份快取隔離待做。
- B2 部分完成：上述新聞/警報摘要/壓力/行情與 power denied；其餘卡片、全域 freshness/observedAt、logout 同步清理、bounded retry/abort 待做。
- B3 部分完成：listener、H3 paint、grid style lifetime；Three.js repaint scheduler、相機更新隔離、衛星 CPU workload 待做。最新主線已用 lazyAgent，未重做舊審計的靜態 AI import 問題。
- B4/B5 待做：Supabase/S3/R2 故障/發布/負載測試、collector replay、2h/8h 多圖層 Monitor、正式發布讀回。尚無可承诺的同時使用人數、frame p95 或記憶體上限。

## 整合與回復

本批實作以四個互相可區分的程式碼 commits 加一個證據文件 commit 保存，可逐檔 review；原本 dirty checkout 未套入這些程式碼修改。正式整合前必須再對當時主線解衝突並重跑受影響驗收。未修改資料/DB，因此本地放棄分支不需要資料回復；正式發布後以前一個已驗證 frontend build 回復。後續安全變更不得回退到已知公開高權限路徑。


## 本次追加驗收與原子 commits

- 地圖事件：`29fd8d4` — map instance listeners / cleanup 與回歸測試。
- H3 效能：`97f9e73` — 同一資料的 paint-only 更新重用 GeoJSON。
- 格網重建：`2667f95` — style.load 回填，測試擴為連續 20 次重建。
- Monitor：`60ade04` — 中斷保留、拒絕清理、狀態提示與完整依賴流程一起提交，避免 loader 契約與 consumer 分離造成中間版失效。
- hook lifecycle harness 增加 480 次模擬刷新，timer 維持 1 個、關閉後為 0；另測 pending request 卸載、舊 query 不套到新範圍、新 query 能成功接續。這是加速模擬，不是 8 小時實機長跑。
- 補缺值防線：pressure 的 null/空白 composite 不再通過 Number() 轉成有效 0；真實 0 與有效數字仍可讀取。
- 完整 `npm run build`（含 tsc 與 public 資產複製）通過，dist 約 528 MB；包含此 worktree 可用的 public 資產，不代表正式環境所有未入版控的大型產物齊全。未對正式站施壓或發布。

- 真實 React.StrictMode browser smoke（合成資料）已驗：success → error 保留舊值 → recovery → denied 清空 → 新 query 取得新值 → 停用再啟用無背景查詢累積。紀錄：[react-acceptance.json](react-acceptance.json)。用 dev server 開 `/docs/audit/infrastructure-2026-09-07-batch1/react-acceptance.html` 可重跑；此頁不連接正式查詢，只測 hook 真實 React 行為。
- Intel「全部」分頁與新聞分頁皆顯示中斷/受限訊息；Monitor 非 ready 新聞 badge 不再使用綠色脈動 LIVE 樣式，均有回歸測試。
