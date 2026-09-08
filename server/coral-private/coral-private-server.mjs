import { createServer } from "node:http";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { S3Client, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

export const OWNER_ID = "c5c835be-fc6c-46bb-b4b7-cb5945f57e7d";
export const EXPECTED_SIZE = 133400197;
export const EXPECTED_SHA256 = "b6b0dba6ee6923add86d86312f81131d2b25fd6cb566732f84375ab301467ea3";
export const MAX_RANGE_BYTES = 8 * 1024 * 1024;

export function getConfig(env = process.env) {
  const supabaseUrl = firstConfigured(env.SUPABASE_URL, env.VITE_SUPABASE_URL);
  const supabaseAnonKey = firstConfigured(env.SUPABASE_ANON_KEY, env.VITE_SUPABASE_ANON_KEY);
  const accessKeyId = firstConfigured(env.S3_ACCESS_KEY);
  const secretAccessKey = firstConfigured(env.S3_SECRET_KEY);
  const bucket = firstConfigured(env.CORAL_PRIVATE_BUCKET);
  const key = firstConfigured(env.CORAL_PRIVATE_KEY);
  const region = firstConfigured(env.CORAL_PRIVATE_REGION);
  if (!supabaseUrl || !supabaseAnonKey || !accessKeyId || !secretAccessKey || !bucket || !key || !region) {
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
    supabaseUrl,
    supabaseAnonKey,
    accessKeyId,
    secretAccessKey,
    bucket,
    key,
    region,
    origins,
  };
}

function firstConfigured(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim();
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

function corsHeaders(request, config) {
  const origin = request.headers.get("origin");
  if (origin && !config.origins.has(origin)) return null;
  if (!origin) return new Headers();
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
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
      return data.user.id === OWNER_ID ? { status: 200 } : { status: 403 };
    } finally {
      timed.dispose();
    }
  };
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

  const authenticate = dependencies.authenticate ?? createSupabaseAuthenticator(config);
  let identity;
  try {
    identity = await authenticate(request.headers.get("authorization"), request.signal);
  } catch {
    return json(503, cors, { error: "authentication unavailable" });
  }
  if (identity.status !== 200) return json(identity.status, cors, { error: identity.status === 401 ? "unauthorized" : "forbidden" });

  if (request.method === "GET" && url.searchParams.get("access") === "1") return json(200, cors, { allowed: true });

  const gateway = dependencies.gateway ?? createAwsGateway(config);
  let metadata;
  try {
    metadata = await gateway.head(request.signal);
  } catch {
    return json(502, cors, { error: "private object unavailable" });
  }
  if (!isExpectedObject(metadata)) return json(502, cors, { error: "private object integrity check failed" });

  if (request.method === "HEAD") {
    return response(200, cors, null, {
      "Content-Length": String(EXPECTED_SIZE),
      "Content-Type": metadata.contentType ?? "application/octet-stream",
      "ETag": metadata.etag ?? "",
    });
  }
  const range = parseRange(request.headers.get("range"));
  if (!range) return response(416, cors, null, { "Content-Range": `bytes */${EXPECTED_SIZE}` });
  let object;
  try {
    object = await gateway.get(range, metadata.etag, request.signal);
  } catch {
    return json(502, cors, { error: "private object unavailable" });
  }
  if (object.contentLength !== range.length || object.contentRange !== `bytes ${range.start}-${range.end}/${EXPECTED_SIZE}` || object.etag !== metadata.etag) {
    await object.body.cancel().catch(() => undefined);
    return json(502, cors, { error: "private object range check failed" });
  }
  return response(206, cors, object.body, {
    "Content-Length": String(range.length),
    "Content-Range": object.contentRange,
    "Content-Type": object.contentType ?? metadata.contentType ?? "application/octet-stream",
    "ETag": object.etag ?? metadata.etag ?? "",
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

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) startCoralPrivateServer();
