# 原工作目錄未提交圖層差異

以同一AST extractor比較原working tree與research baseline；排除source line位移。未修改原repo。

- 原working tree：472個顯式manifest＋24個recipe＝496個key。
- Research worktree：452＋24＝476個key。
- 新增20個、移除0個；既有項目metadata變更為companyPoints。
- 原始兩次extractor輸出欄位形狀不同曾造成210筆假差異；本交付已使用同一extractor重算，不採該數字。
- 全部新增均為未提交working-tree登記，並非本研究分支已整合／正式站驗證。

|key|名稱|來源登記摘要|
|---|---|---|
|jpAccommodationCanonical|日本旅宿去重總覽 Canonical|useJpTourismLayers lazy-load 靜態 GeoJSON point；null geometry 保留但不渲染|
|jpAccommodationJta|觀光廳登錄飯店／旅館 JTA|useJpTourismLayers lazy-load 靜態 GeoJSON point|
|jpAccommodationLocal|地方旅館業許可（首批）|useJpTourismLayers lazy-load 靜態 GeoJSON point|
|jpAccommodationOsm|OpenStreetMap 住宿 coverage|useJpTourismLayers lazy-load 靜態 GeoJSON point|
|jpNaturalParksNational|國立公園（A10 2010）|共用 A10 GeoJSON，以原始 filter_layer_id 過濾|
|jpNaturalParksQuasiNational|國定公園（A10 2010）|共用 A10 GeoJSON，以原始 filter_layer_id 過濾|
|jpNaturalParksPrefectural|都道府縣立自然公園（A10 2010）|共用 A10 GeoJSON，以原始 filter_layer_id 過濾|
|jpNatureConservationArea|自然保全地域（A11 2015）|共用 A11 GeoJSON，以原始 filter_layer_id 過濾|
|jpPrimitiveNatureEnvironmentArea|原生自然環境地域（A11 2015）|共用 A11 GeoJSON，以原始 filter_layer_id 過濾|
|jpNatureConservationSpecialDistrict|自然保全特別地區（A11 2015）|共用 A11 GeoJSON，以原始 filter_layer_id 過濾|
|jpWildlifeProtectionNational|國指定鳥獸保護區|共用鳥獸保護 GeoJSON，以原始 filter_layer_id 過濾|
|jpWildlifeSpecialProtectionDistrict|鳥獸特別保護地區|共用鳥獸保護 GeoJSON，以原始 filter_layer_id 過濾|
|jpWildlifeSpecialProtectionDesignatedArea|鳥獸特別保護指定地域|共用鳥獸保護 GeoJSON，以原始 filter_layer_id 過濾|
|jpWorldHeritageCultural|UNESCO 文化遺產代表點|共用 UNESCO GeoJSON，以原始 filter_layer_id 過濾|
|jpWorldHeritageNatural|UNESCO 自然遺產代表點|共用 UNESCO GeoJSON，以原始 filter_layer_id 過濾|
|jpWorldNaturalHeritageHistorical|世界自然遺產面（A28 historical）|useJpTourismLayers lazy-load A28 historical GeoJSON polygon|
|jpRamsarSites|Ramsar 濕地名冊衍生點|Ramsar GeoJSON；原始 filter_layer_id + geocode_quality filter|
|jpMarineEbsaCoastal|沿岸生態重要海域 EBSA（2015）|EBSA GeoJSON polygon，以原始 filter_layer_id 過濾|
|companyIndustryDistribution|登記產業分布 Company Industry||
|companyAgeStructure|公司年齡結構 Company Age||

日本旅宿需source/entity/canonical去重與null geometry；保護區與遺產需geometry角色、historical/current、license gate與spatial join；工商產業／年齡分布需group_by、time cohort、比例及尺度一致性。共用前述query/aggregate/evidence契約即可，不必每個新增專用MCP tool。

完整原working快照：[JSON](layer-inventory-original-working.json)。重跑顯式manifest：`node docs/features/agent-research-workbench/inventory/layer-inventory-ast.mjs <repo-root>`；recipe展開依layerManifest.ts:322與enabled JSON另補。
