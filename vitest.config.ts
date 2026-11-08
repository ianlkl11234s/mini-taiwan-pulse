import { defineConfig, configDefaults } from "vitest/config";
import packageJson from "./package.json";
import { ASSET_TESTS } from "./vitest.shared";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  test: {
    include: ["src/**/*.test.ts", "eslint-rules/**/*.test.js"],
    // 讀 public/ 資料檔內容的資產測試另由 `npm run check:assets` 跑（vitest.shared.ts）
    exclude: [...configDefaults.exclude, ...ASSET_TESTS],
    environment: "node",
  },
});
