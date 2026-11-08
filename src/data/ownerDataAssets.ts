/**
 * 站主限定靜態資料通用家族 owner-data 的前端契約；與 sidecar `OWNER_DATA_ASSETS`
 * （server/coral-private/owner-data-assets.mjs）同一組數字（ownerData.test.ts 逐一比對）。
 * 新增檔案流程見 docs/features/owner-gated-layers/README.md「owner-data 家族」。
 */
export const OWNER_DATA_ASSETS = {
  "livestock-farms": { filename: "livestock_farms.geojson", size: 4170582, sha256: "74e140009fc62521a0cc86dc65be73c6158b25d47b8fb52f80a220e59878bf81" },
  "livestock-slaughterhouses": { filename: "slaughterhouses.geojson", size: 50103, sha256: "56a52c7cfcfcca29214e6eb88a20bcff71938259d3337359baf5608633aafafe" },
} as const;

export type OwnerDataAssetName = keyof typeof OWNER_DATA_ASSETS;

export const OWNER_DATA_ENDPOINT = "/api/private-research/owner-data";
/** sidecar 單次 Range 上限（coral-private-server.mjs MAX_RANGE_BYTES） */
export const OWNER_DATA_MAX_RANGE_BYTES = 8 * 1024 * 1024;
