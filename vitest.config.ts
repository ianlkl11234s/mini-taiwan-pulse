import { defineConfig } from "vitest/config";
import packageJson from "./package.json";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  test: {
    include: ["src/**/*.test.ts", "eslint-rules/**/*.test.js"],
    environment: "node",
    // threads 比預設 forks 快約一倍（2026-11-08 實測 161s→82s，maxWorkers=2）；原則與風險見 docs/ci.md §4
    pool: "threads",
  },
});
