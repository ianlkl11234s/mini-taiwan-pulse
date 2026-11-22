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
  // ── 南韓首爾用途地域（2026-11-14，站主限定；data.go.kr 註含第三方權利，不入倉；analytics data/processed/urban_composite/kr/seoul_zoning）──
  "kr-seoul-zoning": Object.freeze({ filename: "kr_seoul_zoning.pmtiles", size: 7364833, sha256: "3fd6df7db523d0b3ef7e8d078e2ed18b45ea9fbb73ef02782f263a57db6efe62" }),
  // ── 越南 WDPCA 保護區 raster（2026-11-17，站主限定；WDPCA 條款禁再散布與可下載地圖，W6-1 站主選 A＋B；analytics data/processed/conservation/vn/wdpca）──
  "vn-wdpca-raster": Object.freeze({ filename: "vn_wdpca_raster.pmtiles", size: 2457302, sha256: "6b68fc2f64387b2f1d3ea1658c2c553e9e2b17d5f0ea3e98457e7487d074b771" }),
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
  // ── 中國第 2–5 波（2026-11-16，站主限定，taipei-gis-analytics #395）──
  "cn-eez": Object.freeze({ filename: "cn_eez.pmtiles", size: 265862, sha256: "35a8f6044365e2c25a28e42e6168545921bbd96b7e32a54f089f1acfa44e60c3" }),
  "cn-terrain": Object.freeze({ filename: "cn_terrain.pmtiles", size: 11463788, sha256: "0ae9f6a98311acb90f278ae5da68ce76f2b4aca80dfa0c7606b4d9da8d5ecffb" }),
  "cn-place-names": Object.freeze({ filename: "cn_place_names.pmtiles", size: 2039852, sha256: "277c679c5abae611ee84c7ea53d300dad7ff54bd6a15d17dd798e1b55cb2f912" }),
  "cn-ethnic-autonomy": Object.freeze({ filename: "cn_ethnic_autonomy.pmtiles", size: 1070664, sha256: "786e955a251e154e74771bded0e8c4bf7c35a6581a34fa9c87e7ba9c780c3b4f" }),
  "cn-dams": Object.freeze({ filename: "cn_dams.pmtiles", size: 5405303, sha256: "783be446a2b824e5a4f58a8aaa297a3c512c7a0a6847ddcdd4ee2ecf0cd7b439" }),
  "cn-rivers": Object.freeze({ filename: "cn_rivers.pmtiles", size: 6409140, sha256: "698814325b20174fa260e33b898ad1ab369b613fcff937b86abc22f2204d5ac4" }),
  "cn-active-faults": Object.freeze({ filename: "cn_active_faults.pmtiles", size: 668787, sha256: "974759632c6b355e9d089f3fc5d11853b677dd17cecd7ecc937f52cb9278f1e2" }),
  "cn-nature-reserves": Object.freeze({ filename: "cn_nature_reserves.pmtiles", size: 2237674, sha256: "f52084f923ad2407b7c612df47401fbf38101dc486f400af5af6882639269d1f" }),
  "cn-wdpa": Object.freeze({ filename: "cn_wdpa.pmtiles", size: 858576, sha256: "f19aa9143e19af803039fb7ba8c67aa44626e82e885ca5a851e8397e59f1b133" }),
  "cn-aquaculture": Object.freeze({ filename: "cn_aquaculture.pmtiles", size: 1002957, sha256: "1d0f05e301cafce68e21f331e9c5672c1b0ce0caad8492b5b1c0f7243cbf5f58" }),
  "cn-soil": Object.freeze({ filename: "cn_soil.pmtiles", size: 3535996, sha256: "10b9b486a10c52cbd2e568eee9b982cfe31614f34c43678531c8a03c2622332e" }),
  "cn-bridges-tunnels": Object.freeze({ filename: "cn_bridges_tunnels.pmtiles", size: 3994943, sha256: "a9c0ae12cad39916b6fbb658f42a39f571917626afaf3cf340033e07c4643e59" }),
  "cn-schools": Object.freeze({ filename: "cn_schools.pmtiles", size: 3433795, sha256: "421ac3dc74e883d79d4e04318c051c8ac9aabd940d2cc8867d1703fa022a5dc4" }),
  "cn-medical": Object.freeze({ filename: "cn_medical.pmtiles", size: 1213713, sha256: "744992366fc9cc157d8bb4698df36953546711907b1e425a58a20b848621924b" }),
  "cn-nuclear-plants": Object.freeze({ filename: "cn_nuclear_plants.pmtiles", size: 70028, sha256: "dc9a5f17b1135e9e2257c8cac003896c63028e57e3eae7bedd78a0f6963fb96a" }),
  // ── 門牌搜尋站主版（地址搜尋第二階段，2026-11-22 建置；TGOS＋稅籍／公司非內插門牌，只含公開版沒有的鍵）──
  // 臺北市 10,501 鍵
  "address-owner-63000": Object.freeze({ filename: "address_owner_63000.json", size: 441947, sha256: "44f7b78da1a21c474293dbcce0c55e660651237e04a2012f489dbcfe63c361fb" }),
  // 新北市 14,590 鍵
  "address-owner-65000": Object.freeze({ filename: "address_owner_65000.json", size: 627454, sha256: "6e061025db4edacf8eb2bb9385c6ef51a95ce9fc10a1846e72da75833ba57d16" }),
  // 桃園市 8,643 鍵
  "address-owner-68000": Object.freeze({ filename: "address_owner_68000.json", size: 382853, sha256: "9508519434e62106ba8ce445820484a69474a6929013d6ce3df3591edf6c49f3" }),
  // 臺中市 23,098 鍵
  "address-owner-66000": Object.freeze({ filename: "address_owner_66000.json", size: 974860, sha256: "ca28bd1fe55d4f45e61e571c49e90364b479e783793c5f39784cc61138c15440" }),
  // 臺南市 22,582 鍵
  "address-owner-67000": Object.freeze({ filename: "address_owner_67000.json", size: 901893, sha256: "5609d6c3ff6458fc024863b64ada53de1b6822dd85a4d7019501a4fc854ebe96" }),
  // 高雄市 15,360 鍵
  "address-owner-64000": Object.freeze({ filename: "address_owner_64000.json", size: 671374, sha256: "bc6c5cc1b2971756076a594d2a9cb02af6f2cf84136fb90447b5a7d4b87e9651" }),
  // 新竹市 2,058 鍵
  "address-owner-10018": Object.freeze({ filename: "address_owner_10018.json", size: 87571, sha256: "68b99d6cfbe317c861fd9c0a27205d0144417a23456068879377991d7f52bb6d" }),
  // 新竹縣 2,640 鍵
  "address-owner-10004": Object.freeze({ filename: "address_owner_10004.json", size: 114316, sha256: "fb5ec1dcc5868bbb514971f1d049f13c4910bd239440283e883ddaf48c197c4e" }),
  // 苗栗縣 5,971 鍵
  "address-owner-10005": Object.freeze({ filename: "address_owner_10005.json", size: 244855, sha256: "dd054f63a4445175652090036b597535ccc0e7642fae07537e47f0f30cbbd4d9" }),
  // 彰化縣 19,972 鍵
  "address-owner-10007": Object.freeze({ filename: "address_owner_10007.json", size: 852279, sha256: "85d76b6ffeb6a6437eedd826a33f89271e63fc8f5c452f50864ace8e49b9b445" }),
  // 雲林縣 6,515 鍵
  "address-owner-10009": Object.freeze({ filename: "address_owner_10009.json", size: 276988, sha256: "977343cbee33bd2a9616b06052175674a5d46cd26867f045eab697211c6a9fbb" }),
  // 嘉義縣 8,936 鍵
  "address-owner-10010": Object.freeze({ filename: "address_owner_10010.json", size: 356414, sha256: "dd888fc8db3bbf2be8d7d330ed20bc2f1d07a0905d0cde9c77b94b8a4b2420d8" }),
  // 屏東縣 7,366 鍵
  "address-owner-10013": Object.freeze({ filename: "address_owner_10013.json", size: 320688, sha256: "18db8df107972d43fbc10ab015f71763c5d569321514cfe0ef04f517892eaaad" }),
  // 臺東縣 2,507 鍵
  "address-owner-10014": Object.freeze({ filename: "address_owner_10014.json", size: 101243, sha256: "4e5fa14efe6a3ae7a49941649a7b6f7613465585c50fe5e678a56d9c61e00cb7" }),
  // 花蓮縣 2,469 鍵
  "address-owner-10015": Object.freeze({ filename: "address_owner_10015.json", size: 109837, sha256: "93f318e4947cb5d7dd5cf75bdfcb4cada7392163ac5997b4916ffa657eb5be40" }),
  // 金門縣 2,894 鍵
  "address-owner-09020": Object.freeze({ filename: "address_owner_09020.json", size: 110258, sha256: "6b7648a4c2d508d485fc9193ffcc9d4168c674d4f7a98c792c379986b62d3eca" }),
  // 澎湖縣 2,815 鍵
  "address-owner-10016": Object.freeze({ filename: "address_owner_10016.json", size: 103047, sha256: "fff47234de31793601d8dea575938f41d2c7ef5f807ab849554c5c0fef993c7f" }),
  // 基隆市 1,894 鍵
  "address-owner-10017": Object.freeze({ filename: "address_owner_10017.json", size: 85506, sha256: "543929d7cf5d710d4c84e634e763130689bbf5fd2aa45c351ea6521d881870cd" }),
  // 宜蘭縣 20,862 鍵
  "address-owner-10002": Object.freeze({ filename: "address_owner_10002.json", size: 759971, sha256: "134c73b2d20a03de2ee348742ed9b0af0239befab53450e3fee2f62adcd10b4f" }),
  // 南投縣 17,813 鍵
  "address-owner-10008": Object.freeze({ filename: "address_owner_10008.json", size: 673881, sha256: "4591447539de0337093f7414eba5eb11c8cabd6e7be3f36ccf52152dab65c619" }),
  // 嘉義市 9,516 鍵
  "address-owner-10020": Object.freeze({ filename: "address_owner_10020.json", size: 336498, sha256: "d76b571a902af120d934302ed57944108c191c6c9ad35bf957685146514474c9" }),
  // 連江縣 905 鍵
  "address-owner-09007": Object.freeze({ filename: "address_owner_09007.json", size: 29983, sha256: "bcdc8485e07c25db730dde6d7a08e9bf8eb4cf19c0e29353be8f0f421153a46a" }),
});
