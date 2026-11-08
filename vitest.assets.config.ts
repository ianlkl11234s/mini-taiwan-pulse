import { defineConfig } from "vitest/config";
import packageJson from "./package.json";
import { ASSET_TESTS } from "./vitest.shared";

// `npm run check:assets` 用：只跑讀 public/ 資料檔內容的資產測試（清單在 vitest.shared.ts）。
// 不要直接跑：先由 scripts/deploy/check-assets.mjs 從 R2 下載並比對 sha256。
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  test: {
    include: ASSET_TESTS,
    environment: "node",
  },
});
