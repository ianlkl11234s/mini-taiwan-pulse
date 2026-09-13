# 圖層與資料能力盤點

日期：2026-09-11。靜態程式碼盤點，不是生產資料健康或授權驗證。

- [完整476個圖層key](layers.md)：人讀表格。
- [結構化清單](layer-inventory.json)：含key、label、來源登記、程式行號、recipe/selector metadata、snapshot hashes。
- [資料adapter家族](data-adapter-families.md)：代表性實作、時間／geometry／grain與既有chat工具。
- [外部專案工具](external-tools-review.md)：固定SHA的WorldMonitor與monolith-terrain。
- [通用tools提案](../tool-foundation-plan.md)：含新聞／消息面板、18個既有research工具與未來組合。

## 計數方法

TypeScript AST取452個manifest顯式項目，補上agriStatisticsRecipes.json中24個enabled recipes（layerManifest.ts:322 factory與:342 spread），共476個唯一key，與LayerVisibility清單吻合。466個有catalog引用、10個未分組／orphan；catalog引用不等於實際畫面可用或授權開放。

有效manifest dataClass：A=129、B=90、C=52、D=205。D包含統計、自接WebGL與其他custom sources，不能把205個D層稱成205個3D層。Statistics registry的26個role keys另列在JSON，是重疊索引，不再加進476。

geometry若未從loader/contract確認，仍為未知；並未逐一下載476個圖層驗證geometry、coverage或license。layer manifest的upstream verified是登記值，部分note可能同時指出HOLD或LICENSE_UNVERIFIED，不能只看status通過。

原repo HEAD與research baseline的顯式manifest key set相同；原repo工作檔另有未提交差異，另列補充，未修改或提交原repo任何檔案。

- [原工作目錄新增20層與差異](layer-original-diff.md)：496個key快照，與research分支分開。
- [新聞／消息／警報RPC清單](message-rpc-inventory.json)：29處呼叫、28個唯一RPC名稱，非28個MCP tools。
