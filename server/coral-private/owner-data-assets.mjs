// 站主限定靜態資料通用家族 owner-data（2026-11-08 起，取代 Supabase owner-only RPC 的靜態圖層）。
// 只有這些 key 可讀，請求不能指定路徑；新增檔案＝匯出→上傳（scripts/deploy/upload-owner-data-private.mjs）→在此加一列，
// 並同步 src/data/ownerDataAssets.ts（測試逐一比對）。sha256 改變＝內容定址的新物件，舊版本仍留在 bucket 可回滾。
export const OWNER_DATA_ASSETS = Object.freeze({
  // 畜禽飼養場 13,087 筆（public.get_livestock_farms() 的輸出，2026-11-08 匯出）
  "livestock-farms": Object.freeze({ filename: "livestock_farms.geojson", size: 4170582, sha256: "74e140009fc62521a0cc86dc65be73c6158b25d47b8fb52f80a220e59878bf81" }),
  // 屠宰場 185 筆（public.get_livestock_slaughterhouses() 的輸出，2026-11-08 匯出）
  "livestock-slaughterhouses": Object.freeze({ filename: "slaughterhouses.geojson", size: 50103, sha256: "56a52c7cfcfcca29214e6eb88a20bcff71938259d3337359baf5608633aafafe" }),
  // ── 第 2 批：能源與石化（2026-11-08）──
  // public.get_fossil_fuel_layers() 的輸出 1,520 筆（已剔除公開的 gas_station_* 5 層），2026-11-08 匯出
  "fossil-fuel-layers": Object.freeze({ filename: "fossil_fuel_layers.json", size: 1552056, sha256: "eff1289ba7c48e8e8e10e845bf82da9e652d8fd3dc05ef6e8fa70bc0cd8a64c2" }),
  // public.get_fossil_fuel_infrastructure() 的輸出 9 筆，2026-11-08 匯出
  "fossil-fuel-infrastructure": Object.freeze({ filename: "fossil_fuel_infrastructure.json", size: 2493, sha256: "8eaae96f46b7e24444ee57b3cc85a68904b019eb016f27cdb7044d5ba5373e97" }),
  // public.get_osm_substations() 的輸出 785 筆，2026-11-08 匯出
  "osm-substations": Object.freeze({ filename: "osm_substations.json", size: 176738, sha256: "0b3d37612292fbdc2b97b12abd7aaf49f0f130e580bfc94d3e96a13bd70f6b9a" }),
  // public.get_osm_power_lines() 的輸出 2,305 筆，2026-11-08 匯出
  "osm-power-lines": Object.freeze({ filename: "osm_power_lines.json", size: 1328573, sha256: "a087e507e584023a7d784ddba5aa4479b5b9f8b1781b200f6ab67f01e1ba3846" }),
  // public.get_osm_power_towers() 的輸出 26,589 筆，2026-11-08 匯出
  "osm-power-towers": Object.freeze({ filename: "osm_power_towers.json", size: 3452080, sha256: "b29f756eaef8d1c8f7daefb776e6f5d8e9168e0bb9644d04979ec0390a4c3dbb" }),
  // public.get_ssot_facilities_primary_operating() 的輸出 209 筆，2026-11-08 匯出
  "fac-primary": Object.freeze({ filename: "fac_primary.json", size: 69951, sha256: "4e6a40d8ec3b6404d84a29943463f6087e98943dfb5e74ae0eab9fab84d6f13f" }),
  // public.get_ssot_facilities_offshore_zones() 的輸出 8 筆，2026-11-08 匯出
  "fac-offshore": Object.freeze({ filename: "fac_offshore.json", size: 4229, sha256: "d5d988e15b2ea0f8ff3c4445b56de8028ee9f880c09d93b881f37f1f5859ed2f" }),
  // public.get_ssot_facilities_planned() 的輸出 35 筆，2026-11-08 匯出
  "fac-planned": Object.freeze({ filename: "fac_planned.json", size: 11105, sha256: "082dc60bd4dee6a8b5e14b729950fc8362c96a74a6941d5014e3cbb5263aacea" }),
  // public.get_ssot_facilities_historical() 的輸出 15 筆，2026-11-08 匯出
  "fac-historical": Object.freeze({ filename: "fac_historical.json", size: 4210, sha256: "989eca1e84151a85accd6c8346fd5d056b1065d050ae871a6ba934dab1b4f641" }),
  // public.get_ssot_facilities_secondary_small() 的輸出 341 筆，2026-11-08 匯出
  "fac-secondary": Object.freeze({ filename: "fac_secondary.json", size: 105925, sha256: "79a50993954402eecb9a55f2ffad7d45610fd5f2c90eb1efeb2f1693b1d4cc72" }),
  // public.get_ssot_facilities_osm_supplement() 的輸出 1,215 筆，2026-11-08 匯出
  "fac-osm-supplement": Object.freeze({ filename: "fac_osm_supplement.json", size: 161885, sha256: "3e1c7c08bb21c32a4fa000e6063c13916f56d970001eaee8bb422b9fff0ddd72" }),
  // public.get_osm_power_plants_static() 的輸出 513 筆，2026-11-08 匯出
  "osm-power-plants-static": Object.freeze({ filename: "osm_power_plants_static.json", size: 103409, sha256: "887809b2a043903efebd870dc78f3b39eda64ec005d34596f2541bda3828f719" }),
  // ── 中國第 0–1 波（2026-11-13，站主限定；瘦身版 PMTiles，taipei-gis-analytics #377）──
  "cn-admin-boundaries": Object.freeze({ filename: "cn_admin_boundaries.pmtiles", size: 8035001, sha256: "930b5dcefcb1e8b7bd3b0ab5383bd867138a9c45b4bf5ce2be329ae84907bd6b" }),
  "cn-population": Object.freeze({ filename: "cn_population.pmtiles", size: 5164691, sha256: "2dcd85c60b99556064cf18d52caea9561b96383f08dbba6ae2abb71446b0a158" }),
  "cn-population-grid": Object.freeze({ filename: "cn_population_grid.pmtiles", size: 9298095, sha256: "2bb4a2dff102ff099290fc1a4ad48e64cef1681ca7f5ad1ad1067f6d042fd678" }),
  "cn-bus-stops": Object.freeze({ filename: "cn_bus_stops.pmtiles", size: 10782841, sha256: "4750977d73eb93a415b9aa9cfcd020689a9044c00d0afaa3a426ac5e290a2359" }),
  "cn-power-plants": Object.freeze({ filename: "cn_power_plants.pmtiles", size: 8737832, sha256: "26059e16166146dba5baff7272b580d660abf4590abb88900bebc22ac81451c6" }),
  "cn-pipelines": Object.freeze({ filename: "cn_pipelines.pmtiles", size: 6458511, sha256: "c18afcce7f00c1bb027e473a67f9ae50fbc08646afef65a7112ce167c5c1c89a" }),
  "cn-transport-hubs": Object.freeze({ filename: "cn_transport_hubs.pmtiles", size: 2787937, sha256: "42c4ed85899beebf69a56b8e50bb39f64f2b2ded1781334a212691e74b482812" }),
  "cn-major-roads": Object.freeze({ filename: "cn_major_roads.pmtiles", size: 27769071, sha256: "301bb1bb1cf485632982b69e583ea552dc4401e815526f754eb2707f752955a8" }),
  "cn-power-grid": Object.freeze({ filename: "cn_power_grid.pmtiles", size: 19270244, sha256: "d89e67c2fd6b57ead2cb51fcb3398d0f130482c6c49e23affdb5e6da9e16475c" }),
});
