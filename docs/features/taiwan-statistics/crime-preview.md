# Crime Area 本機空白修正

worktree缺少被ignore的PMTiles，且原切片只有z8–12，使用者在z7.1無法看到。

本次把既有368鄉鎮GeoJSON重切成z5–12，保持source layer、properties與資料語義；不drop feature。4.8 MB PMTiles與manifest明確納入Git，避免新checkout靜默漏檔。43 MB GeoJSON原料不納Git；從Analytics既有crime_area_monthly processed pipeline取得，checksum見隨附manifest。

重新建置：`bash scripts/preprocess/prepare-crime-area-preview.sh /path/to/crime_area_monthly_20260626.geojson`，需要tippecanoe與pmtiles CLI。前端manifest和overlay最小zoom均為5。

這是既有犯罪統計圖層的資產修正，不代表新增犯罪資料或套用新的統計期別契約；未遠端部署。
