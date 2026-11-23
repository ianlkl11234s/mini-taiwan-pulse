/** upload-owner-data-private.mjs 的型別（測試 import 純函式用）。 */
export interface OwnerDataUploadAsset { product: string; filename: string; size: number; sha256: string }
export interface OwnerDataUploadPlan {
  present: OwnerDataUploadAsset[];
  upload: OwnerDataUploadAsset[];
  missing: OwnerDataUploadAsset[];
  errors: string[];
}
export function ownerDataKey(asset: { filename: string; sha256: string }): string;
export function planOwnerDataUpload(
  assets: OwnerDataUploadAsset[],
  existing: Map<string, number | undefined>,
  validation: { assets?: Record<string, { size: number; sha256: string }> } | null,
  local: Map<string, { size: number; sha256: string }>,
): OwnerDataUploadPlan;
