/**
 * 站主限定靜態資料通用家族 owner-data 的前端契約；與 sidecar `OWNER_DATA_ASSETS`
 * （server/coral-private/owner-data-assets.mjs）同一組數字（ownerData.test.ts 逐一比對）。
 * 新增檔案流程見 docs/features/owner-gated-layers/README.md「owner-data 家族」。
 */
export const OWNER_DATA_ASSETS = {
  "livestock-farms": { filename: "livestock_farms.geojson", size: 4170582, sha256: "74e140009fc62521a0cc86dc65be73c6158b25d47b8fb52f80a220e59878bf81" },
  "livestock-slaughterhouses": { filename: "slaughterhouses.geojson", size: 50103, sha256: "56a52c7cfcfcca29214e6eb88a20bcff71938259d3337359baf5608633aafafe" },
  "fossil-fuel-layers": { filename: "fossil_fuel_layers.json", size: 1552056, sha256: "eff1289ba7c48e8e8e10e845bf82da9e652d8fd3dc05ef6e8fa70bc0cd8a64c2" },
  "fossil-fuel-infrastructure": { filename: "fossil_fuel_infrastructure.json", size: 2493, sha256: "8eaae96f46b7e24444ee57b3cc85a68904b019eb016f27cdb7044d5ba5373e97" },
  "osm-substations": { filename: "osm_substations.json", size: 176738, sha256: "0b3d37612292fbdc2b97b12abd7aaf49f0f130e580bfc94d3e96a13bd70f6b9a" },
  "osm-power-lines": { filename: "osm_power_lines.json", size: 1328573, sha256: "a087e507e584023a7d784ddba5aa4479b5b9f8b1781b200f6ab67f01e1ba3846" },
  "osm-power-towers": { filename: "osm_power_towers.json", size: 3452080, sha256: "b29f756eaef8d1c8f7daefb776e6f5d8e9168e0bb9644d04979ec0390a4c3dbb" },
  "fac-primary": { filename: "fac_primary.json", size: 69951, sha256: "4e6a40d8ec3b6404d84a29943463f6087e98943dfb5e74ae0eab9fab84d6f13f" },
  "fac-offshore": { filename: "fac_offshore.json", size: 4229, sha256: "d5d988e15b2ea0f8ff3c4445b56de8028ee9f880c09d93b881f37f1f5859ed2f" },
  "fac-planned": { filename: "fac_planned.json", size: 11105, sha256: "082dc60bd4dee6a8b5e14b729950fc8362c96a74a6941d5014e3cbb5263aacea" },
  "fac-historical": { filename: "fac_historical.json", size: 4210, sha256: "989eca1e84151a85accd6c8346fd5d056b1065d050ae871a6ba934dab1b4f641" },
  "fac-secondary": { filename: "fac_secondary.json", size: 105925, sha256: "79a50993954402eecb9a55f2ffad7d45610fd5f2c90eb1efeb2f1693b1d4cc72" },
  "fac-osm-supplement": { filename: "fac_osm_supplement.json", size: 161885, sha256: "3e1c7c08bb21c32a4fa000e6063c13916f56d970001eaee8bb422b9fff0ddd72" },
  "osm-power-plants-static": { filename: "osm_power_plants_static.json", size: 103409, sha256: "887809b2a043903efebd870dc78f3b39eda64ec005d34596f2541bda3828f719" },
} as const;

export type OwnerDataAssetName = keyof typeof OWNER_DATA_ASSETS;

export const OWNER_DATA_ENDPOINT = "/api/private-research/owner-data";
/** sidecar 單次 Range 上限（coral-private-server.mjs MAX_RANGE_BYTES） */
export const OWNER_DATA_MAX_RANGE_BYTES = 8 * 1024 * 1024;
