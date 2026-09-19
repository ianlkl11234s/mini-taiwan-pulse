import { createServer } from "node:http";
import { appendFile, chmod, mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { S3Client, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

export const OWNER_ID = "c5c835be-fc6c-46bb-b4b7-cb5945f57e7d";
export const EXPECTED_SIZE = 133400197;
export const EXPECTED_SHA256 = "b6b0dba6ee6923add86d86312f81131d2b25fd6cb566732f84375ab301467ea3";
export const MAX_RANGE_BYTES = 8 * 1024 * 1024;

const ALLEN_CORAL_ATLAS_ROOT = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/marine/allen_coral_atlas";
const ALLEN_CORAL_ATLAS_PATH = "/api/private-research/allen-coral-atlas";
const ALLEN_CORAL_ATLAS_S3_BUCKET = "migu-gis-data-collector";
const ALLEN_CORAL_ATLAS_S3_REGION = "ap-southeast-2";
const JP_WATER_ROOT = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/output/jp_water_national_local";
const JP_WATER_PATH = "/api/private-research/jp-water";
const JP_WATER_S3_BUCKET = "migu-private-research-ap-southeast-2";
const JP_WATER_S3_PREFIX = "private-research/jp-water";
const ALLEN_CORAL_ATLAS_PRODUCTION_REVOKE_PATH = "/data/.private-allen/revoked-sessions.jsonl";
const ALLEN_CORAL_ATLAS_ASSETS = Object.freeze({
  benthic: Object.freeze({
    filename: "allen_coral_atlas_benthic.pmtiles",
    size: 94597292,
    sha256: "c877b8183253e109330c7315e1b37ddc6119d48ae710460634d36958aaaa1119",
  }),
  geomorphic: Object.freeze({
    filename: "allen_coral_atlas_geomorphic.pmtiles",
    size: 52624835,
    sha256: "750c28a8b7ea2eff84b18d71a1b5ef80f1065c5b47fbbf98995cda47b691bd41",
  }),
});
const JP_WATER_ASSETS = Object.freeze({
  water: Object.freeze({
    filename: "water.pmtiles",
    size: 85597875,
    sha256: "dd82b5f53b95e544182c11400dc6dac17a8455bab150b0509df909c1848737da",
  }),
  "extra-water": Object.freeze({
    filename: "extra-water.pmtiles",
    size: 31656052,
    sha256: "e41775f0ae3d33c04866896b0002002d20338937d11f124c51461017409a5bf9",
  }),
});

export const ALLEN_CORAL_ATLAS_PORT = 8796;
const ALLEN_CORAL_ATLAS_REVOKE_PATH = "/private/tmp/pulse-allen-private-runtime/allen-coral-atlas-revoked-sessions.jsonl";
const ALLEN_CORAL_ATLAS_AUDIT_MAX_BYTES = 1024 * 1024;
const ALLEN_CORAL_ATLAS_AUDIT_RETAINED_FILES = 5;
const MIN_ALLEN_CORAL_ATLAS_AUDIT_MAX_BYTES = 64 * 1024;
const MAX_ALLEN_CORAL_ATLAS_AUDIT_RETAINED_FILES = 100;
const allenSnapshotCache = new Map();
const auditRetentionByPath = new Map();

export function getConfig(env = process.env) {
  const accessKeyId = firstConfigured(env.S3_ACCESS_KEY);
  const secretAccessKey = firstConfigured(env.S3_SECRET_KEY);
  const bucket = firstConfigured(env.CORAL_PRIVATE_BUCKET);
  const key = firstConfigured(env.CORAL_PRIVATE_KEY);
  const region = firstConfigured(env.CORAL_PRIVATE_REGION);
  if (!accessKeyId || !secretAccessKey || !bucket || !key || !region) {
    return { error: "configuration unavailable" };
  }

  const origins = new Set();
  for (const value of (env.CORAL_PRIVATE_ORIGINS ?? "").split(",")) {
    const origin = value.trim();
    if (!origin) continue;
    try {
      if (new URL(origin).origin !== origin) throw new Error("not an origin");
      origins.add(origin);
    } catch {
      return { error: "configuration unavailable" };
    }
  }
  return {
    accessKeyId,
    secretAccessKey,
    bucket,
    key,
    region,
    origins,
  };
}

export function getAllenCoralAtlasConfig(env = process.env) {
  const supabaseUrl = firstConfigured(env.SUPABASE_URL, env.VITE_SUPABASE_URL);
  const supabaseAnonKey = firstConfigured(env.SUPABASE_ANON_KEY, env.VITE_SUPABASE_ANON_KEY);
  if (!supabaseUrl || !supabaseAnonKey) return { error: "configuration unavailable" };

  const storage = firstConfigured(env.PRIVATE_RESEARCH_STORAGE, env.ALLEN_CORAL_ATLAS_STORAGE) ?? "local";
  if (storage !== "local" && storage !== "s3") return { error: "configuration unavailable" };
  const accessKeyId = firstConfigured(env.S3_ACCESS_KEY);
  const secretAccessKey = firstConfigured(env.S3_SECRET_KEY);
  if (storage === "s3" && (!accessKeyId || !secretAccessKey)) return { error: "configuration unavailable" };

  const origins = new Set();
  const configuredOrigins = firstConfigured(env.PRIVATE_RESEARCH_ORIGINS, env.ALLEN_CORAL_ATLAS_ORIGINS)
    ?? (storage === "local" ? "http://127.0.0.1:3721,http://localhost:3721,http://127.0.0.1:3735" : "");
  for (const value of configuredOrigins.split(",")) {
    const origin = value.trim();
    if (!origin) continue;
    try {
      if (new URL(origin).origin !== origin) throw new Error("not an origin");
      origins.add(origin);
    } catch {
      return { error: "configuration unavailable" };
    }
  }
  if (origins.size === 0) return { error: "configuration unavailable" };
  const auditPath = firstConfigured(env.PRIVATE_RESEARCH_AUDIT_PATH, env.ALLEN_CORAL_ATLAS_AUDIT_PATH);
  const auditMaxBytes = parseBoundedInteger(
    env.ALLEN_CORAL_ATLAS_AUDIT_MAX_BYTES,
    ALLEN_CORAL_ATLAS_AUDIT_MAX_BYTES,
    MIN_ALLEN_CORAL_ATLAS_AUDIT_MAX_BYTES,
    Number.MAX_SAFE_INTEGER,
  );
  const auditRetainedFiles = parseBoundedInteger(
    env.ALLEN_CORAL_ATLAS_AUDIT_RETAINED_FILES,
    ALLEN_CORAL_ATLAS_AUDIT_RETAINED_FILES,
    1,
    MAX_ALLEN_CORAL_ATLAS_AUDIT_RETAINED_FILES,
  );
  const revokePath = firstConfigured(env.PRIVATE_RESEARCH_REVOKE_PATH, env.ALLEN_CORAL_ATLAS_REVOKE_PATH)
    ?? (storage === "s3" ? ALLEN_CORAL_ATLAS_PRODUCTION_REVOKE_PATH : ALLEN_CORAL_ATLAS_REVOKE_PATH);
  if ((auditPath && (!auditPath.startsWith("/") || !auditMaxBytes || !auditRetainedFiles)) || !revokePath.startsWith("/")) return { error: "configuration unavailable" };
  return {
    supabaseUrl, supabaseAnonKey, storage, origins, auditPath, auditMaxBytes, auditRetainedFiles, revokePath,
    ...(storage === "s3" ? {
      accessKeyId,
      secretAccessKey,
      bucket: ALLEN_CORAL_ATLAS_S3_BUCKET,
      region: ALLEN_CORAL_ATLAS_S3_REGION,
    } : {}),
  };
}

function firstConfigured(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim();
}

function parseBoundedInteger(value, fallback, min, max) {
  if (value === undefined || value === "") return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function parseRange(range) {
  if (!range) return null;
  const match = /^bytes=(\d+)-(\d+)$/.exec(range.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= EXPECTED_SIZE) return null;
  if (end - start + 1 > MAX_RANGE_BYTES) return null;
  return { start, end, length: end - start + 1 };
}

function parseAssetRange(range, asset) {
  if (!range) return null;
  const match = /^bytes=(\d+)-(\d+)$/.exec(range.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= asset.size) return null;
  if (end - start + 1 > MAX_RANGE_BYTES) return null;
  return { start, end, length: end - start + 1 };
}

function corsHeaders(request, config, methods = "GET, HEAD, OPTIONS") {
  const origin = request.headers.get("origin");
  if (origin && !config.origins.has(origin)) return null;
  if (!origin) return new Headers();
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Authorization, Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, ETag",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin, Authorization, Range",
  });
}

function response(status, cors, body = null, extra = {}) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    ...Object.fromEntries(cors),
    ...extra,
  });
  return new Response(body, { status, headers });
}

function json(status, cors, value) {
  return response(status, cors, JSON.stringify(value), { "Content-Type": "application/json; charset=utf-8" });
}

function isExpectedObject(metadata) {
  if (metadata.contentLength !== EXPECTED_SIZE) return false;
  if (!metadata.etag) return false;
  if (!metadata.checksumSHA256) return false;
  return Buffer.from(metadata.checksumSHA256, "base64").toString("hex") === EXPECTED_SHA256;
}

export function createAwsGateway(config) {
  const client = new S3Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const common = { Bucket: config.bucket, Key: config.key, ChecksumMode: "ENABLED" };
  return {
    async head(signal) {
      const timed = timedSignal(signal);
      let value;
      try {
        value = await client.send(new HeadObjectCommand(common), { abortSignal: timed.signal });
      } finally {
        timed.dispose();
      }
      return {
        contentLength: value.ContentLength,
        contentType: value.ContentType,
        etag: value.ETag,
        checksumSHA256: value.ChecksumSHA256,
      };
    },
    async get(range, expectedEtag, signal) {
      const timed = timedSignal(signal);
      let value;
      try {
        value = await client.send(new GetObjectCommand({
          ...common,
          Range: `bytes=${range.start}-${range.end}`,
          IfMatch: expectedEtag,
        }), { abortSignal: timed.signal });
      } catch (error) {
        timed.dispose();
        throw error;
      }
      if (!value.Body || typeof value.Body.pipe !== "function") {
        timed.dispose();
        throw new Error("S3 returned no readable body");
      }
      return {
        body: nodeBodyToWebStream(value.Body, timed.signal, timed.dispose),
        contentLength: value.ContentLength,
        contentRange: value.ContentRange,
        etag: value.ETag,
        contentType: value.ContentType,
      };
    },
  };
}

function timedSignal(parentSignal, timeoutMs = 30_000) {
  const controller = new AbortController();
  const abort = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) abort();
  else parentSignal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("S3 request timed out")), timeoutMs);
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abort);
    },
  };
}

function nodeBodyToWebStream(body, requestSignal, dispose) {
  const source = Readable.toWeb(body);
  const reader = source.getReader();
  let finished = false;
  const abort = () => {
    if (finished) return;
    finished = true;
    dispose();
    reader.cancel().catch(() => undefined);
    body.destroy();
  };
  requestSignal?.addEventListener("abort", abort, { once: true });
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finished = true;
          requestSignal?.removeEventListener("abort", abort);
          dispose();
          controller.close();
        } else controller.enqueue(value);
      } catch (error) {
        finished = true;
        requestSignal?.removeEventListener("abort", abort);
        dispose();
        controller.error(error);
      }
    },
    cancel() { abort(); },
  });
}

export function createSupabaseAuthenticator(config) {
  return async (authorization, requestSignal) => {
    const token = /^Bearer\s+(.+)$/i.exec(authorization ?? "")?.[1];
    if (!token) return { status: 401 };
    const timed = timedSignal(requestSignal, 10_000);
    try {
      const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => fetch(input, { ...init, signal: timed.signal }) },
      });
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) return { status: 401 };
      if (data.user.id !== OWNER_ID) return { status: 403 };
      const sessionId = getSupabaseSessionId(token);
      // A real owner token without a session_id cannot participate in the local
      // revocation check, so it fails closed instead of bypassing the denylist.
      return sessionId ? { status: 200, sessionId } : { status: 401 };
    } finally {
      timed.dispose();
    }
  };
}

function getSupabaseSessionId(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof value.session_id === "string" && value.session_id.length > 0 ? value.session_id : null;
  } catch {
    return null;
  }
}

/**
 * Each exact asset is read and verified once into a process-local immutable
 * snapshot. Authentication is intentionally outside this cache and still runs
 * for every HEAD/GET/Range request.
 */
export function createAllenCoralAtlasGateway(root = ALLEN_CORAL_ATLAS_ROOT, assets = ALLEN_CORAL_ATLAS_ASSETS) {
  async function verifiedSnapshot(asset) {
    const file = resolve(root, asset.filename);
    const expectedRoot = resolve(root);
    if (!file.startsWith(`${expectedRoot}/`)) throw new Error("invalid local asset");
    if (!Object.values(assets).includes(asset)) throw new Error("invalid local asset");
    const cacheKey = `${expectedRoot}\u0000${asset.filename}`;
    let pending = allenSnapshotCache.get(cacheKey);
    if (!pending) {
      pending = (async () => {
        const snapshot = await readFile(file);
        if (snapshot.length !== asset.size) throw new Error("local asset size mismatch");
        if (createHash("sha256").update(snapshot).digest("hex") !== asset.sha256) throw new Error("local asset checksum mismatch");
        return snapshot;
      })();
      allenSnapshotCache.set(cacheKey, pending);
    }
    try {
      return await pending;
    } catch (error) {
      allenSnapshotCache.delete(cacheKey);
      throw error;
    }
  }
  return {
    async head(asset) {
      await verifiedSnapshot(asset);
      return { contentLength: asset.size, contentType: "application/octet-stream", etag: `\"${asset.sha256}\"` };
    },
    async get(asset, range) {
      const snapshot = await verifiedSnapshot(asset);
      return {
        // Copy only the requested bytes; a Response must never expose the cache Buffer.
        body: Buffer.from(snapshot.subarray(range.start, range.end + 1)),
        contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream",
        etag: `\"${asset.sha256}\"`,
      };
    },
  };
}

export function createJpWaterGateway(root = firstConfigured(process.env.JP_WATER_PRIVATE_ROOT) ?? JP_WATER_ROOT, assets = JP_WATER_ASSETS) {
  return createAllenCoralAtlasGateway(root, assets);
}

/**
 * Downloads each allowlisted immutable S3 object once, then serves only the
 * verified process-local snapshot. This cache never includes authentication:
 * handleAllenCoralAtlasRequest authenticates every request before reaching it.
 */
export function createAllenCoralAtlasS3Gateway(config, {
  client,
  assets = ALLEN_CORAL_ATLAS_ASSETS,
  prefix = "private-research/allen-coral-atlas",
  bucket = ALLEN_CORAL_ATLAS_S3_BUCKET,
} = {}) {
  const s3 = client ?? new S3Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const snapshots = new Map();

  async function verifiedSnapshot(asset, signal) {
    if (!Object.values(assets).includes(asset)) throw new Error("invalid S3 asset");
    const key = `${prefix}/${asset.sha256}/${asset.filename}`;
    let pending = snapshots.get(key);
    if (!pending) {
      pending = (async () => {
        const timed = timedSignal(signal);
        let value;
        try {
          value = await s3.send(new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            ChecksumMode: "ENABLED",
          }), { abortSignal: timed.signal });
          if (!value.Body || typeof value.Body[Symbol.asyncIterator] !== "function") throw new Error("S3 returned no readable body");
          if (value.ContentLength !== asset.size) throw new Error("S3 asset size mismatch");
          const chunks = [];
          let length = 0;
          for await (const chunk of value.Body) {
            const bytes = Buffer.from(chunk);
            length += bytes.length;
            if (length > asset.size) throw new Error("S3 asset size mismatch");
            chunks.push(bytes);
          }
          const snapshot = Buffer.concat(chunks, length);
          if (snapshot.length !== asset.size) throw new Error("S3 asset size mismatch");
          if (createHash("sha256").update(snapshot).digest("hex") !== asset.sha256) throw new Error("S3 asset checksum mismatch");
          return snapshot;
        } finally {
          timed.dispose();
          if (value?.Body?.destroy) value.Body.destroy();
        }
      })();
      snapshots.set(key, pending);
    }
    try {
      return await pending;
    } catch (error) {
      snapshots.delete(key);
      throw error;
    }
  }

  return {
    async head(asset, signal) {
      await verifiedSnapshot(asset, signal);
      return { contentLength: asset.size, contentType: "application/octet-stream", etag: `\"${asset.sha256}\"` };
    },
    async get(asset, range, signal) {
      const snapshot = await verifiedSnapshot(asset, signal);
      return {
        body: Buffer.from(snapshot.subarray(range.start, range.end + 1)),
        contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream",
        etag: `\"${asset.sha256}\"`,
      };
    },
  };
}

export function createJpWaterS3Gateway(config, options = {}) {
  return createAllenCoralAtlasS3Gateway(config, {
    assets: JP_WATER_ASSETS,
    prefix: JP_WATER_S3_PREFIX,
    bucket: JP_WATER_S3_BUCKET,
    ...options,
  });
}

const persistentDenylistByPath = new Map();
const auditWriteQueueByPath = new Map();

export function createAllenSessionDenylist(file) {
  const sessions = new Set();
  let loading;
  async function load() {
    if (loading) return loading;
    loading = (async () => {
      await mkdir(dirname(file), { recursive: true, mode: 0o700 });
      try {
        const lines = (await readFile(file, "utf8")).split("\n").filter(Boolean);
        for (const line of lines) {
          const value = JSON.parse(line);
          if (typeof value.sessionId !== "string" || !value.sessionId) throw new Error("invalid revocation record");
          sessions.add(value.sessionId);
        }
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    })();
    return loading;
  }
  return {
    async has(sessionId) { await load(); return sessions.has(sessionId); },
    async revoke(sessionId) {
      await load();
      if (sessions.has(sessionId)) return;
      await appendFile(file, `${JSON.stringify({ sessionId, revokedAt: new Date().toISOString() })}\n`, { encoding: "utf8", mode: 0o600 });
      await chmod(file, 0o600);
      sessions.add(sessionId);
    },
  };
}

function getAllenDenylist(dependencies, config) {
  if (dependencies.revocationStore) return dependencies.revocationStore;
  if (dependencies.revokedSessions) {
    return { has: async (sessionId) => dependencies.revokedSessions.has(sessionId), revoke: async (sessionId) => dependencies.revokedSessions.add(sessionId) };
  }
  let denylist = persistentDenylistByPath.get(config.revokePath);
  if (!denylist) {
    denylist = createAllenSessionDenylist(config.revokePath);
    persistentDenylistByPath.set(config.revokePath, denylist);
  }
  return denylist;
}

export async function writeAllenAuditRecord(request, output, config, audit = undefined) {
  if (!config.auditPath && !audit) return;
  const url = new URL(request.url);
  const family = url.pathname.startsWith(`${JP_WATER_PATH}/`)
    ? { path: JP_WATER_PATH, assets: JP_WATER_ASSETS }
    : { path: ALLEN_CORAL_ATLAS_PATH, assets: ALLEN_CORAL_ATLAS_ASSETS };
  const assetName = url.pathname.slice(family.path.length + 1);
  const asset = family.assets[assetName];
  const record = {
    timestamp: new Date().toISOString(),
    endpoint: url.pathname,
    asset: asset ? assetName : null,
    method: request.method,
    status: output.status,
    range: request.headers.get("range"),
    contentRange: output.headers.get("content-range"),
  };
  if (audit) return audit(record);
  const line = `${JSON.stringify(record)}\n`;
  return enqueueAllenAuditWrite(config.auditPath, async () => {
    // appendFile opens and closes each write. Serializing rotation and append keeps
    // a request from writing into a file another request has just renamed.
    await mkdir(dirname(config.auditPath), { recursive: true, mode: 0o700 });
    await rotateAllenAuditLog(config.auditPath, Buffer.byteLength(line), config.auditMaxBytes, config.auditRetainedFiles);
    await appendFile(config.auditPath, line, { encoding: "utf8", mode: 0o600 });
    await chmod(config.auditPath, 0o600);
  });
}

function enqueueAllenAuditWrite(file, write) {
  const previous = auditWriteQueueByPath.get(file) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(write);
  auditWriteQueueByPath.set(file, pending);
  return pending.finally(() => {
    if (auditWriteQueueByPath.get(file) === pending) auditWriteQueueByPath.delete(file);
  });
}

async function rotateAllenAuditLog(file, nextRecordBytes, maxBytes, retainedFiles) {
  // Retention cleanup is an initialization/config-change task. Do not issue up
  // to 99 failing rm calls for every private request once the configuration is
  // already known. Rotation below only touches generations that actually exist.
  if (auditRetentionByPath.get(file) !== retainedFiles) {
    const prefix = `${basename(file)}.`;
    const generations = await readdir(dirname(file));
    for (const entry of generations) {
      const suffix = entry.startsWith(prefix) ? entry.slice(prefix.length) : "";
      if (/^\d+$/.test(suffix) && Number(suffix) > retainedFiles) await rm(`${file}.${suffix}`);
    }
    auditRetentionByPath.set(file, retainedFiles);
  }
  let currentSize = 0;
  try {
    currentSize = (await stat(file)).size;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (currentSize + nextRecordBytes <= maxBytes) return;

  // Rename newest last, so a failed rotation never truncates the active log.
  // rename replaces only the oldest retained file; no private record is copied.
  for (let index = retainedFiles - 1; index >= 1; index -= 1) {
    try {
      await rename(`${file}.${index}`, `${file}.${index + 1}`);
      await chmod(`${file}.${index + 1}`, 0o600);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  await rename(file, `${file}.1`);
  await chmod(`${file}.1`, 0o600);
}

export async function handleAllenCoralAtlasRequest(request, dependencies = {}) {
  const url = new URL(request.url);
  const revokeRequest = url.pathname === `${ALLEN_CORAL_ATLAS_PATH}/revoke`;
  const assetName = url.pathname.startsWith(`${ALLEN_CORAL_ATLAS_PATH}/`)
    ? url.pathname.slice(ALLEN_CORAL_ATLAS_PATH.length + 1)
    : "";
  const asset = ALLEN_CORAL_ATLAS_ASSETS[assetName];
  if (!revokeRequest && (!asset || url.pathname !== `${ALLEN_CORAL_ATLAS_PATH}/${assetName}`)) return response(404, new Headers());

  const config = dependencies.config ?? getAllenCoralAtlasConfig();
  const emptyCors = new Headers();
  if (config.error) return json(503, emptyCors, { error: "service unavailable" });
  const cors = corsHeaders(request, config, "GET, HEAD, POST, OPTIONS");
  if (!cors) return json(403, emptyCors, { error: "origin forbidden" });
  if (request.method === "OPTIONS") return response(204, cors);
  if (revokeRequest && request.method !== "POST") return response(405, cors, null, { Allow: "POST, OPTIONS" });
  if (!revokeRequest && request.method !== "GET" && request.method !== "HEAD") return response(405, cors, null, { Allow: "GET, HEAD, OPTIONS" });

  const authenticate = dependencies.authenticate ?? createSupabaseAuthenticator(config);
  let identity;
  try {
    identity = await authenticate(request.headers.get("authorization"), request.signal);
  } catch {
    return json(503, cors, { error: "authentication unavailable" });
  }
  if (identity.status !== 200) return json(identity.status, cors, { error: identity.status === 401 ? "unauthorized" : "forbidden" });
  const denylist = getAllenDenylist(dependencies, config);
  let revoked;
  try {
    revoked = !identity.sessionId || await denylist.has(identity.sessionId);
  } catch {
    return json(503, cors, { error: "revocation unavailable" });
  }
  if (revoked) return json(401, cors, { error: "unauthorized" });
  if (revokeRequest) {
    try {
      await denylist.revoke(identity.sessionId);
    } catch {
      return json(503, cors, { error: "revocation unavailable" });
    }
    return json(200, cors, { revoked: true });
  }
  if (request.method === "GET" && url.searchParams.get("access") === "1") return json(200, cors, { allowed: true });

  const gateway = dependencies.gateway ?? (config.storage === "s3"
    ? createAllenCoralAtlasS3Gateway(config)
    : createAllenCoralAtlasGateway());
  let metadata;
  try {
    metadata = await gateway.head(asset, request.signal);
  } catch {
    return json(502, cors, { error: "private Allen asset integrity check failed" });
  }
  if (metadata.contentLength !== asset.size || metadata.etag !== `\"${asset.sha256}\"`) {
    return json(502, cors, { error: "private Allen asset integrity check failed" });
  }
  if (request.method === "HEAD") {
    return response(200, cors, null, {
      "Content-Length": String(asset.size), "Content-Type": metadata.contentType, "ETag": metadata.etag,
    });
  }
  const range = parseAssetRange(request.headers.get("range"), asset);
  if (!range) return response(416, cors, null, { "Content-Range": `bytes */${asset.size}` });
  let object;
  try {
    object = await gateway.get(asset, range, request.signal);
  } catch {
    return json(502, cors, { error: "private Allen asset unavailable" });
  }
  if (object.contentLength !== range.length || object.contentRange !== `bytes ${range.start}-${range.end}/${asset.size}` || object.etag !== metadata.etag) {
    if (typeof object.body?.cancel === "function") await object.body.cancel().catch(() => undefined);
    return json(502, cors, { error: "private Allen asset range check failed" });
  }
  return response(206, cors, object.body, {
    "Content-Length": String(range.length), "Content-Range": object.contentRange,
    "Content-Type": object.contentType, "ETag": object.etag,
  });
}

export async function handleJpWaterRequest(request, dependencies = {}) {
  const url = new URL(request.url);
  const assetName = url.pathname.startsWith(`${JP_WATER_PATH}/`)
    ? url.pathname.slice(JP_WATER_PATH.length + 1)
    : "";
  const asset = JP_WATER_ASSETS[assetName];
  if (!asset || url.pathname !== `${JP_WATER_PATH}/${assetName}`) return response(404, new Headers());

  const config = dependencies.config ?? getAllenCoralAtlasConfig();
  const emptyCors = new Headers();
  if (config.error) return json(503, emptyCors, { error: "service unavailable" });
  const cors = corsHeaders(request, config, "GET, HEAD, OPTIONS");
  if (!cors) return json(403, emptyCors, { error: "origin forbidden" });
  if (request.method === "OPTIONS") return response(204, cors);
  if (request.method !== "GET" && request.method !== "HEAD") return response(405, cors, null, { Allow: "GET, HEAD, OPTIONS" });

  const authenticate = dependencies.authenticate ?? createSupabaseAuthenticator(config);
  let identity;
  try {
    identity = await authenticate(request.headers.get("authorization"), request.signal);
  } catch {
    return json(503, cors, { error: "authentication unavailable" });
  }
  if (identity.status !== 200) return json(identity.status, cors, { error: identity.status === 401 ? "unauthorized" : "forbidden" });
  const denylist = getAllenDenylist(dependencies, config);
  let revoked;
  try {
    revoked = !identity.sessionId || await denylist.has(identity.sessionId);
  } catch {
    return json(503, cors, { error: "revocation unavailable" });
  }
  if (revoked) return json(401, cors, { error: "unauthorized" });
  if (request.method === "GET" && url.searchParams.get("access") === "1") return json(200, cors, { allowed: true });

  const gateway = dependencies.gateway ?? (config.storage === "s3"
    ? createJpWaterS3Gateway(config)
    : createJpWaterGateway());
  let metadata;
  try {
    metadata = await gateway.head(asset, request.signal);
  } catch {
    return json(502, cors, { error: "private Japan water asset integrity check failed" });
  }
  if (metadata.contentLength !== asset.size || metadata.etag !== `\"${asset.sha256}\"`) {
    return json(502, cors, { error: "private Japan water asset integrity check failed" });
  }
  if (request.method === "HEAD") {
    return response(200, cors, null, {
      "Content-Length": String(asset.size), "Content-Type": metadata.contentType, "ETag": metadata.etag,
    });
  }
  const range = parseAssetRange(request.headers.get("range"), asset);
  if (!range) return response(416, cors, null, { "Content-Range": `bytes */${asset.size}` });
  let object;
  try {
    object = await gateway.get(asset, range, request.signal);
  } catch {
    return json(502, cors, { error: "private Japan water asset unavailable" });
  }
  if (object.contentLength !== range.length || object.contentRange !== `bytes ${range.start}-${range.end}/${asset.size}` || object.etag !== metadata.etag) {
    if (typeof object.body?.cancel === "function") await object.body.cancel().catch(() => undefined);
    return json(502, cors, { error: "private Japan water asset range check failed" });
  }
  return response(206, cors, object.body, {
    "Content-Length": String(range.length), "Content-Range": object.contentRange,
    "Content-Type": object.contentType, "ETag": object.etag,
  });
}

export async function handleCoralRequest(request, dependencies = {}) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/private-research/coral") return response(404, new Headers());
  const config = dependencies.config ?? getConfig();
  const emptyCors = new Headers();
  if (config.error) return json(503, emptyCors, { error: "service unavailable" });
  const cors = corsHeaders(request, config);
  if (!cors) return json(403, emptyCors, { error: "origin forbidden" });
  if (request.method === "OPTIONS") return response(204, cors);
  if (request.method !== "GET" && request.method !== "HEAD") return response(405, cors, null, { Allow: "GET, HEAD, OPTIONS" });

  const gateway = dependencies.gateway ?? createAwsGateway(config);
  let metadata;
  try {
    metadata = await gateway.head(request.signal);
  } catch {
    return json(502, cors, { error: "coral object unavailable" });
  }
  if (!isExpectedObject(metadata)) return json(502, cors, { error: "coral object integrity check failed" });

  if (request.method === "HEAD") {
    return response(200, cors, null, {
      "Content-Length": String(EXPECTED_SIZE),
      "Content-Type": metadata.contentType ?? "application/octet-stream",
      "ETag": metadata.etag ?? "",
      "Cache-Control": "no-store",
    });
  }
  const range = parseRange(request.headers.get("range"));
  if (!range) return response(416, cors, null, { "Content-Range": `bytes */${EXPECTED_SIZE}` });
  let object;
  try {
    object = await gateway.get(range, metadata.etag, request.signal);
  } catch {
    return json(502, cors, { error: "coral object unavailable" });
  }
  if (object.contentLength !== range.length || object.contentRange !== `bytes ${range.start}-${range.end}/${EXPECTED_SIZE}` || object.etag !== metadata.etag) {
    await object.body.cancel().catch(() => undefined);
    return json(502, cors, { error: "coral object range check failed" });
  }
  return response(206, cors, object.body, {
    "Content-Length": String(range.length),
    "Content-Range": object.contentRange,
    "Content-Type": object.contentType ?? metadata.contentType ?? "application/octet-stream",
    "ETag": object.etag ?? metadata.etag ?? "",
    "Cache-Control": "no-store",
  });
}

export function startCoralPrivateServer({ port = 8789, host = "127.0.0.1", ...dependencies } = {}) {
  const server = createServer(async (req, res) => {
    try {
      const controller = new AbortController();
      req.once("aborted", () => controller.abort());
      res.once("close", () => {
        if (!res.writableEnded) controller.abort();
      });
      const request = new Request(`http://${req.headers.host ?? host}${req.url}`, {
        method: req.method,
        headers: req.headers,
        signal: controller.signal,
      });
      const output = await handleCoralRequest(request, dependencies);
      res.writeHead(output.status, Object.fromEntries(output.headers));
      if (!output.body || req.method === "HEAD") return res.end();
      Readable.fromWeb(output.body).on("error", () => res.destroy()).pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(500, { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      res.end();
    }
  });
  server.listen(port, host);
  return server;
}

export function startAllenCoralAtlasServer({ port = ALLEN_CORAL_ATLAS_PORT, host = "127.0.0.1", ...dependencies } = {}) {
  if (!["127.0.0.1", "::1", "localhost"].includes(host)) throw new Error("Allen Coral Atlas server must bind loopback only");
  const config = dependencies.config ?? getAllenCoralAtlasConfig();
  const allenGateway = dependencies.gateway ?? (config.storage === "s3"
    ? createAllenCoralAtlasS3Gateway(config)
    : createAllenCoralAtlasGateway());
  const jpWaterGateway = dependencies.jpWaterGateway ?? (config.storage === "s3"
    ? createJpWaterS3Gateway(config)
    : createJpWaterGateway());
  const allenDependencies = { ...dependencies, config, gateway: allenGateway };
  const jpWaterDependencies = { ...dependencies, config, gateway: jpWaterGateway };
  const readiness = {
    allen: { ready: false, failed: false },
    jpWater: { ready: false, failed: false },
  };
  const warmupAttempts = dependencies.warmupAttempts ?? 3;
  const warmupRetryDelayMs = dependencies.warmupRetryDelayMs ?? 250;
  const warmFamily = async (state, gateway, assets) => {
    for (let attempt = 0; attempt < warmupAttempts; attempt += 1) {
      try {
        await Promise.all(Object.values(assets).map((asset) => gateway.head(asset)));
        state.ready = true;
        return;
      } catch {
        if (attempt + 1 < warmupAttempts) await new Promise((resolve) => setTimeout(resolve, warmupRetryDelayMs * 2 ** attempt));
      }
    }
    state.failed = true;
  };
  // Each family is verified independently. A missing Japan-water object must
  // fail closed for that endpoint without taking the existing Allen layer down.
  const warmup = Promise.all([
    warmFamily(readiness.allen, allenGateway, ALLEN_CORAL_ATLAS_ASSETS),
    warmFamily(readiness.jpWater, jpWaterGateway, JP_WATER_ASSETS),
  ]);
  const server = createServer(async (req, res) => {
    try {
      const controller = new AbortController();
      req.once("aborted", () => controller.abort());
      res.once("close", () => { if (!res.writableEnded) controller.abort(); });
      const request = new Request(`http://${req.headers.host ?? host}${req.url}`, {
        method: req.method, headers: req.headers, signal: controller.signal,
      });
      let output;
      const pathname = new URL(request.url).pathname;
      const revokeRequest = pathname === `${ALLEN_CORAL_ATLAS_PATH}/revoke` && request.method === "POST";
      const isAllen = pathname.startsWith(`${ALLEN_CORAL_ATLAS_PATH}/`);
      const isJpWater = pathname.startsWith(`${JP_WATER_PATH}/`);
      const familyState = isJpWater ? readiness.jpWater : readiness.allen;
      if (!isAllen && !isJpWater) {
        output = response(404, new Headers());
      } else if (familyState.ready || revokeRequest) {
        output = isJpWater
          ? await handleJpWaterRequest(request, jpWaterDependencies)
          : await handleAllenCoralAtlasRequest(request, allenDependencies);
      } else {
        const cors = config.error ? new Headers() : corsHeaders(request, config, "GET, HEAD, POST, OPTIONS");
        output = !cors
          ? json(403, new Headers(), { error: "origin forbidden" })
          : json(503, cors, {
            error: familyState.failed
              ? (isJpWater ? "private Japan water sidecar unavailable" : "private Allen sidecar unavailable")
              : (isJpWater ? "private Japan water sidecar is warming up" : "private Allen sidecar is warming up"),
          });
      }
      await writeAllenAuditRecord(request, output, config, dependencies.audit);
      res.writeHead(output.status, Object.fromEntries(output.headers));
      if (!output.body || req.method === "HEAD") return res.end();
      Readable.fromWeb(output.body).on("error", () => res.destroy()).pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(500, { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      res.end();
    }
  });
  server.listen(port, host);
  void warmup;
  return server;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  startCoralPrivateServer();
  startAllenCoralAtlasServer();
}
