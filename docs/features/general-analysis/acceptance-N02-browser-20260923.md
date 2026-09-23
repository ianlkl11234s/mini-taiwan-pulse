# N02：本地人口查詢與區域比較

2026-09-23 07:58 真實 stdio MCP → Gateway → browser 通過。僅 DEV + VITE_RESEARCH_POPULATION_PREVIEW=1，固定 loopback asset，不發布、不接任意每萬人口公式。

固定問題：2025-12-31 臺北市與新北市行政區人口數差多少？

- 查詢22縣市完整materialized結果；select縮小傳回欄位，沒有漏算。
- 臺北市2,439,507、新北市4,044,831；臺北減新北=-1,605,324，比率0.603117163609555。
- 與原始368鄉鎮重新彙總所得22縣市oracle一致；最後以browser query回傳全部22縣市逐筆對原始彙總oracle完全一致，總數23,299,132（單query677ms，收據n02-population-browser-all-counties.json）。
- 3-step query→compare_regions→bounds **1770ms**；不含模型思考或畫面呈現時間。
- collection accepted→ready→map_context readback2 features，DOM「2筆分析結果已高亮」，截圖確認雙北原始邊界呈現。

artifact SHA `dceed8b079fb7949c63b368b52b062fdf622bcfbadca7265bc41a2bba72973f5`，4733 bytes。raw boundary SHA `5044636b840fba57230f15b6728030a09f3d6dc801a86c2301052514acc684d6`，14,719,725 bytes；每次由raw reader核bytes/hash/CRS，非僅注入可信字串。人口artifact傳輸有15秒deadline、abort、stream cap及loading；boundary亦有自己的有界讀取。

資料口徑只稱「行政區人口數」：原始receipt未限定戶籍或現住。日期2025-12-31、owner_only、notPublished=true與來源限制保留。每萬人口A05仍HOLD：未找到核實且期間相容的設施分子，不以學年數據或159鄉鎮的不完整率替代。

重跑：runtime `n02-population-browser-plan.json`，先重新pair；結果與readback在 `n02-population-browser-result.json`、`n02-population-browser-readback.json`。result IDs僅當次session有效。公開registry仍56 datasets，此DEV fixture不改正式能力數。

驗證：既有population/rawboundary focused8 passed/1 optional skip；新增本地transport3負例（HTML/404、oversize、預先abort）通過；tsc/build通過。未重跑未修改的MCP/Gateway套件，不把舊全套test數冒稱最後新增tests已包含。

原子提交：`18403c36`；無push／merge／部署。
