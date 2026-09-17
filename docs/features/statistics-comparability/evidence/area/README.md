# 行政面積比較：修正後實作證據

2026-09-16；此版取代早期45份草稿與land15分母。完整驗收見 ../../acceptance.md。

- 53個immutable artifacts：15土地類別 × 縣市行政面積占比、縣市LQ、鄉鎮行政面積占比，另8個2025醫療密度。
- 分母只用[戶政司8410人口密度表](https://data.gov.tw/dataset/8410)的行政面積km²。368鄉鎮正式crosswalk匹配後加總22縣市；東沙、南沙不在參考邊界範圍，明列排除。
- 臺北市合計271.7997km²；1km²=100公頃。**25070公告土地現值面積已排除，不能作行政面積分母。**
- LQ = (當地同類面積／當地行政面積) ÷ (全臺同類面積／全臺行政面積)。不使用15種選定用地總和當國土分母。
- 土地113–114年調查與2025行政面積分別保存；醫療2025原始鄉鎮值除同鄉鎮2025面積。有值先呈現，缺值及PARTIAL不變。
- 每列保留分子、分母，source.derivation保存公式、SHA與時間口徑。輸出 recovery/data/statistics-comparison-data/area/manifest-delta.json。
- pytest test_area_comparisons.py 驗證實際53份SHA/bytes、每一筆公式、換算與LQ。完整測試log見 ../python-tests.log。
