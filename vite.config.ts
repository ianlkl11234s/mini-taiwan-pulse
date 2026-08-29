import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { parseSingleByteRange } from "./src/data/gfwV4Range";

// build 後把「只給腳本/文件用、不需上線」的大型靜態檔從 dist 移除。
// 這些檔放在 public/ 只是被 preprocess/deploy 腳本當輸入或輸出，
// 不該隨 app 一起部署（避免線上體積暴增）。
function stripBuildAssets(relPaths: string[]): Plugin {
  return {
    name: "strip-build-assets",
    apply: "build",
    closeBundle: async () => {
      for (const rel of relPaths) {
        await rm(resolve(process.cwd(), "dist", rel), { force: true, recursive: true });
      }
    },
  };
}

/** Dev-only, opt-in candidate mount for the isolated Phase-2 benchmark. */
function serveGfwV4CandidateStage(): Plugin {
  const stageRoot = process.env.GFW_V4_STAGE_ROOT;
  const localFormalRoot = resolve(process.cwd(), "public/global-maritime/gfw-hourly/v4");
  return {
    name: "serve-gfw-v4-candidate-stage",
    apply: "serve",
    configureServer(server) {
      // Canonical localhost acceptance must read the installed formal release,
      // not fall through to the production proxy. This path is fixed and needs
      // no query flag or environment variable.
      server.middlewares.use("/global-maritime/gfw-hourly/v4", (request, response, next) => {
        if (!request.url) return next();
        const relative = decodeURIComponent(request.url.split("?", 1)[0] ?? "").replace(/^\/+/, "");
        const target = resolve(localFormalRoot, relative);
        if (target !== localFormalRoot && !target.startsWith(`${localFormalRoot}/`)) return next();
        void stat(target).then((info) => {
          if (!info.isFile()) return next();
          const range = parseSingleByteRange(request.headers.range, info.size);
          if (range === "invalid") {
            response.statusCode = 416;
            response.setHeader("content-range", `bytes */${info.size}`);
            response.end();
            return;
          }
          const start = range?.start ?? 0;
          const end = range?.end ?? info.size - 1;
          response.statusCode = range ? 206 : 200;
          response.setHeader("accept-ranges", "bytes");
          response.setHeader("content-length", end - start + 1);
          if (range) response.setHeader("content-range", `bytes ${start}-${end}/${info.size}`);
          response.setHeader("cache-control", relative === "manifest.json" ? "no-cache" : "public,max-age=604800,immutable");
          response.setHeader("content-type", target.endsWith(".pmtiles") ? "application/octet-stream" : "application/json");
          // Keep *.json.gz as raw immutable bytes. Browsers validate SHA-256
          // before explicitly decompressing; Content-Encoding would decode it early.
          createReadStream(target, { start, end }).pipe(response);
        }).catch(() => next());
      });
      server.middlewares.use("/__gfw-v4-stage", (request, response, next) => {
        if (!stageRoot || !request.url) return next();
        const relative = decodeURIComponent(request.url.split("?", 1)[0] ?? "").replace(/^\/+/, "");
        const target = resolve(stageRoot, relative);
        if (target !== resolve(stageRoot) && !target.startsWith(`${resolve(stageRoot)}/`)) return next();
        void stat(target).then((info) => {
          if (!info.isFile()) return next();
          const range = parseSingleByteRange(request.headers.range, info.size);
          if (range === "invalid") {
            response.statusCode = 416;
            response.setHeader("content-range", `bytes */${info.size}`);
            response.end();
            return;
          }
          const start = range?.start ?? 0;
          const end = range?.end ?? info.size - 1;
          response.statusCode = range ? 206 : 200;
          response.setHeader("accept-ranges", "bytes");
          response.setHeader("content-length", end - start + 1);
          if (range) response.setHeader("content-range", `bytes ${start}-${end}/${info.size}`);
          response.setHeader("cache-control", "no-store");
          response.setHeader("content-type", target.endsWith(".pmtiles") ? "application/octet-stream" : "application/json");
          createReadStream(target, { start, end }).pipe(response);
        }).catch(() => next());
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    serveGfwV4CandidateStage(),
    stripBuildAssets([
      // 55MB，bundle-rail-data.py 產出 → upload-rail-to-s3.ts 上傳 S3 的中間產物，app runtime 不載入
      "rail_bundle.json",
      // GFW 7-day trajectory POC 僅供 localhost bbox.html 驗收，不可跟 production bundle 部署
      "gfw_hourly_tracks_poc.geojson",
      // GFW daily partition POC 也只是 dev fallback；production runtime 必須走 CDN
      "gfw_hourly_tracks_poc",
      // GFW 小時格網 POC 僅供 localhost 主站時間軸驗收；production 必須改走正式 partitions/RPC
      "gfw_hourly_grid_poc",
      // GFW v4 immutable releases 由獨立 pull/install 流程管理；dev 可讀，但 app build 不複製。
      "global-maritime/gfw-hourly/v4",
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
        // GFW / AIS 查詢範圍框選工具（獨立 Mapbox entry，不載入主站 overlays）
        bbox: resolve(process.cwd(), "bbox.html"),
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
      // DEV 經 production origin 讀 GFW immutable releases；顯式轉送 Range，
      // 讓 PMTiles 收到與 production 相同的 206 response。
      "/global-maritime/gfw-hourly": {
        target: "https://mini-taiwan-pulse.itsmigu.com",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, request) => {
            // 這條只代理公開 release assets；不要把 localhost session 帶到 production origin。
            proxyReq.removeHeader("authorization");
            proxyReq.removeHeader("cookie");
            const range = request.headers.range;
            if (typeof range === "string") proxyReq.setHeader("range", range);
          });
        },
      },
    },
  },
});
