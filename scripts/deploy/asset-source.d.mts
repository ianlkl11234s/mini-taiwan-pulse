// 型別宣告：asset-source.mjs（check-assets 的 R2／S3 取檔決策，CI-10）。
export interface AssetEntry { path: string; sha256: string; bytes: number; s3_key?: string }
export interface FetchResult { status: number; sha256?: string; bytes?: number; error?: string }
export type ResolveResult =
  | { ok: true; source: "r2" | "s3" }
  | { ok: false; source: "r2" | "s3"; reason: string };
export declare function resolveAsset(
  entry: AssetEntry,
  deps: {
    fetchR2: (entry: AssetEntry) => Promise<FetchResult>;
    inBaseLock: (path: string) => Promise<boolean>;
    s3Configured: boolean;
    fetchS3: (entry: AssetEntry) => Promise<FetchResult>;
    baseLabel?: string;
  },
): Promise<ResolveResult>;
export declare function memoBaseLock(readPaths: () => string[] | Promise<string[]>): (path: string) => Promise<boolean>;

// CI-11：lock 新增／變更的條目都要真的有檔（只做 HEAD）
export interface LockEntry extends AssetEntry { delivery?: string }
export interface HeadResult { status: number; bytes?: number | null; sha256?: string | null; error?: string }
export type PresenceResult = { ok: true; source: "public" | "s3" } | { ok: false; reason: string };
export declare const UPLOAD_HELP: string;
export declare function changedLockEntries<T extends LockEntry>(entries: T[], baseEntries: AssetEntry[]): T[];
export declare function checkPresence(
  entry: AssetEntry,
  deps: {
    headPublic: (entry: AssetEntry) => Promise<HeadResult>;
    s3Configured: boolean;
    headS3: (entry: AssetEntry) => Promise<HeadResult>;
  },
): Promise<PresenceResult>;
