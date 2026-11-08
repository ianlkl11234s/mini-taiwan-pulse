// 站主限定靜態資料通用家族 owner-data（2026-11-08 起，取代 Supabase owner-only RPC 的靜態圖層）。
// 只有這些 key 可讀，請求不能指定路徑；新增檔案＝匯出→上傳（scripts/deploy/upload-owner-data-private.mjs）→在此加一列，
// 並同步 src/data/ownerDataAssets.ts（測試逐一比對）。sha256 改變＝內容定址的新物件，舊版本仍留在 bucket 可回滾。
export const OWNER_DATA_ASSETS = Object.freeze({
  // 畜禽飼養場 13,087 筆（public.get_livestock_farms() 的輸出，2026-11-08 匯出）
  "livestock-farms": Object.freeze({ filename: "livestock_farms.geojson", size: 4170582, sha256: "74e140009fc62521a0cc86dc65be73c6158b25d47b8fb52f80a220e59878bf81" }),
  // 屠宰場 185 筆（public.get_livestock_slaughterhouses() 的輸出，2026-11-08 匯出）
  "livestock-slaughterhouses": Object.freeze({ filename: "slaughterhouses.geojson", size: 50103, sha256: "56a52c7cfcfcca29214e6eb88a20bcff71938259d3337359baf5608633aafafe" }),
});
