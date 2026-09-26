# 分析框架：題型、陷阱、信心詞彙

2026-09-26 整理，來源列於文末。只在需要判斷方法或措辭時讀。

## 題型 → 軸 → 最小方法 → 必帶但書

| 題型 | 軸 | 最小方法鏈 | 必帶但書／陷阱 |
|---|---|---|---|
| 周邊有什麼 | 空間 | 環域＋疊合（相交） | 直線環域高估可達性；半徑要說明依據 |
| 多點比較 | 空間 | 各點同半徑環域＋分區統計 | 腹地不同時計數失真，需標準化；只比共同涵蓋的資料 |
| 熱點／集中 | 空間＋關聯 | 全域 Moran's I 確認有聚集 → Getis-Ord Gi* 定位 | 目視密度 ≠ 統計顯著；權重矩陣與格子大小會改變結果 |
| 兩變數相關 | 關聯 | 同單位彙總＋散佈／雙變量地圖 | 區域相關 ≠ 個體（生態謬誤）；換分區可能反轉（MAUP、辛普森悖論） |
| 事件周邊篩查 | 空間 | 環域＋空間 join | 圓形環域忽略路網與地形阻隔 |
| 路線沿線 | 空間 | 線環域或路網服務範圍 | 歐氏距離高估；路線長度要標準化 |
| 區域排名 | 空間＋關聯 | 分區統計＋人均／每單位面積 | 原始計數排名等於人口圖；換尺度排名會變 |
| 前後變化 | 因果 | 差異中的差異（找對照區） | 無對照只是相關；要檢查處理前走勢平行 |
| 異常 | 關聯＋空間 | 局部 Moran's I（LISA） | 異常只代表跟鄰居不像，先排除資料品質問題 |
| 選址 | 空間 | 加權疊合＋到需求／競爭者距離 | 權重主觀；人口只是需求代理 |
| 為什麼（歸因） | 因果 | 競爭假說分析（ACH）＋關鍵假設檢查 | 先排除空間混淆；結論用信心詞彙 |
| 活動模式 | 空間＋關聯 | 時空模式（pattern-of-life）／連結分析 | 樣本代表性與資料缺口易被誤判為「模式改變」 |

## 判斷規則

**空間**
- 「附近／多遠」先確定是直線還是路網；兩者可能差很多。
- 跨區比較先標準化（人均、每平方公里），否則是在畫人口分佈。
- 換分區單位結果可能反轉，結論寫明尺度。
- 研究範圍邊緣會切掉鄰近效應，邊界旁可能低估。
- 說「熱點」之前要有顯著性檢定；只有密度排名就說「相對集中」。

**關聯**
- 兩者同升同降，先找同時驅動兩者的第三變數（都市化、人口、面積）。
- 區域尺度的相關不能推到個人。
- 全域自相關只說明「整體有聚集」，不說明「哪裡」。
- 共現只代表關係存在，不代表方向或機制。

**因果**
- 「A 多 B 也多」先問第三變數（經典反例：鸛鳥數與出生數都受地區大小影響）。
- 空間資料特別注意空間混淆：平滑分布的未觀測因素會同時影響處理與結果。
- 前後比較要有對照並檢查平行趨勢；鄰近區可能受外溢影響，不適合當對照。
- Bradford Hill 九項（強度、一致性、特異性、時序、劑量反應、合理性、連貫性、實驗、類比）是檢查角度，不是充要條件。

## 信心詞彙（參考 ICD 203）

| 說法 | 大約機率 |
|---|---|
| 幾乎確定 | 95–99% |
| 很可能 | 80–95% |
| 可能 | 55–80% |
| 機率差不多 | 45–55% |
| 不太可能 | 20–45% |
| 很不可能 | 5–20% |

「可能性」和「對證據的信心」分開講：例如「很可能如此（中等信心：資料只涵蓋雙北）」。

## 來源

- Esri：Spatial analysis in ArcGIS Pro <https://pro.arcgis.com/en/pro-app/latest/help/analysis/introduction/spatial-analysis-in-arcgis-pro.htm>；The Power of Where <https://www.esri.com/arcgis-blog/products/product/analytics/the-power-of-where-how-spatial-analysis-leads-to-insight>；Proximity analysis <https://desktop.arcgis.com/en/arcmap/latest/analyze/commonly-used-tools/proximity-analysis.htm>
- Moran's I <https://pro.arcgis.com/en/pro-app/latest/tool-reference/spatial-statistics/h-how-spatial-autocorrelation-moran-s-i-spatial-st.htm>；Getis-Ord Gi* <https://pro.arcgis.com/en/pro-app/3.4/tool-reference/spatial-statistics/hot-spot-analysis.htm>
- MAUP <https://en.wikipedia.org/wiki/Modifiable_areal_unit_problem>；Boundary effect <https://support.esri.com/en-us/gis-dictionary/boundary-effect>；A Geographical Perspective on Simpson's Paradox <https://josis.org/index.php/josis/article/view/212>；Normalize choropleth data <https://handsondataviz.org/normalize-choropleth.html>
- ACH <https://en.wikipedia.org/wiki/Analysis_of_competing_hypotheses>；Pattern-of-life <https://en.wikipedia.org/wiki/Pattern-of-life_analysis>；Indicator analysis <https://en.wikipedia.org/wiki/Indicator_analysis>；ICD 203 <https://intelligence.gov/assets/documents/Intelligence%20Community%20Directives/ICD_203.pdf>；Words of estimative probability <https://en.wikipedia.org/wiki/Words_of_estimative_probability>
- Spatial confounding <https://arxiv.org/pdf/2112.14946>；<https://www.tandfonline.com/doi/full/10.1080/19475683.2023.2257788>；Bradford Hill <https://pmc.ncbi.nlm.nih.gov/articles/PMC4589117/>；DiD parallel trends <https://blogs.worldbank.org/en/impactevaluations/revisiting-difference-differences-parallel-trends-assumption-part-i-pre-trend>；Storks and babies <http://www.brixtonhealth.com/storksBabies.pdf>
