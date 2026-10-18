import { existsSync } from "node:fs";

/**
 * 本機 owner-local 測試開關。
 *
 * 讀隔壁 repo（../taipei-gis-analytics、../runtime/…）或 gitignored 私有／大檔（public/geo/*.geojson 等）
 * 的測試，在 CI 的乾淨 checkout 一律略過。為了讓本機 `npm test` 與 CI 跑同一組測試，這類測試
 * 預設也略過；要跑時用 `npm run test:owner`（= PULSE_OWNER_TESTS=1 vitest run）。
 *
 * 只用在「不在 git 裡」的路徑：git 追蹤的檔 CI 一定有，不要用這個 gate，否則 CI 會少跑。
 */
export const OWNER_TESTS = process.env.PULSE_OWNER_TESTS === "1";

/** owner 模式且檔案存在才回 true；用於 it.skipIf(!ownerAsset(path)) */
export function ownerAsset(path: string | URL): boolean {
  return OWNER_TESTS && existsSync(path);
}
