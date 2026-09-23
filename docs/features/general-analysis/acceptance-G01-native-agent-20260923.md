# G01 獨立 Agent native 驗收｜2026-09-23

## 執行邊界

- 固定 Mini `fa87bb03`（含 `1bb2e2e3`）、MCP `5ac9f81`，驗收期間不修改產品、不觸發HMR。
- Terra（gpt-5.6-terra / medium）獨立解自然語言題；不讀歷史答案或oracle，自行選擇native工具。主agent只負責配對UI、題目、獨立原始來源核對與畫面驗收。
- 主task與subagent的native session隔離。初次A01 preflight只get_session得到unpaired；另行為測試agent建立專用配對後才開始正式案例，設定耗時不混入解題。其他任務配對不變。
- 保存每個call完整結果（包含isError/content），不能只讀structuredContent漏掉錯誤。記錄開始、回答完成、工具耗時、呼叫數、失敗與重試；模型等待若無法拆分記unknown。
- 這是獨立子agent的native解題／泛化證據，不能冒充使用者主task 20次完整warm對話SLA。模型、上下文、題目和QA時間不同，不與先前152/218秒直接宣稱等價提升。
- 本機固定來源與既有權限；不新增paid geocoder/Jev/provider calls，不發布。全域20情境矩陣仍分成功、拒絕、澄清、unsupported、來源失敗；拒絕不能混入成功題p95。

## 案例

收據與回答位於相鄰 runtime/g01-agent-A*.json 及 -answer.md。獨立 oracle 不交給執行 agent 或 runtime。

### A01：新中心、900m、學校與護理之家

- 題目中心 `[120.65, 24.16]`，900m；原始來源獨立 Haversine 核對為學校 5、護理之家 0，與 agent 回答一致。學校是校址來源紀錄；護理僅1,611筆來源中的1,499筆upstream座標固定子集，0不代表全體機構不存在；直線距離不是步行可達性。
- 16 次 native 呼叫；未使用 batch；1 次 spatial `limit:100` 超出分析上限50，修正後成功，沒有原樣重試。dataset query limit 與 analysis page limit 是不同契約。
- `g01-agent-A01.json` 只有人工收據摘要，**不是完整原始工具回傳**。已標為 `receiptSummaries`；不能以摘要證明完整鏈。
- 先前36.171秒是資料 observedAt 差值，並非完整問答時間，已撤回；本題不進 SLA 樣本。
- DOM 曾顯示5筆結果；agent摘要回報ready，但後續截圖未取得可接受可讀性證據，視覺關卡未通過。

### A02：同中心縮至500m，中斷於分析前

- 改用自動保存完整 native 回傳。`pulse_get_session` 顯示 active，隨後 `pulse_list_results` 回報 `BROWSER_DISCONNECTED`；2次呼叫、1錯誤、0重試，即停止。
- 尚未執行500m分析，也沒有新呈現；不能拿獨立oracle的0/0冒充agent結果。
- 主agent派題至收到回覆62.726秒，包含排程與證據寫入，**不是成功問答SLA**。工具收據內起訖約13.915秒，亦不等同整題耗時。
- 瀏覽器UI已回到「已登入，可建立配對」；目前無法從既有log確認觸發原因。15:16的Supabase錯誤早於本題，不作本題斷線原因證據。

## 本片修正與未完成

- MCP `0eabbfb` 補充工具說明與repair hint：analysis/spatial limit為1–50，與dataset descriptor限制獨立；省略使用operation預設，仍分析完整materialized input。沒有題目特例或答案快取。
- MCP `npx tsc -b`、server tests 12/12通過；此新增說明尚未再次驗證native host載入。既有numeric schema重載驗收仍有效。
- A01/A02無成功整題速度樣本；A03後續取得獨立Agent整題觀測，但不等同使用者主task SLA。20warm/cold與三類視覺矩陣仍未完成。
- 無push、PR、merge、部署或新增付費provider呼叫；原checkout及其他任務配對不主動修改。


## Responsive 連線生命週期修復

- 靜態追蹤證實舊版只在 App 的桌面分支掛載 MainMapConnection；切至手機會卸載 ResearchConnection，停止 controller/responder 並清除記憶體分析。500px瀏覽器DOM也無Agent入口。這是已確認的缺陷，但沒有當時viewport紀錄可把A02斷線唯一歸因於此。
- 修復將唯一MainMapConnection移到App穩定位置；desktop/mobile/capture僅控制面板可見性。保留桌面rail入口，手機新增入口，共用open state；面板互斥、關閉鍵、深淺色與取景遮擋登記一併處理。
- 19項既有motion/activity/style-restore測試與npx tsc -b通過；這些不證明React lifecycle，另需native session/result readback。未新增DOM測試依賴或以source regex冒充行為驗證。

### A03：板橋新中心、1.1公里

- 中心 `[121.46,25.01]`、1,100m；學校7筆、護理upstream座標子集12筆，與預先獨立原始來源oracle一致。native呈現2個resultId、19features，sources/layers/ready皆true；並非全體護理機構或步行可達性。
- 原始工具回傳完整保存於 `runtime/g01-agent-A03.json`，答案另存。12次native呼叫、1次不存在resultId錯誤、修正後成功1次；未使用analysis plan。Agent承認錯誤ID不是來自receipt，而是在長輸出截斷後手填；不得將此視為可接受的ID取得方式。
- 主派題時間1790178155605、收到答案觀測1790178262616，107.011秒，含排程與證據寫入。這是Terra獨立Agent觀測，不可宣稱主task p95或90秒達標。工具並行批次內共用起訖，不能把各call相加當整題時間。
- 下一效率切片應驗證plan refs與精簡回傳摘要能避免手抄ID，保留完整raw於變數/證據檔；不是增加固定地點答案。

### Responsive native 結果

- A03完成後進行手機→桌面→Capture，三份 `runtime/g02-responsive-{mobile,desktop,capture}-native.json` 均為同一session `d1e4c90e3c1c03037ea6a0ce41592e31`、同兩個resultId、19features且ready。
- 手機override設定500×800；實際DOM因現有瀏覽器縮放為625×1000，確實小於768px breakpoint。配對與結果DOM保留，不新增查詢或重新配對。override已reset。
- 淺色面板DOM文字色rgb(17,24,39)，底色rgba(255,255,255,.96)。截圖能見兩組圖例，但截圖輸出存在裁切/縮放不一致，不能充作完整三類視覺矩陣通過。
- Capture發現動作卡仍露出後，再補uiHidden，只隱藏UI、保留連線元件；最後版本另做scope fixture回歸，與上述19筆讀回分開記錄。
- 地圖取景仍受左右面板擠壓：A03 readback safe width約158px，導致zoom11.8；ready不等於清楚好讀，面板/取景協調仍未完成。

### 最終提交版本 d86cc66d

- 補uiHidden後整頁reload的首次fixture發生pending→QUERY_EXPIRED，瀏覽器顯示已登入可建立配對；見 `runtime/g02-responsive-final-fixture.json`。未原樣重試；該測試Agent已釋放自己的session。**重載恢復問題仍開放**，不能以新配對成功掩蓋。
- 主agent另用專用新配對，在不再改source/HMR的固定版建立derived scope（中心121.46,25.01、1100m）。`runtime/g02-responsive-final-native.json` 保存完整native scope/bounds/collection/wait/readback。
- 初始、手機、回桌面、Capture皆同resultIds `analysis-scope-area-scope-muea51zq` / `analysis-scope-center-scope-muea51zq`、2features且sources/layers/ready為true；最終sessionId與初始相同。Capture DOM不含Agent動作卡/連線面板，退出後回一般地圖。
- 此fixture只證明最後版本生命週期與UI顯隱，不是新資料答案或效能樣本。最終tsc通過，code commit `d86cc66d`。viewport override已reset；保留主agent專用配對與分頁供接續，不撤銷其他任務配對。
