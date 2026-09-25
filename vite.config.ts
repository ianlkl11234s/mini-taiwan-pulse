import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream } from "node:fs";
import { readFile, rm, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import schoolsGridReceipt from "./src/research/contracts/schools-grid-receipt.json";
import { parseSingleByteRange } from "./src/data/gfwV4Range";
import { buildLayerSearchIndex } from "./src/lib/layerSearch";
import {
  parseLayerScreeningRunPayload,
  runLayerScreening,
} from "./scripts/research/jev-layer-screening-run";

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

const JEV_RUN_BODY_LIMIT_BYTES = 2_048;
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function isLoopbackRequest(request: { socket: { remoteAddress?: string } }): boolean {
  return LOOPBACK_ADDRESSES.has(request.socket.remoteAddress ?? "");
}

function isOwnerLocalRequest(request: { socket: { remoteAddress?: string }; headers: { host?: string } }): boolean {
  const host = request.headers.host?.replace(/:\d+$/, "");
  return isLoopbackRequest(request) && ["127.0.0.1", "localhost", "[::1]"].includes(host ?? "");
}

function sendJson(response: { statusCode: number; setHeader(name: string, value: string): void; end(body?: string): void }, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "private, no-store");
  response.end(JSON.stringify(body));
}

async function readBoundedJsonBody(request: AsyncIterable<Uint8Array> & { headers: { [key: string]: string | string[] | undefined } }): Promise<unknown> {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > JEV_RUN_BODY_LIMIT_BYTES) throw new Error("REQUEST_TOO_LARGE");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.byteLength;
    if (total > JEV_RUN_BODY_LIMIT_BYTES) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("INVALID_JSON");
  }
}

/** Dev-only loopback readback and real Jev query bridge. API credentials stay server-side. */
function serveJevLayerScreeningReceipt(): Plugin {
  const configuredPath = process.env.PULSE_JEV_SCREENING_RECEIPT;
  const receiptPath = configuredPath ? resolve(configuredPath) : null;
  let latestReceipt: unknown = null;
  let activeRun: Promise<unknown> | null = null;
  const devScreeningIndex = buildLayerSearchIndex({ includeLocalComparisonRecipes: true });
  return {
    name: "serve-jev-layer-screening-receipt",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/research/v1/jev/layer-screening/latest", (request, response, next) => {
        if (!isLoopbackRequest(request) || request.method !== "GET") {
          response.statusCode = 403;
          response.end("Local receipt readback only");
          return;
        }
        if (latestReceipt) {
          sendJson(response, 200, latestReceipt);
          return;
        }
        if (!receiptPath) return next();
        void readFile(receiptPath, "utf8").then((body) => {
          response.statusCode = 200;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.setHeader("cache-control", "private, no-store");
          response.end(body);
        }).catch(() => {
          response.statusCode = 404;
          response.end("Jev screening receipt unavailable");
        });
      });

      server.middlewares.use("/api/research/v1/jev/layer-screening/run", (request, response) => {
        if (!isLoopbackRequest(request)) {
          sendJson(response, 403, { error: "LOCAL_ONLY" });
          return;
        }
        if (request.method !== "POST") {
          response.setHeader("allow", "POST");
          sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
          return;
        }
        if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
          sendJson(response, 415, { error: "JSON_REQUIRED" });
          return;
        }
        if (activeRun) {
          sendJson(response, 409, { error: "RUN_IN_PROGRESS" });
          return;
        }

        const run = readBoundedJsonBody(request)
          .then(parseLayerScreeningRunPayload)
          .then(({ query, relevanceThreshold }) => runLayerScreening({ query, relevanceThreshold, index: devScreeningIndex }));
        activeRun = run;
        void run.then((receipt) => {
          latestReceipt = receipt;
          sendJson(response, 200, receipt);
        }).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
          if (message === "REQUEST_TOO_LARGE") sendJson(response, 413, { error: message });
          else if (message === "INVALID_JSON" || /query/i.test(message)) sendJson(response, 400, { error: message });
          else if (message === "OPENROUTER_API_KEY is not configured") sendJson(response, 503, { error: "PROVIDER_NOT_CONFIGURED" });
          else sendJson(response, 502, { error: "SCREENING_RUN_FAILED" });
        }).finally(() => {
          activeRun = null;
        });
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

/** The paired dev server may inherit another checkout's publicDir; serve pinned sidecars from this worktree. */
function serveResearchAnalysisSidecars(): Plugin {
  return {
    name: "serve-research-analysis-sidecars", apply: "serve",
    configureServer(server) {
      const assets = new Map([
        ["/urban/urban_zoning_taipei.analysis.json", { target: resolve(process.cwd(), "public/urban/urban_zoning_taipei.analysis.json"), contentType: "application/json; charset=utf-8" }],
        ["/research/retail_markets_tgos_20260717.geojson", { target: resolve(process.cwd(), "public/research/retail_markets_tgos_20260717.geojson"), contentType: "application/geo+json; charset=utf-8" }],
        ["/research/gov_service_offices_tgos_20260717.geojson", { target: resolve(process.cwd(), "public/research/gov_service_offices_tgos_20260717.geojson"), contentType: "application/geo+json; charset=utf-8" }],
        ["/research/welfare_centers_upstream_20260812.geojson", { target: resolve(process.cwd(), "public/research/welfare_centers_upstream_20260812.geojson"), contentType: "application/geo+json; charset=utf-8" }],
        ["/research/forest-roads/forest-roads-2d.geojson", { target: resolve(process.cwd(), "public/research/forest-roads/forest-roads-2d.geojson"), contentType: "application/geo+json; charset=utf-8" }],
        ["/environment/public_toilets_national.geojson", { target: resolve(process.cwd(), "public/environment/public_toilets_national.geojson"), contentType: "application/geo+json; charset=utf-8" }],
        ["/research/sports-venues-source-20260704.geojson", { target: resolve(process.cwd(), "public/research/sports-venues-source-20260704.geojson"), contentType: "application/geo+json; charset=utf-8" }],
        ["/civic_facilities/community_centers_national.geojson", { target: resolve(process.cwd(), "public/civic_facilities/community_centers_national.geojson"), contentType: "application/geo+json; charset=utf-8" }],
        ["/research/community-centers-listed-source-20260717.geojson", { target: resolve(process.cwd(), "public/research/community-centers-listed-source-20260717.geojson"), contentType: "application/geo+json; charset=utf-8" }],
        ["/environment/sound_camera_locations.geojson", { target: resolve(process.cwd(), "public/environment/sound_camera_locations.geojson"), contentType: "application/geo+json; charset=utf-8" }],
        ["/environment/official_noise_monitoring.geojson", { target: resolve(process.cwd(), "public/environment/official_noise_monitoring.geojson"), contentType: "application/geo+json; charset=utf-8" }],
        ["/research/amusement-parks-source-20260723.geojson", { target: resolve(process.cwd(), "public/research/amusement-parks-source-20260723.geojson"), contentType: "application/geo+json; charset=utf-8" }],
        ["/tourism/camping_national.geojson", { target: resolve(process.cwd(), "public/tourism/camping_national.geojson"), contentType: "application/geo+json; charset=utf-8" }],
        ["/research/tour-attractions-source-20260722.geojson", { target: resolve(process.cwd(), "public/research/tour-attractions-source-20260722.geojson"), contentType: "application/geo+json; charset=utf-8" }],
      ]);
      server.middlewares.use((request, response, next) => {
        const asset = assets.get((request.url ?? "").split("?", 1)[0]);
        if (!asset) return next();
        if (!["GET", "HEAD"].includes(request.method ?? "")) { response.statusCode = 405; response.end(); return; }
        void stat(asset.target).then(info => {
          if (!info.isFile()) { response.statusCode = 404; response.end(); return; }
          response.statusCode = 200;
          response.setHeader("content-type", asset.contentType);
          response.setHeader("content-length", info.size);
          response.setHeader("cache-control", "no-cache");
          response.setHeader("x-content-type-options", "nosniff");
          if (request.method === "HEAD") { response.end(); return; }
          createReadStream(asset.target).pipe(response);
        }).catch(() => { response.statusCode = 404; response.end(); });
      });
    },
  };
}

/** Local-only content-addressed point shards; never copied into production assets. */
function serveResearchPointPartitions(): Plugin {
  return {
    name: "serve-research-point-partitions", apply: "serve",
    configureServer(server) {
      const root = resolve(process.cwd(), "../runtime/point-partitions/schools");
      const penaltyRoot = resolve(process.cwd(), "../runtime/point-partitions/pollution-penalties");
      const companyRoot = resolve(process.cwd(), "../runtime/point-partitions/company-points");
      server.middlewares.use("/__local-research-boundaries", (request, response) => {
        const analyticsRoot = process.env.PULSE_RESEARCH_ANALYTICS_ROOT;
        if (!isLoopbackRequest(request) || !analyticsRoot || !["GET", "HEAD"].includes(request.method ?? "") || (request.url ?? "").split("?", 1)[0] !== "/county.geojson") {
          response.statusCode = 404; response.end("Local boundary unavailable"); return;
        }
        const target = resolve(analyticsRoot, "data/processed/demographics/county_boundary/county_boundary_20260626.geojson");
        void stat(target).then(info => {
          if (!info.isFile() || info.size > 16 * 1024 * 1024) throw new Error("BOUNDARY_SIZE_LIMIT");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local boundary unavailable"); });
      });
      server.middlewares.use("/__local-research-point-partitions/schools", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isLoopbackRequest(request) || !['GET', 'HEAD'].includes(request.method ?? '') || !/^(?:manifest\.json|[a-f0-9]{64}\.geojson)$/.test(name)) {
          response.statusCode = 404; response.end("Partition unavailable"); return;
        }
        const target = resolve(root, name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error("PARTITION_SIZE_LIMIT");
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local partition not built"); });
      });
      server.middlewares.use("/__local-research-point-partitions/pollution-penalties", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || !/^(?:manifest\.json|[a-f0-9]{64}\.geojson\.gz)$/.test(name)) {
          response.statusCode = 404; response.end("Partition unavailable"); return;
        }
        const target = resolve(penaltyRoot, name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error("PARTITION_SIZE_LIMIT");
          response.setHeader("content-type", name.endsWith(".gz") ? "application/octet-stream" : "application/json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local partition not built"); });
      });
      server.middlewares.use("/__local-research-point-partitions/company-points", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || !/^(?:manifest\.json|[a-f0-9]{64}\.geojson\.gz)$/.test(name)) {
          response.statusCode = 404; response.end("Partition unavailable"); return;
        }
        const target = resolve(companyRoot, name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error("PARTITION_SIZE_LIMIT");
          response.setHeader("content-type", name.endsWith(".gz") ? "application/octet-stream" : "application/json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local partition not built"); });
      });
      server.middlewares.use("/__local-research-owner-only/cultural-museums", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || name !== "cultural-museums-owner-20260716.geojson") {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/cultural-museums", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== 82_332) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/performing-venues", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || name !== "performing-venues-source-20260716.geojson") {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/performing-venues", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== 246_916) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/fire-stations", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || name !== "fire-stations-source-20260710.geojson") {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/fire-stations", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== 220_252) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/welfare-geocoded", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        const sizes: Record<string, number> = {
          "welfare-childcare-owner-20260925.geojson": 722_953,
          "welfare-disability-owner-20260925.geojson": 162_539,
          "welfare-social-work-orgs-owner-20260925.geojson": 272_434,
        };
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || !Object.hasOwn(sizes, name)) {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/welfare-geocoded", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== sizes[name]) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/welfare-care", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        const sizes: Record<string, number> = {
          "welfare-ltc-institutions-owner-20260925.geojson": 1_567_510,
          "welfare-elderly-care-homes-owner-20260925.geojson": 564_496,
        };
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || !Object.hasOwn(sizes, name)) {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/welfare-care", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== sizes[name]) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/edu-schools", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || name !== "taiwan-schools-2024-owner.geojson") {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/edu-schools", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== 1_137_718) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/welfare-child-services", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || name !== "welfare-child-services-owner-20260812.geojson") {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/welfare-child-services", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== 570_209) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/arts-events", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || name !== "arts-events-owner-20260716.geojson") {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/arts-events", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== 2_952_774) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/rail-stations", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || name !== "rail-stations-owner-20260529.geojson") {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/rail-stations", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== 127_864) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      const justiceFiles: Record<string, number> = {
        "anti-corruption-offices-owner-20260626.geojson": 21_661,
        "correctional-facilities-owner-20260626.geojson": 18_545,
        "courts-owner-20260626.geojson": 11_163,
        "immigration-offices-owner-20260626.geojson": 7_148,
        "investigation-bureau-owner-20260626.geojson": 8_459,
        "prosecutors-offices-owner-20260626.geojson": 9_805,
      };
      server.middlewares.use("/__local-research-owner-only/justice-facilities", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        const expectedSize = justiceFiles[name];
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || expectedSize === undefined) {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/justice-facilities", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== expectedSize) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/bus-stations", (request, response) => {
        const path = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        const match = /^(city|intercity)\/(manifest\.json|[a-f0-9]{64}\.geojson\.gz)$/.exec(path);
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || !match) {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/bus-stations", match[1]!, match[2]!);
        void stat(target).then(info => {
          if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", match[2] === "manifest.json" ? "application/json; charset=utf-8" : "application/octet-stream");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/factory-locations", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || !/^(?:manifest\.json|[a-f0-9]{64}\.geojson\.gz)$/.test(name)) {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/factory-locations", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", name === "manifest.json" ? "application/json; charset=utf-8" : "application/octet-stream");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      const educationChildcareFiles: Record<string, number> = {
        "kindergartens-20260807-owner.geojson": 2_499_964,
        "afterschool-care-20260807-owner.geojson": 249_665,
        "mutual-care-20260807-owner.geojson": 70_734,
      };
      server.middlewares.use("/__local-research-owner-only/education-childcare", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        const expectedSize = educationChildcareFiles[name];
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || expectedSize === undefined) {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/education-childcare", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== expectedSize) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/tourism-hospitality", (request, response) => {
        const path = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        const match = /^(hotels|restaurants)\/(manifest\.json|[a-f0-9]{64}\.geojson\.gz)$/.exec(path);
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || !match) {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/tourism-hospitality", match[1]!, match[2]!);
        void stat(target).then(info => {
          if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", match[2] === "manifest.json" ? "application/json; charset=utf-8" : "application/octet-stream");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/civil-defense-shelters", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || !/^(?:manifest\.json|[a-f0-9]{64}\.geojson\.gz)$/.test(name)) {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/civil-defense-shelters", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", name === "manifest.json" ? "application/json; charset=utf-8" : "application/octet-stream");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/tourism-factories", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || name !== "tourism-factories-owner-20260723.geojson") {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/tourism-factories", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== 42_279) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/agri-wholesale-market", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || name !== "agri-wholesale-market-owner-20260525.geojson") {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/agri-wholesale-market", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== 13_665) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/justice-event-points", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || name !== "women-child-warning-owner-20260626.geojson") {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/justice-event-points", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== 45_334) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/funeral-points", (request, response) => {
        const path = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        const match = /^(facilities|operators)\/(manifest\.json|[a-f0-9]{64}\.geojson\.gz)$/.exec(path);
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || !match) {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/funeral-points", match[1]!, match[2]!);
        void stat(target).then(info => {
          if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", match[2] === "manifest.json" ? "application/json; charset=utf-8" : "application/octet-stream");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      const religionPointFiles: Record<string, number> = {
        "ancestral-halls-owner-20260801.geojson": 71_208,
        "churches-owner-20260801.geojson": 888_016,
        "other-worship-owner-20260801.geojson": 419_876,
        "foundations-owner-20260801.geojson": 60_994,
        "top100-owner-20260122.geojson": 34_681,
      };
      server.middlewares.use("/__local-research-owner-only/religion-points", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        const expectedSize = religionPointFiles[name];
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || expectedSize === undefined) {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/religion-points", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== expectedSize) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      const mountainPointFiles: Record<string, number> = {
        "mountain-huts-owner-20260801.geojson": 41_240,
        "mountain-rescue-incidents-owner-20260801.geojson": 761_338,
      };
      server.middlewares.use("/__local-research-owner-only/mountain-points", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        const expectedSize = mountainPointFiles[name];
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || expectedSize === undefined) {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/mountain-points", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== expectedSize) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/nursing-homes", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || name !== "nursing-homes-owner-20260812.geojson") {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/nursing-homes", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== 534_670) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
      server.middlewares.use("/__local-research-owner-only/common-registration-addresses", (request, response) => {
        const name = (request.url ?? "").split("?", 1)[0]?.replace(/^\//, "") ?? "";
        if (!isOwnerLocalRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || name !== "common-registration-addresses-owner-202608-r2.geojson") {
          response.statusCode = 404; response.end("Local source unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/owner-only/common-registration-addresses", name);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== 2_688_498) throw new Error("LOCAL_SOURCE_SIZE");
          response.setHeader("content-type", "application/geo+json; charset=utf-8");
          response.setHeader("content-length", info.size);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target);
          response.on("close", () => stream.destroy());
          stream.on("error", () => response.destroy());
          stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local source unavailable"); });
      });
    },
  };
}

/** Fixed local-only population artifact; the app verifies its SHA and raw-boundary SHA. */
function serveLocalPopulationPreview(): Plugin {
  const artifacts: Record<string, number> = {
    "dceed8b079fb7949c63b368b52b062fdf622bcfbadca7265bc41a2bba72973f5.json": 4_733,
    "92cf23066a18a71ec1b80e863ffaee53d6e24186a59a5d77fe7923ed6d86d2db.json": 4_758,
    "8d1ff350007932ac57fa5a70fbec60238ca6b2b70f4459e616d387dd99100165.json": 4_770,
  };
  return {
    name: "serve-local-population-preview", apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__local-research-population-preview", (request, response) => {
        const artifact = (request.url ?? "").split("?", 1)[0]?.slice(1) ?? "";
        if (process.env.VITE_RESEARCH_POPULATION_PREVIEW !== "1" || !isLoopbackRequest(request) || !["GET", "HEAD"].includes(request.method ?? "") || !Object.hasOwn(artifacts, artifact)) {
          response.statusCode = 404; response.end("Local population preview unavailable"); return;
        }
        const target = resolve(process.cwd(), "../runtime/population-preview", artifact);
        void stat(target).then(info => {
          if (!info.isFile() || info.size !== artifacts[artifact]) throw new Error("POPULATION_PREVIEW_SIZE");
          response.statusCode = 200; response.setHeader("content-type", "application/json; charset=utf-8"); response.setHeader("content-length", info.size);
          response.setHeader("cache-control", "private, no-store"); response.setHeader("x-content-type-options", "nosniff");
          if (request.method === "HEAD") { response.end(); return; }
          const stream = createReadStream(target); response.on("close", () => stream.destroy()); stream.on("error", () => response.destroy()); stream.pipe(response);
        }).catch(() => { response.statusCode = 404; response.end("Local population preview unavailable"); });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    serveLocalResearchAssets(),
    serveResearchAnalysisSidecars(),
    serveResearchPointPartitions(),
    serveLocalPopulationPreview(),
    serveGfwV4CandidateStage(),
    serveAgriStatisticsPreviewBoundaries(),
    serveJevLayerScreeningReceipt(),
    stripBuildAssets([
      "jp-heights", // Local height pilot assets are published independently.
      // Owner-local historical flight samples; publish separately only after data-rights acceptance.
      "flight-trails",
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
        // Isolated metadata-only layer relevance replay; does not mount the main map.
        "jev-layer-screening": resolve(process.cwd(), "jev-layer-screening.html"),
      },
    },
  },
  server: {
    port: 3721,
    strictPort: true,
    proxy: {
      "/api/research/v1": { target: process.env.PULSE_RESEARCH_GATEWAY_ORIGIN ?? "http://127.0.0.1:8790", changeOrigin: false },
      "/__statistics-cdn": {
        target: "https://data.itsmigu.com",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/__statistics-cdn/, "/statistics/v1"),
      },
      ...(process.env.VITE_SOCIAL_STATISTICS_PREVIEW === 'true' ? {
        '/__social-statistics-cdn': {
          target: `http://127.0.0.1:${Number(process.env.SOCIAL_STATISTICS_PREVIEW_PORT || 3757)}`,
          changeOrigin: false,
          rewrite: (path: string) => path.replace(/^\/__social-statistics-cdn/, ''),
        },
      } : {}),
      "/api/private-research/coral": { target: "http://127.0.0.1:8789", changeOrigin: false },
      "/api/private-research/allen-coral-atlas": { target: "http://127.0.0.1:8796", changeOrigin: false },
      "/api/private-research/jp-water": { target: "http://127.0.0.1:8796", changeOrigin: false },
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
