import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

// build 後把「只給腳本/文件用、不需上線」的大型靜態檔從 dist 移除。
// 這些檔放在 public/ 只是被 preprocess/deploy 腳本當輸入或輸出，
// 不該隨 app 一起部署（避免線上體積暴增）。
function stripBuildAssets(relPaths: string[]): Plugin {
  return {
    name: "strip-build-assets",
    apply: "build",
    closeBundle: async () => {
      for (const rel of relPaths) {
        await rm(resolve(process.cwd(), "dist", rel), { force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    stripBuildAssets([
      // 55MB，bundle-rail-data.py 產出 → upload-rail-to-s3.ts 上傳 S3 的中間產物，app runtime 不載入
      "rail_bundle.json",
    ]),
  ],
  assetsInclude: ["**/*.vert", "**/*.frag"],
  build: {
    rollupOptions: {
      input: {
        // 主站（mapbox-gl + Three.js）
        main: resolve(process.cwd(), "index.html"),
        // EM-06 嵌入版（MapLibre + Protomaps 底圖，不載入 mapbox-gl / Three.js）
        embed: resolve(process.cwd(), "embed.html"),
      },
    },
  },
  server: {
    port: 3721,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
