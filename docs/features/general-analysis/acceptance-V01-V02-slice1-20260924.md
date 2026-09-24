# V01／V02 首片實作與驗收

> 最新狀態入口：[能力與邊界審查](./capability-review-20260924.md)。MCP 新 predicate/bindings 已於 2026-09-24 native 確認；下列舊 host gate 是歷史紀錄，不需據此再次重載。

2026-09-24。使用者已授權首片；沿 research-streamline 隔離 mini/mcp/gateway。本片本地提交，未 push、PR、merge、部署或擴大 provider 呼叫。V01/V02 仍 in_progress。

## 已完成

- Mini：恢復 effect 改依登入 user ID，避免同使用者 session/token object 更新取消進行中的恢復；取消未完成嘗試可重入，卸載後舊 auth callback 不回寫。保持 Gateway active、owner 與 Web Locks 驗證。
- MCP：plan 回傳依 step ID 索引的 root bindings，只收 complete/ok 結果；超過輸出預算的已完成步驟不再被 nextStep 指回重跑，pending 不產生 binding。server schema／說明同步。
- [11 個來源 qualification](./qualification-V02-20260924.md)：只確認既有契約與缺口，沒有新增 reader，沒有將未知授權或 generalized geometry 提升資格。

程式原子commit：Mini `0ab31444`；MCP `79c340c`。Gateway未修改。

## 測試與全鏈證據

- Mini focused tests 7/7；新增 token-refresh 競態測試在舊 HEAD 失敗、修正版通過；撤銷負例維持拒絕。`npx tsc -b` 通過。
- MCP plan/server tests 20/20、typecheck／`npx tsc -b` 通過；涵蓋 bindings、completed output budget、pending/partial。新版 root bindings 尚未經目前 Codex host 載入，不能把以下 native 舊 host 證據當成新版 MCP 驗收。
- 整頁 reload 後，原 session `4ded695fe6a709278e55dd62c8fec295`／study `940dde46db8d6ba07937fd610047642f` 仍連線，native map_context complete，後續 queries 可執行；沒有重新配對或撤銷其他 task。
- 全頁 reload 的記憶體結果不保證存活。回讀當時 overlay 為空，沒有假稱舊 resultIds 仍存在；恢復配對與恢復分析內容是不同能力。

| 變體 | 中心／直線半徑 | 學校／護理來源紀錄 | 證據 |
|---|---|---|---|
| A 高雄參數變體 | 120.302,22.639／850m | 3／2 | native plan 與完整來源 Haversine oracle 一致；非全新城市、不列新地點視覺驗收 |
| B 宜蘭 | 121.75,24.75／650m | 4／5 | native plan、獨立 oracle 一致；面板收起後 command r13 ready，9 features/source/layers ready，CUA可見 |
| C 花蓮 | 121.603,23.98／700m | 3／1 | native plan、獨立 oracle 一致；r11 ready，4 features/source/layers ready，CUA可見 |

每題以一個 plan 串 query×2、spatial_query×2、bounds；相依用 refs，不手填 resultId。兩個 descriptor 同一批讀取後重用。查詢沒有參數錯誤或分析重試。source SHA 分別是學校 `7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3`、護理 `775bc1a88a5e8675e48ed7930645a5e7df505968c0821ed080843e7e75bef3d9`。護理僅 upstream_wgs84/upstream 的1499/1611子集；時間unknown，數量不是容量、獨立機構數或步行服務量。

原始 evidence（相鄰 runtime，不提交）：`v01-native-20260924.json`、`v01-native-closed-panel-20260924.json`、`v01-oracle-20260924.json`。raw工具收據由回傳物件直接保存，oracle另讀完整來源，不由runtime讀取。這是主agent native整合驗證，不是獨立Agent未見措辭題組或20warm對話SLA；不報完整問答速度通過。

## 未完成與下一片

1. G02：B面板展開時r10/r12 command error，但9features overlay ready。r10與暫換舊source的回歸測試/HMR重疊；固定source後r12仍失敗，因此不能只歸因HMR。收面板後r13 ready；下一片重現並修framing/layout穩定性，不能以重送或關面板代替修正。
2. 新MCP bindings：需 host 載入新版本後再跑 native contract；本輪未重啟Codex或影響他人配對。pending/partial目前是本地測試證據，沒有製造live故障冒充全鏈。
3. Reload：已有活躍session正例與本地撤銷負例；實際expiry/revoke/多分頁矩陣尚未做完。無暫存結果自動持久化承諾。
4. V02：11候選表完成，但三種資料路徑的新native正例尚未交付；本片兩地仍是既有Point來源。Line/Polygon依資格和預算再接，不先開buffer/intersection。
5. G01 20warm整題SLA、措辭泛化、G02深淺/寬窄/互動全矩陣與使用者主觀驗收仍未完成。下一片先解取景回報，接著新版MCP native與來源代表路徑。
