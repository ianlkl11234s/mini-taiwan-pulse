import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { once } from "node:events";
import test from "node:test";
import {
  ALLEN_CORAL_ATLAS_PORT,
  EXPECTED_SHA256,
  EXPECTED_SIZE,
  MAX_RANGE_BYTES,
  createAllenCoralAtlasGateway,
  createAllenCoralAtlasS3Gateway,
  createJpWaterS3Gateway,
  createAllenSessionDenylist,
  getAllenCoralAtlasConfig,
  getConfig,
  handleAllenCoralAtlasRequest,
  handleCoralRequest,
  handleJpWaterRequest,
  parseRange,
  startAllenCoralAtlasServer,
  writeAllenAuditRecord,
} from "../coral-private-server.mjs";

const checksumSHA256 = Buffer.from(EXPECTED_SHA256, "hex").toString("base64");
const config = {
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "test-key",
  accessKeyId: "test-access",
  secretAccessKey: "test-secret",
  bucket: "migu-gis-data-collector",
  key: "private-research/coral-reef/v4.1/coral_reef_distribution_global.pmtiles",
  region: "ap-southeast-2",
  origins: new Set(["https://pulse.example.test"]),
};

function request(path = "/api/private-research/coral", options = {}) {
  return new Request(`https://pulse.example.test${path}`, options);
}

function gateway(overrides = {}) {
  const calls = { head: 0, get: 0, ifMatch: null };
  return {
    calls,
    head: async () => {
      calls.head += 1;
      return { contentLength: EXPECTED_SIZE, checksumSHA256, contentType: "application/octet-stream", etag: '"coral-etag"', ...overrides.head };
    },
    get: async (range, ifMatch) => {
      calls.get += 1;
      calls.ifMatch = ifMatch;
      return {
        body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("data")); controller.close(); } }),
        contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${EXPECTED_SIZE}`,
        contentType: "application/octet-stream",
        etag: '"coral-etag"',
        ...overrides.get,
      };
    },
  };
}

const allenOwner = async () => ({ status: 200, sessionId: "owner-session" });
const allenConfig = {
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "test-key",
  origins: new Set(["https://pulse.example.test"]),
};
const allenRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/marine/allen_coral_atlas";

function allenRequest(asset = "benthic", options = {}) {
  return request(`/api/private-research/allen-coral-atlas/${asset}`, options);
}

function jpWaterRequest(asset = "water", options = {}) {
  return request(`/api/private-research/jp-water/${asset}`, options);
}

test("Range accepts exactly one bounded byte range", () => {
  assert.deepEqual(parseRange("bytes=0-0"), { start: 0, end: 0, length: 1 });
  assert.equal(parseRange(`bytes=0-${MAX_RANGE_BYTES - 1}`).length, MAX_RANGE_BYTES);
  assert.equal(parseRange("bytes=0-"), null);
  assert.equal(parseRange("bytes=-100"), null);
  assert.equal(parseRange("bytes=0-1,4-5"), null);
  assert.equal(parseRange(`bytes=0-${MAX_RANGE_BYTES}`), null);
});

test("public coral settings only require the S3 gateway configuration", () => {
  const resolved = getConfig({
    S3_ACCESS_KEY: "access-key",
    S3_SECRET_KEY: "secret-key",
    CORAL_PRIVATE_BUCKET: "migu-gis-data-collector",
    CORAL_PRIVATE_KEY: "private-research/coral-reef/v4.1/coral.pmtiles",
    CORAL_PRIVATE_REGION: "ap-southeast-2",
  });
  assert.equal(resolved.bucket, "migu-gis-data-collector");
});

test("missing configuration fails closed", async () => {
  const output = await handleCoralRequest(request(), { config: { error: "configuration unavailable" } });
  assert.equal(output.status, 503);
  assert.equal(output.headers.get("cache-control"), "private, no-store");
});

test("only the coral endpoint is served", async () => {
  const output = await handleCoralRequest(request("/api/private-research/other"), { config });
  assert.equal(output.status, 404);
});

test("CORS only reflects an exact configured origin", async () => {
  const denied = await handleCoralRequest(request("/api/private-research/coral", { headers: { Origin: "https://attacker.example" } }), { config });
  assert.equal(denied.status, 403);
  const options = await handleCoralRequest(request("/api/private-research/coral", { method: "OPTIONS", headers: { Origin: "https://pulse.example.test" } }), { config });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-origin"), "https://pulse.example.test");
  assert.equal(options.headers.get("access-control-allow-headers"), "Authorization, Range");
});

test("anonymous requests are allowed only through verified metadata and bounded Range reads", async () => {
  const s3 = gateway();
  const output = await handleCoralRequest(request("/api/private-research/coral", { headers: { Range: "bytes=0-3" } }), {
    config,
    gateway: s3,
    authenticate: async () => { throw new Error("legacy coral must not authenticate"); },
  });
  assert.equal(output.status, 206);
  assert.equal(s3.calls.head, 1);
  assert.equal(s3.calls.get, 1);
});

test("HEAD returns verified public metadata without fetching object bytes", async () => {
  const s3 = gateway();
  const output = await handleCoralRequest(request("/api/private-research/coral", { method: "HEAD" }), { config, gateway: s3 });
  assert.equal(output.status, 200);
  assert.equal(output.headers.get("content-length"), String(EXPECTED_SIZE));
  assert.equal(output.headers.get("etag"), '"coral-etag"');
  assert.equal(s3.calls.head, 1);
  assert.equal(s3.calls.get, 0);
});

test("GET requires Range and proxies only the verified byte window", async () => {
  const s3 = gateway();
  const missingRange = await handleCoralRequest(request(), { config, gateway: s3 });
  assert.equal(missingRange.status, 416);
  assert.equal(missingRange.headers.get("content-range"), `bytes */${EXPECTED_SIZE}`);

  const output = await handleCoralRequest(request("/api/private-research/coral", { headers: { Range: "bytes=0-3" } }), { config, gateway: s3 });
  assert.equal(output.status, 206);
  assert.equal(output.headers.get("content-range"), `bytes 0-3/${EXPECTED_SIZE}`);
  assert.equal(output.headers.get("content-length"), "4");
  assert.equal(output.headers.get("cache-control"), "no-store");
  assert.equal(await output.text(), "data");
  assert.equal(s3.calls.get, 1);
  assert.equal(s3.calls.ifMatch, '"coral-etag"');
});

test("integrity and S3 range mismatches fail closed", async () => {
  const wrongChecksum = gateway({ head: { checksumSHA256: Buffer.from("wrong").toString("base64") } });
  const integrity = await handleCoralRequest(request("/api/private-research/coral", { method: "HEAD" }), { config, gateway: wrongChecksum });
  assert.equal(integrity.status, 502);

  const wrongRange = gateway({ get: { contentRange: `bytes 1-4/${EXPECTED_SIZE}` } });
  const range = await handleCoralRequest(request("/api/private-research/coral", { headers: { Range: "bytes=0-3" } }), { config, gateway: wrongRange });
  assert.equal(range.status, 502);
});

test("Allen local configuration needs Supabase auth only, never legacy S3 settings", () => {
  const resolved = getAllenCoralAtlasConfig({
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_ANON_KEY: "anon-key",
  });
  assert.equal(resolved.supabaseUrl, "https://example.supabase.co");
  assert.equal(resolved.supabaseAnonKey, "anon-key");
  assert.equal(resolved.origins.has("http://127.0.0.1:3735"), true);
  assert.equal(ALLEN_CORAL_ATLAS_PORT, 8796);
});

test("Allen S3 configuration requires explicit origins and reuses S3 credentials", () => {
  const base = {
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_ANON_KEY: "anon-key",
    ALLEN_CORAL_ATLAS_STORAGE: "s3",
    S3_ACCESS_KEY: "access-key",
    S3_SECRET_KEY: "secret-key",
  };
  assert.equal(getAllenCoralAtlasConfig(base).error, "configuration unavailable");
  const resolved = getAllenCoralAtlasConfig({ ...base, ALLEN_CORAL_ATLAS_ORIGINS: "https://pulse.example.test" });
  assert.equal(resolved.storage, "s3");
  assert.equal(resolved.bucket, "migu-gis-data-collector");
  assert.equal(resolved.region, "ap-southeast-2");
  assert.equal(resolved.revokePath, "/data/.private-allen/revoked-sessions.jsonl");
  assert.equal(resolved.origins.has("https://pulse.example.test"), true);
});

test("Allen audit rotation settings are bounded and reject invalid values", () => {
  const base = {
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_ANON_KEY: "anon-key",
    ALLEN_CORAL_ATLAS_AUDIT_PATH: "/tmp/allen-audit.jsonl",
  };
  const resolved = getAllenCoralAtlasConfig({
    ...base,
    ALLEN_CORAL_ATLAS_AUDIT_MAX_BYTES: "65536",
    ALLEN_CORAL_ATLAS_AUDIT_RETAINED_FILES: "2",
  });
  assert.equal(resolved.auditMaxBytes, 65536);
  assert.equal(resolved.auditRetainedFiles, 2);
  assert.equal(getAllenCoralAtlasConfig({ ...base, ALLEN_CORAL_ATLAS_AUDIT_MAX_BYTES: "65535" }).error, "configuration unavailable");
  assert.equal(getAllenCoralAtlasConfig({ ...base, ALLEN_CORAL_ATLAS_AUDIT_RETAINED_FILES: "0" }).error, "configuration unavailable");
});

test("Allen S3 gateway fully verifies immutable snapshots before serving ranges", async () => {
  const bytes = Buffer.from("verified-s3-snapshot");
  const asset = Object.freeze({
    filename: "asset.pmtiles",
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  const calls = [];
  const client = {
    async send(command) {
      calls.push(command.input);
      return { ContentLength: bytes.length, Body: Readable.from([bytes]) };
    },
  };
  const gateway = createAllenCoralAtlasS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client,
    assets: { benthic: asset },
  });
  const metadata = await gateway.head(asset);
  const object = await gateway.get(asset, { start: 0, end: 7, length: 8 });
  assert.equal(metadata.etag, `\"${asset.sha256}\"`);
  assert.equal(object.body.toString(), "verified");
  assert.deepEqual(calls, [{
    Bucket: "migu-gis-data-collector",
    Key: `private-research/allen-coral-atlas/${asset.sha256}/asset.pmtiles`,
    ChecksumMode: "ENABLED",
  }]);
});

test("Allen S3 gateway rejects a complete read with a wrong immutable digest", async () => {
  const asset = Object.freeze({
    filename: "asset.pmtiles",
    size: 4,
    sha256: createHash("sha256").update("good").digest("hex"),
  });
  const gateway = createAllenCoralAtlasS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: { async send() { return { ContentLength: 4, Body: Readable.from([Buffer.from("evil")]) }; } },
    assets: { benthic: asset },
  });
  await assert.rejects(() => gateway.head(asset), /checksum mismatch/);
});

test("Allen exact allowlist authenticates GET, HEAD, and access probe before data", async () => {
  const calls = { head: 0, get: 0 };
  const revokedSessions = new Set();
  const localGateway = {
    head: async (asset) => {
      calls.head += 1;
      return { contentLength: asset.size, contentType: "application/octet-stream", etag: `\"${asset.sha256}\"` };
    },
    get: async (asset, range) => {
      calls.get += 1;
      return {
        body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3, 4])); controller.close(); } }),
        contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream",
        etag: `\"${asset.sha256}\"`,
      };
    },
  };
  const noLogin = await handleAllenCoralAtlasRequest(allenRequest(), { config: allenConfig, authenticate: async () => ({ status: 401 }), gateway: localGateway, revokedSessions });
  assert.equal(noLogin.status, 401);
  const otherUser = await handleAllenCoralAtlasRequest(allenRequest(), { config: allenConfig, authenticate: async () => ({ status: 403 }), gateway: localGateway, revokedSessions });
  assert.equal(otherUser.status, 403);
  const probe = await handleAllenCoralAtlasRequest(request("/api/private-research/allen-coral-atlas/benthic?access=1"), { config: allenConfig, authenticate: allenOwner, gateway: localGateway, revokedSessions });
  assert.equal(probe.status, 200);
  assert.deepEqual(await probe.json(), { allowed: true });
  assert.equal(calls.head, 0);
  const head = await handleAllenCoralAtlasRequest(allenRequest("geomorphic", { method: "HEAD" }), { config: allenConfig, authenticate: allenOwner, gateway: localGateway, revokedSessions });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), "52624835");
  const range = await handleAllenCoralAtlasRequest(allenRequest("benthic", { headers: { Range: "bytes=0-3" } }), { config: allenConfig, authenticate: allenOwner, gateway: localGateway, revokedSessions });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get("content-range"), "bytes 0-3/94597292");
  assert.equal(range.headers.get("cache-control"), "private, no-store");
  assert.deepEqual([...new Uint8Array(await range.arrayBuffer())], [1, 2, 3, 4]);
  const missingRange = await handleAllenCoralAtlasRequest(allenRequest(), { config: allenConfig, authenticate: allenOwner, gateway: localGateway, revokedSessions });
  assert.equal(missingRange.status, 416);
  const unknown = await handleAllenCoralAtlasRequest(request("/api/private-research/allen-coral-atlas/extra"), { config: allenConfig, authenticate: allenOwner, gateway: localGateway, revokedSessions });
  assert.equal(unknown.status, 404);
});

test("Japan water exact allowlist requires owner auth and returns only bounded verified ranges", async () => {
  const calls = { head: 0, get: 0 };
  const privateGateway = {
    async head(asset) {
      calls.head += 1;
      return { contentLength: asset.size, contentType: "application/octet-stream", etag: `\"${asset.sha256}\"` };
    },
    async get(asset, range) {
      calls.get += 1;
      return {
        body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(range.length)); controller.close(); } }),
        contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream",
        etag: `\"${asset.sha256}\"`,
      };
    },
  };
  const revokedSessions = new Set();
  const anonymous = await handleJpWaterRequest(jpWaterRequest(), {
    config: allenConfig, authenticate: async () => ({ status: 401 }), gateway: privateGateway, revokedSessions,
  });
  assert.equal(anonymous.status, 401);
  const otherUser = await handleJpWaterRequest(jpWaterRequest(), {
    config: allenConfig, authenticate: async () => ({ status: 403 }), gateway: privateGateway, revokedSessions,
  });
  assert.equal(otherUser.status, 403);
  const probe = await handleJpWaterRequest(request("/api/private-research/jp-water/water?access=1"), {
    config: allenConfig, authenticate: allenOwner, gateway: privateGateway, revokedSessions,
  });
  assert.equal(probe.status, 200);
  assert.deepEqual(await probe.json(), { allowed: true });
  assert.equal(calls.head, 0);
  const range = await handleJpWaterRequest(jpWaterRequest("extra-water", { headers: { Range: "bytes=0-3" } }), {
    config: allenConfig, authenticate: allenOwner, gateway: privateGateway, revokedSessions,
  });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get("content-range"), "bytes 0-3/31656052");
  assert.equal(range.headers.get("cache-control"), "private, no-store");
  assert.equal((await range.arrayBuffer()).byteLength, 4);
  assert.equal(calls.get, 1);
  const noRange = await handleJpWaterRequest(jpWaterRequest(), {
    config: allenConfig, authenticate: allenOwner, gateway: privateGateway, revokedSessions,
  });
  assert.equal(noRange.status, 416);
  const unknown = await handleJpWaterRequest(jpWaterRequest("unknown"), {
    config: allenConfig, authenticate: allenOwner, gateway: privateGateway, revokedSessions,
  });
  assert.equal(unknown.status, 404);
});

test("Japan water S3 gateway uses immutable private keys", async () => {
  const bytes = Buffer.from("jp-water");
  const asset = Object.freeze({
    filename: "water.pmtiles",
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  const calls = [];
  const gateway = createJpWaterS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: { async send(command) { calls.push(command.input); return { ContentLength: bytes.length, Body: Readable.from([bytes]) }; } },
    assets: { water: asset },
  });
  await gateway.head(asset);
  assert.deepEqual(calls, [{
    Bucket: "migu-private-research-ap-southeast-2",
    Key: `private-research/jp-water/${asset.sha256}/water.pmtiles`,
    ChecksumMode: "ENABLED",
  }]);
});

test("sidecar routes Japan water through the shared owner session revoke boundary", async () => {
  const privateGateway = {
    async head(asset) { return { contentLength: asset.size, contentType: "application/octet-stream", etag: `\"${asset.sha256}\"` }; },
    async get(asset, range) {
      return {
        body: Buffer.alloc(range.length), contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream", etag: `\"${asset.sha256}\"`,
      };
    },
  };
  const revokedSessions = new Set();
  const server = startAllenCoralAtlasServer({
    port: 0, warmupAttempts: 1, config: allenConfig,
    authenticate: async (authorization) => authorization === "Bearer owner" ? allenOwner() : { status: 401 },
    gateway: privateGateway, jpWaterGateway: privateGateway, revokedSessions,
  });
  try {
    await once(server, "listening");
    await new Promise((resolve) => setImmediate(resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const root = `http://127.0.0.1:${address.port}/api/private-research`;
    const headers = { Authorization: "Bearer owner", Range: "bytes=0-3" };
    const water = await fetch(`${root}/jp-water/water`, { headers });
    assert.equal(water.status, 206);
    assert.equal(water.headers.get("content-range"), "bytes 0-3/85597875");
    const revoke = await fetch(`${root}/allen-coral-atlas/revoke`, {
      method: "POST", headers: { Authorization: "Bearer owner" },
    });
    assert.equal(revoke.status, 200);
    const denied = await fetch(`${root}/jp-water/extra-water`, { headers });
    assert.equal(denied.status, 401);
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("private archive warmup buffers at most one immutable snapshot at a time", async () => {
  let active = 0;
  let maxActive = 0;
  let completed = 0;
  let finish;
  const allWarm = new Promise((resolve) => { finish = resolve; });
  const gateway = {
    async head(asset) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      completed += 1;
      if (completed === 4) finish();
      return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` };
    },
    async get() { throw new Error("not used during warmup"); },
  };
  const server = startAllenCoralAtlasServer({
    port: 0, warmupAttempts: 1, config: allenConfig,
    authenticate: allenOwner, gateway, jpWaterGateway: gateway, revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    await allWarm;
    assert.equal(completed, 4);
    assert.equal(maxActive, 1);
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("failed Allen warmup does not prevent Japan water from becoming ready", async () => {
  let jpHeads = 0;
  let finish;
  const japanWarm = new Promise((resolve) => { finish = resolve; });
  const jpWaterGateway = {
    async head(asset) {
      jpHeads += 1;
      if (jpHeads === 2) finish();
      return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` };
    },
    async get() { throw new Error("access probe must not read object bytes"); },
  };
  const server = startAllenCoralAtlasServer({
    port: 0, warmupAttempts: 1, config: allenConfig, authenticate: allenOwner,
    gateway: { async head() { throw new Error("Allen unavailable"); } },
    jpWaterGateway, revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    await japanWarm;
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const probe = await fetch(`http://127.0.0.1:${address.port}/api/private-research/jp-water/water?access=1`, {
      headers: { Authorization: "Bearer owner" },
    });
    assert.equal(probe.status, 200);
    assert.deepEqual(await probe.json(), { allowed: true });
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Allen sidecar listens during warmup but fails closed until immutable snapshots are ready", async () => {
  let releaseWarmup;
  const warmup = new Promise((resolve) => { releaseWarmup = resolve; });
  const calls = { head: 0, get: 0 };
  const gateway = {
    async head(asset) {
      calls.head += 1;
      await warmup;
      return { contentLength: asset.size, contentType: "application/octet-stream", etag: `\"${asset.sha256}\"` };
    },
    async get(asset, range) {
      calls.get += 1;
      return {
        body: Buffer.alloc(range.length),
        contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream",
        etag: `\"${asset.sha256}\"`,
      };
    },
  };
  const server = startAllenCoralAtlasServer({
    port: 0,
    warmupAttempts: 1,
    config: allenConfig,
    authenticate: allenOwner,
    gateway,
    revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/api/private-research/allen-coral-atlas/benthic`;
    const warming = await fetch(url, {
      headers: { Authorization: "Bearer owner", Origin: "https://pulse.example.test", Range: "bytes=0-3" },
    });
    assert.equal(warming.status, 503);
    assert.equal(warming.headers.get("access-control-allow-origin"), "https://pulse.example.test");
    assert.deepEqual(await warming.json(), { error: "private Allen sidecar is warming up" });
    assert.equal(calls.get, 0);

    releaseWarmup();
    await new Promise((resolve) => setImmediate(resolve));
    const ready = await fetch(url, { headers: { Authorization: "Bearer owner", Range: "bytes=0-3" } });
    assert.equal(ready.status, 206);
    assert.equal((await ready.arrayBuffer()).byteLength, 4);
    assert.equal(calls.get, 1);
  } finally {
    if (server.listening) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }
});

test("Allen sidecar exposes a failed warmup as 503 without proxying private bytes", async () => {
  const calls = { get: 0 };
  const server = startAllenCoralAtlasServer({
    port: 0,
    warmupAttempts: 1,
    config: allenConfig,
    authenticate: allenOwner,
    gateway: {
      async head() { throw new Error("snapshot unavailable"); },
      async get() { calls.get += 1; throw new Error("must not proxy before readiness"); },
    },
    revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    await new Promise((resolve) => setImmediate(resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const unavailable = await fetch(`http://127.0.0.1:${address.port}/api/private-research/allen-coral-atlas/benthic`, {
      headers: { Authorization: "Bearer owner", Range: "bytes=0-3" },
    });
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { error: "private Allen sidecar unavailable" });
    assert.equal(calls.get, 0);
  } finally {
    if (server.listening) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }
});

test("Allen sidecar retries warmup three times with exponential backoff", async () => {
  const headAt = [];
  const server = startAllenCoralAtlasServer({
    port: 0,
    warmupAttempts: 3,
    warmupRetryDelayMs: 20,
    config: allenConfig,
    authenticate: allenOwner,
    gateway: {
      async head() { headAt.push(Date.now()); throw new Error("snapshot unavailable"); },
      async get() { throw new Error("must not proxy before readiness"); },
    },
    revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    await new Promise((resolve) => setTimeout(resolve, 90));
    // Serial warmup stops the attempt at the first unavailable immutable
    // snapshot, then retries at 20ms and 40ms backoff intervals.
    assert.equal(headAt.length, 3);
    assert.ok(headAt[1] - headAt[0] >= 15);
    assert.ok(headAt[2] - headAt[1] >= 35);
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Allen sidecar keeps warmup failures fail-closed while revoke still authenticates and denies revoked sessions", async () => {
  const calls = { head: 0, get: 0 };
  const revokedSessions = new Set();
  const server = startAllenCoralAtlasServer({
    port: 0,
    warmupAttempts: 1,
    config: allenConfig,
    authenticate: async (authorization) => authorization === "Bearer owner" ? allenOwner() : { status: 401 },
    gateway: {
      async head() { calls.head += 1; throw new Error("snapshot unavailable"); },
      async get() { calls.get += 1; throw new Error("must not proxy before readiness"); },
    },
    revokedSessions,
  });
  try {
    await once(server, "listening");
    await new Promise((resolve) => setImmediate(resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const root = `http://127.0.0.1:${address.port}/api/private-research/allen-coral-atlas`;
    const headers = { Authorization: "Bearer owner", Range: "bytes=0-3" };
    const asset = await fetch(`${root}/benthic`, { headers });
    const probe = await fetch(`${root}/benthic?access=1`, { headers });
    assert.equal(asset.status, 503);
    assert.equal(probe.status, 503);
    assert.equal(calls.get, 0);
    const anonymousRevoke = await fetch(`${root}/revoke`, { method: "POST" });
    assert.equal(anonymousRevoke.status, 401);
    const revoke = await fetch(`${root}/revoke`, { method: "POST", headers: { Authorization: "Bearer owner" } });
    assert.equal(revoke.status, 200);
    const revoked = await fetch(`${root}/revoke`, { method: "POST", headers: { Authorization: "Bearer owner" } });
    assert.equal(revoked.status, 401);
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Allen local file range verifies the contract asset with injected auth", {
  skip: !existsSync(join(allenRoot, "allen_coral_atlas_benthic.pmtiles")) && "Private local artifact is intentionally absent from CI",
}, async () => {
  // This exercises the real local PMTiles bytes. Injected auth proves handler wiring only;
  // it is explicitly not evidence of a real Supabase login or token revocation behavior.
  const output = await handleAllenCoralAtlasRequest(allenRequest("benthic", { headers: { Range: "bytes=0-3" } }), {
    config: allenConfig,
    authenticate: allenOwner,
    gateway: createAllenCoralAtlasGateway(allenRoot),
    revokedSessions: new Set(),
  });
  assert.equal(output.status, 206);
  assert.equal(output.headers.get("content-range"), "bytes 0-3/94597292");
  assert.equal((await output.arrayBuffer()).byteLength, 4);
});

test("Allen snapshot remains consistent after its source file is replaced", async () => {
  const directory = await mkdtemp(join(tmpdir(), "allen-coral-atlas-snapshot-"));
  const filename = "asset.pmtiles";
  const original = Buffer.from("verified-snapshot");
  const asset = Object.freeze({
    filename,
    size: original.length,
    sha256: createHash("sha256").update(original).digest("hex"),
  });
  try {
    await writeFile(join(directory, filename), original);
    const gateway = createAllenCoralAtlasGateway(directory, { benthic: asset });
    const first = await gateway.get(asset, { start: 0, end: 7, length: 8 });
    assert.equal(first.body.toString(), "verified");
    await writeFile(join(directory, filename), Buffer.from("replaced-local-file"));
    const second = await gateway.get(asset, { start: 0, end: 7, length: 8 });
    assert.equal(second.body.toString(), "verified");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Allen revoke denylist rejects the same verified owner session for this process lifetime", async () => {
  const revokedSessions = new Set();
  const dependencies = { config: allenConfig, authenticate: allenOwner, revokedSessions };
  const revoke = await handleAllenCoralAtlasRequest(request("/api/private-research/allen-coral-atlas/revoke", { method: "POST" }), dependencies);
  assert.equal(revoke.status, 200);
  assert.deepEqual(await revoke.json(), { revoked: true });
  const denied = await handleAllenCoralAtlasRequest(allenRequest("benthic", { headers: { Range: "bytes=0-3" } }), dependencies);
  assert.equal(denied.status, 401);
});

test("Allen denylist persists across new instances with owner-only file permissions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "allen-coral-atlas-test-"));
  const file = join(directory, "revocations.jsonl");
  try {
    const first = createAllenSessionDenylist(file);
    await first.revoke("test-session-id");
    const second = createAllenSessionDenylist(file);
    assert.equal(await second.has("test-session-id"), true);
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.equal((await readFile(file, "utf8")).includes("test-session-id"), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Allen audit sink records response metadata without bearer credentials", async () => {
  const records = [];
  const request = allenRequest("benthic", { headers: { Authorization: "Bearer do-not-log-this-token", Range: "bytes=0-3" } });
  await writeAllenAuditRecord(request, new Response(null, { status: 206, headers: { "Content-Range": "bytes 0-3/94597292" } }), allenConfig, async (record) => records.push(record));
  assert.deepEqual(records, [{
    timestamp: records[0].timestamp,
    endpoint: "/api/private-research/allen-coral-atlas/benthic",
    asset: "benthic",
    method: "GET",
    status: 206,
    range: "bytes=0-3",
    contentRange: "bytes 0-3/94597292",
  }]);
  assert.equal(JSON.stringify(records).includes("do-not-log-this-token"), false);
});

test("Allen audit sink rotates before append and retains bounded owner-only files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "allen-coral-atlas-audit-"));
  const auditPath = join(directory, "audit.jsonl");
  const auditConfig = { ...allenConfig, auditPath, auditMaxBytes: 65536, auditRetainedFiles: 2 };
  const largeRange = `bytes=0-${"9".repeat(40000)}`;
  try {
    for (let index = 0; index < 7; index += 1) {
      await writeAllenAuditRecord(allenRequest("benthic", { headers: { Range: largeRange } }), new Response(null, { status: 206 }), auditConfig);
    }
    assert.deepEqual((await readdir(directory)).sort(), ["audit.jsonl", "audit.jsonl.1", "audit.jsonl.2"]);
    for (const filename of ["audit.jsonl", "audit.jsonl.1", "audit.jsonl.2"]) {
      const file = join(directory, filename);
      assert.equal((await stat(file)).mode & 0o777, 0o600);
      assert.ok((await stat(file)).size <= auditConfig.auditMaxBytes);
      assert.equal((await readFile(file, "utf8")).includes("Bearer"), false);
    }
    await writeFile(`${auditPath}.3`, "stale generation");
    auditConfig.auditRetainedFiles = 1;
    await writeAllenAuditRecord(allenRequest("benthic", { headers: { Range: largeRange } }), new Response(null, { status: 206 }), auditConfig);
    assert.deepEqual((await readdir(directory)).sort(), ["audit.jsonl", "audit.jsonl.1"]);

    // Once retention is initialized, normal appends do not rescan or remove
    // generation names on every request. (A subsequent config change prunes.)
    await writeFile(`${auditPath}.2`, "external stale generation");
    await writeAllenAuditRecord(allenRequest("benthic", { headers: { Range: largeRange } }), new Response(null, { status: 206 }), auditConfig);
    assert.equal((await readdir(directory)).includes("audit.jsonl.2"), true);
    auditConfig.auditRetainedFiles = 2;
    await writeAllenAuditRecord(allenRequest("benthic", { headers: { Range: largeRange } }), new Response(null, { status: 206 }), auditConfig);
    assert.equal((await readdir(directory)).includes("audit.jsonl.2"), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
