import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import schoolsGridReceipt from "./src/research/contracts/schools-grid-receipt.json";
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

/**
 * Immutable agriculture-statistics delivery boundaries are intentionally outside
 * public/. They are exposed only to an opted-in local DEV preview, never copied
 * to dist or proxied by a production server.
 */
function serveAgriStatisticsPreviewBoundaries(): Plugin {
  const enabled = process.env.VITE_AGRI_STATISTICS_PREVIEW === 'true';
  const deliveryRoot = process.env.AGRI_STATISTICS_PREVIEW_ROOT;
  const boundaryRoot = deliveryRoot ? resolve(deliveryRoot, 'data/shared/boundaries') : '';
  return {
    name: 'serve-agri-statistics-preview-boundaries',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__agri-statistics-preview-boundaries', (request, response, next) => {
        if (!enabled || !boundaryRoot || !request.url) return next();
        const relative = decodeURIComponent(request.url.split('?', 1)[0] ?? '').replace(/^\/+/, '');
        const target = resolve(boundaryRoot, relative);
        if (target !== boundaryRoot && !target.startsWith(`${boundaryRoot}/`)) return next();
        void stat(target).then(info => {
          if (!info.isFile()) return next();
          response.statusCode = 200;
          response.setHeader('content-length', info.size);
          response.setHeader('cache-control', 'no-store');
          response.setHeader('content-type', 'application/geo+json');
          createReadStream(target).pipe(response);
        }).catch(() => next());
      });
    },
  };
}

/** Local research archives stay outside public/dist; loopback-only development access. */
function serveLocalResearchAssets(): Plugin {
  const filename = "coral_reef_distribution_global.pmtiles";
  const analyticsRoot = process.env.PULSE_RESEARCH_ANALYTICS_ROOT ?? resolve(process.cwd(), "../taipei-gis-analytics");
  const targets: Record<string, string> = {
    [`/${filename}`]: resolve(analyticsRoot, "data/processed/marine/coral_reef_distribution", filename),
    "/schools-grid.json": resolve(analyticsRoot, "data/intermediate/research-library/schools-grid-v3/bundle.json"),
  };
  return {
    name: "serve-local-coral-research",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__local-research", (request, response) => {
        const remote = request.socket.remoteAddress;
        const host = request.headers.host?.replace(/:\d+$/, "");
        if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote ?? "") ||
            !["127.0.0.1", "localhost", "[::1]"].includes(host ?? "")) {
          response.statusCode = 403;
          response.end("Local research only");
          return;
        }
        const target = targets[request.url?.split("?", 1)[0] ?? ""];
        if (!target ||
            !["GET", "HEAD"].includes(request.method ?? "")) {
          response.statusCode = 404;
          response.end("Unknown local research asset");
          return;
        }
        void stat(target).then((info) => {
          if (target.endsWith("/schools-grid-v3/bundle.json")) {
            const index = new DatabaseSync(resolve(dirname(target), "library.sqlite"), { readOnly: true });
            try {
              const entry = index.prepare("SELECT lifecycle FROM research_assets WHERE id=? LIMIT 1").get(schoolsGridReceipt.assetId);
              if (!entry || !["hold", "candidate", "promoted"].includes(String(entry.lifecycle))) {
                response.statusCode = 409; response.end("Research asset stale or unavailable"); return;
              }
            } finally { index.close(); }
          }
          const range = parseSingleByteRange(request.headers.range, info.size);
          response.setHeader("cache-control", "private, no-store");
          response.setHeader("accept-ranges", "bytes");
          if (range === "invalid") {
            response.statusCode = 416;
            response.setHeader("content-range", `bytes */${info.size}`);
            response.end();
            return;
          }
          const start = range?.start ?? 0;
          const end = range?.end ?? info.size - 1;
          response.statusCode = range ? 206 : 200;
          response.setHeader("content-type", "application/octet-stream");
          response.setHeader("content-length", end - start + 1);
          if (range) response.setHeader("content-range", `bytes ${start}-${end}/${info.size}`);
          if (request.method === "HEAD") return response.end();
          const stream = createReadStream(target, { start, end });
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => {
          response.statusCode = 404;
          response.end("Local research archive unavailable; no coverage inference");
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    serveLocalResearchAssets(),
    serveGfwV4CandidateStage(),
    serveAgriStatisticsPreviewBoundaries(),
    stripBuildAssets([
      // 日本醫療依 exact allowlist 獨立交付；不隨 app bundle 發布。
      "jp-medical",
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
      // Japan tourism production files are supplied by S3 /data/world; research-only files must fail closed.
      "world/jp_accommodation_canonical_20260910.geojson",
      "world/jp_accommodation_canonical_allzoom_20260910.pmtiles",
      "world/jp_accommodation_density_450m_20260910.pmtiles",
      "world/jp_accommodation_density_1500m_20260910.pmtiles",
      "world/jp_accommodation_jta_20260331.geojson",
      "world/jp_accommodation_local_20260910.geojson",
      "world/jp_accommodation_osm_20260910.geojson",
      "world/jp_accommodation_osm_allzoom_20260910.pmtiles",
      "world/jp_natural_parks_ksj_2010.geojson",
      "world/jp_natural_parks_ksj_2010.pmtiles",
      "world/jp_nature_conservation_ksj_2015.geojson",
      "world/jp_nature_conservation_ksj_2015.pmtiles",
      "world/jp_wildlife_protection_moe_202504.geojson",
      "world/jp_wildlife_protection_moe_202504.pmtiles",
      "world/jp_world_natural_heritage_ksj_2011.geojson",
      "world/jp_world_heritage_unesco_current.geojson",
      "world/jp_ramsar_moe_current.geojson",
      "world/jp_marine_ebsa_moe_coastal_20150101.geojson",
      "world/jp_marine_ebsa_moe_coastal_20150101.pmtiles",
    ]),
  ],
  assetsInclude: ["**/*.vert", "**/*.frag"],
  build: {
    rollupOptions: {
      input: {
        // 主站（mapbox-gl + Three.js）
        main: resolve(process.cwd(), "index.html"),
        // Isolated research canvas; no ordinary App state or data loaders.
        lab: resolve(process.cwd(), "lab/index.html"),
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
      "/api/research/v1": { target: process.env.PULSE_RESEARCH_GATEWAY_ORIGIN ?? "http://127.0.0.1:8790", changeOrigin: false },
      ...(process.env.VITE_SOCIAL_STATISTICS_PREVIEW === 'true' ? {
        '/__social-statistics-cdn': {
          target: `http://127.0.0.1:${Number(process.env.SOCIAL_STATISTICS_PREVIEW_PORT || 3757)}`,
          changeOrigin: false,
          rewrite: (path: string) => path.replace(/^\/__social-statistics-cdn/, ''),
        },
      } : {}),
      "/api/private-research/coral": { target: "http://127.0.0.1:8789", changeOrigin: false },
      "/api/private-research/allen-coral-atlas": { target: "http://127.0.0.1:8796", changeOrigin: false },
      // Python preview deliberately binds localhost and has no CORS headers.
      // Expose it through Vite only under the explicit local preview opt-in.
      ...(process.env.VITE_AGRI_STATISTICS_PREVIEW === 'true' ? {
        '/__agri-statistics-preview-api': {
          target: 'http://127.0.0.1:3743',
          changeOrigin: false,
          rewrite: (path: string) => path.replace(/^\/__agri-statistics-preview-api/, ''),
        },
      } : {}),
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
