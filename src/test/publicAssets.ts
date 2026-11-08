import { existsSync, readFileSync } from "node:fs";

/**
 * public/ 資料檔的正本清單（deploy/public-assets.lock.json，CI-4）。
 *
 * 資料檔移出 git 後，CI 的 test job 沒有實體檔：
 * - 只檢查「存在、大小、sha256」的測試 → 直接查 lock（lockedAsset），不讀檔。
 * - 要讀內容的資產測試（vitest.shared.ts 的 ASSET_TESTS）由 `npm run check:assets` 先從 R2 下載、
 *   比對 sha256 後再跑；測試裡用 assetAvailable() 取代 existsSync() 守門。
 */
export interface PublicAssetLockEntry {
  path: string;
  bytes: number;
  sha256: string;
  delivery: "r2" | "s3" | "pending" | "git" | "undecided";
  s3_key?: string;
  note?: string;
}

export const PUBLIC_ASSETS_LOCK = JSON.parse(readFileSync("deploy/public-assets.lock.json", "utf8")) as {
  r2_base: string;
  keep_patterns: string[];
  entries: PublicAssetLockEntry[];
};

const BY_PATH = new Map(PUBLIC_ASSETS_LOCK.entries.map((e) => [e.path, e]));

/** 接受 "public/geo/x.geojson"、"geo/x.geojson"、"./geo/x.geojson" 或絕對路徑 */
export function publicPath(path: string): string {
  const i = path.lastIndexOf("/public/");
  if (i >= 0) return path.slice(i + 1);
  const p = path.replace(/^\.\//, "").replace(/^\//, "");
  return p.startsWith("public/") ? p : `public/${p}`;
}

export function lockedAsset(path: string): PublicAssetLockEntry | undefined {
  return BY_PATH.get(publicPath(path));
}

/**
 * 資產測試的守門，取代 `existsSync(path)`：
 * - 本機有檔 → true
 * - 不在 lock（gitignored 的 S3／站主檔）→ false，維持原本「本機沒有就略過」
 * - 在 lock、delivery=r2 卻沒有實體檔 → 直接失敗（不可靜默略過；跑 `npm run check:assets` 會下載）
 * - 在 lock、但不在 R2（s3／pending／git／undecided）→ 印出警告後 false
 */
export function assetAvailable(path: string): boolean {
  if (existsSync(path)) return true;
  const e = lockedAsset(path);
  if (!e) return false;
  if (e.delivery === "r2") {
    throw new Error(
      `${e.path} 在 deploy/public-assets.lock.json（delivery=r2），但本機沒有實體檔。` +
      "先跑 `npm run check:assets`（從 R2 下載並比對 sha256）；新的資產測試要讀它，就把路徑加進 deploy/asset-test-files.txt。",
    );
  }
  console.warn(`⚠ 略過：${e.path}（delivery=${e.delivery}）不在 R2、本機也沒有實體檔；需本機或 S3 取得`);
  return false;
}
