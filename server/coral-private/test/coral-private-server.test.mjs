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
  createSoilLiquefactionS3Gateway,
  createBssBridgeS3Gateway,
  BSS_BRIDGE_ASSETS,
  handleBssBridgeRequest,
  createBridgeResilienceS3Gateway,
  BRIDGE_RESILIENCE_ASSETS,
  handleBridgeResilienceRequest,
  createBusCrowdingGateway,
  createBusCrowdingS3Gateway,
  BUS_CROWDING_ASSETS,
  handleBusCrowdingRequest,
  createOwnerDataGateway,
  createOwnerDataS3Gateway,
  createPrivateByteCache,
  getPrivateCacheConfig,
  OWNER_DATA_ASSETS,
  handleOwnerDataRequest,
  SOIL_LIQUEFACTION_ASSETS,
  createAllenSessionDenylist,
  getAllenCoralAtlasConfig,
  getConfig,
  handleAllenCoralAtlasRequest,
  handleCoralRequest,
  handleJpWaterRequest,
  handleSoilLiquefactionRequest,
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

/** S3 stand-in: answers HeadObject with size/ETag/ChecksumSHA256 and GetObject with exact byte ranges. */
function fakeS3Client(bytes, calls = [], { checksum = true, checksumOf = bytes, etag = '"s3-etag"' } = {}) {
  const digest = createHash("sha256").update(checksumOf).digest("base64");
  return {
    async send(command) {
      calls.push(command.input);
      if (command.input.ChecksumMode) {
        return {
          ContentLength: bytes.length, ETag: etag,
          ...(checksum === "composite" ? { ChecksumSHA256: `${digest}-3`, ChecksumType: "COMPOSITE" } : checksum ? { ChecksumSHA256: digest, ChecksumType: "FULL_OBJECT" } : {}),
        };
      }
      const match = /^bytes=(\d+)-(\d+)$/.exec(command.input.Range ?? "");
      const start = match ? Number(match[1]) : 0;
      const end = match ? Number(match[2]) : bytes.length - 1;
      const slice = bytes.subarray(start, end + 1);
      return {
        ContentLength: slice.length, ETag: etag, Body: Readable.from([slice]),
        ...(match ? { ContentRange: `bytes ${start}-${end}/${bytes.length}` } : {}),
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

function soilRequest(asset = "tiles", options = {}) {
  return request(`/api/private-research/soil-liquefaction/${asset}`, options);
}

function bridgeResilienceRequest(asset = "tiles", options = {}) {
  return request(`/api/private-research/bridge-resilience/${asset}`, options);
}

function bssRequest(asset = "tiles", options = {}) {
  return request(`/api/private-research/bss-bridge/${asset}`, options);
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

function testAsset(bytes, filename = "asset.pmtiles") {
  return Object.freeze({ filename, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}

function rangeCalls(calls) {
  return calls.filter((input) => !("ChecksumMode" in input)).map((input) => input.Range ?? "FULL");
}

test("Allen S3 gateway HEAD-verifies the S3 SHA-256 and never downloads the whole object", async () => {
  const bytes = Buffer.alloc(3 * 1024 * 1024, 7);
  bytes.write("PMTiles", 0);
  const asset = testAsset(bytes);
  const calls = [];
  const cache = createPrivateByteCache({ maxBytes: 1024 * 1024, maxEntryBytes: 256 * 1024 });
  const gateway = createAllenCoralAtlasS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: fakeS3Client(bytes, calls), assets: { benthic: asset }, cache,
  });
  const metadata = await gateway.head(asset);
  assert.equal(metadata.etag, `\"${asset.sha256}\"`);
  assert.deepEqual(calls, [{
    Bucket: "migu-gis-data-collector",
    Key: `private-research/allen-coral-atlas/${asset.sha256}/asset.pmtiles`,
    ChecksumMode: "ENABLED",
  }]);
  const first = await gateway.get(asset, { start: 0, end: 6, length: 7 });
  const again = await gateway.get(asset, { start: 0, end: 6, length: 7 });
  assert.equal(first.body.toString(), "PMTiles");
  assert.equal(again.body.toString(), "PMTiles");
  assert.equal(first.contentRange, `bytes 0-6/${bytes.length}`);
  // One HEAD for both calls (verification is memoized) and one ranged GET (second read is a cache hit).
  assert.equal(calls.filter((input) => "ChecksumMode" in input).length, 1);
  assert.deepEqual(rangeCalls(calls), ["bytes=0-6"]);
  assert.equal(calls.find((input) => input.Range).IfMatch, '"s3-etag"');
  assert.equal(cache.bytes, 7);
});

test("Allen S3 gateway streams large ranges without retaining them", async () => {
  const bytes = Buffer.from(Array.from({ length: 600 * 1024 }, (_, index) => index % 251));
  const asset = testAsset(bytes);
  const calls = [];
  const cache = createPrivateByteCache({ maxBytes: 1024 * 1024, maxEntryBytes: 64 * 1024 });
  const gateway = createAllenCoralAtlasS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: fakeS3Client(bytes, calls), assets: { benthic: asset }, cache,
  });
  const object = await gateway.get(asset, { start: 1000, end: 300_999, length: 300_000 });
  assert.ok(object.body instanceof ReadableStream);
  const received = Buffer.from(await new Response(object.body).arrayBuffer());
  assert.ok(received.equals(bytes.subarray(1000, 301_000)));
  assert.equal(cache.bytes, 0);
  assert.deepEqual(rangeCalls(calls), ["bytes=1000-300999"]);
});

test("Allen S3 gateway caches small objects whole after a local SHA-256 check", async () => {
  const bytes = Buffer.from("{\"type\":\"FeatureCollection\"}");
  const asset = testAsset(bytes, "small.json");
  const calls = [];
  const cache = createPrivateByteCache({ maxBytes: 1024, maxEntryBytes: 512 });
  const gateway = createAllenCoralAtlasS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: fakeS3Client(bytes, calls), assets: { benthic: asset }, cache,
  });
  assert.equal((await gateway.get(asset, { start: 0, end: 6, length: 7 })).body.toString(), "{\"type\"");
  assert.equal((await gateway.get(asset, { start: 9, end: 25, length: 17 })).body.toString(), "FeatureCollection");
  assert.deepEqual(rangeCalls(calls), [`bytes=0-${bytes.length - 1}`]);
  assert.equal(cache.bytes, bytes.length);

  const evil = Buffer.from("{\"type\":\"FeatureCollectioX\"}");
  const tampered = createAllenCoralAtlasS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: fakeS3Client(evil, [], { checksumOf: bytes }), assets: { benthic: asset }, cache: createPrivateByteCache({ maxBytes: 1024, maxEntryBytes: 512 }),
  });
  await assert.rejects(() => tampered.get(asset, { start: 0, end: 6, length: 7 }), /checksum mismatch/);
});

test("Allen S3 gateway rejects a wrong size or S3 SHA-256 and does not cache the failure", async () => {
  const good = Buffer.from("good-bytes");
  const asset = testAsset(good);
  const wrongChecksum = createAllenCoralAtlasS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: fakeS3Client(good, [], { checksumOf: Buffer.from("other-byte") }), assets: { benthic: asset }, cache: createPrivateByteCache(),
  });
  await assert.rejects(() => wrongChecksum.head(asset), /checksum mismatch/);
  const wrongSize = createAllenCoralAtlasS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: fakeS3Client(Buffer.from("short"), []), assets: { benthic: asset }, cache: createPrivateByteCache(),
  });
  await assert.rejects(() => wrongSize.head(asset), /size mismatch/);

  let failures = 1;
  const calls = [];
  const flaky = fakeS3Client(good, calls);
  const recovering = createAllenCoralAtlasS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: { async send(command) { if (failures-- > 0) throw new Error("network"); return flaky.send(command); } },
    assets: { benthic: asset }, cache: createPrivateByteCache(),
  });
  await assert.rejects(() => recovering.head(asset), /network/);
  assert.equal((await recovering.head(asset)).contentLength, good.length);
});

test("Allen S3 gateway hashes objects without a full-object S3 checksum by streaming once", async () => {
  const good = Buffer.alloc(200_000, 3);
  const asset = testAsset(good);
  for (const checksum of [false, "composite"]) {
    const calls = [];
    const gateway = createAllenCoralAtlasS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
      client: fakeS3Client(good, calls, { checksum }), assets: { benthic: asset }, cache: createPrivateByteCache(),
    });
    await gateway.head(asset);
    await gateway.head(asset);
    assert.deepEqual(rangeCalls(calls), ["FULL"]);
    assert.equal(calls.find((input) => !("ChecksumMode" in input)).IfMatch, '"s3-etag"');
  }
  const evil = Buffer.alloc(200_000, 4);
  const gateway = createAllenCoralAtlasS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: fakeS3Client(evil, [], { checksum: false }), assets: { benthic: asset }, cache: createPrivateByteCache(),
  });
  await assert.rejects(() => gateway.head(asset), /checksum mismatch/);
});

test("private byte cache evicts least recently used entries and never exceeds its limit", async () => {
  const cache = createPrivateByteCache({ maxBytes: 100, maxEntryBytes: 40 });
  for (const key of ["a", "b", "c"]) await cache.load(key, async () => Buffer.alloc(30));
  assert.equal(cache.bytes, 90);
  cache.get("a"); // a becomes most recently used
  await cache.load("d", async () => Buffer.alloc(30));
  assert.equal(cache.bytes, 90);
  assert.ok(cache.get("a"));
  assert.equal(cache.get("b"), undefined);
  const big = await cache.load("big", async () => Buffer.alloc(50));
  assert.equal(big.length, 50);
  assert.equal(cache.get("big"), undefined);
  assert.ok(cache.bytes <= 100);
  let loads = 0;
  const loader = async () => { loads += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return Buffer.alloc(10); };
  await Promise.all([cache.load("same", loader), cache.load("same", loader)]);
  assert.equal(loads, 1);
  await assert.rejects(() => cache.load("boom", async () => { throw new Error("s3"); }), /s3/);
  assert.equal((await cache.load("boom", async () => Buffer.alloc(1))).length, 1);

  // Through the gateway: many distinct tile ranges keep the retained bytes under the limit.
  const bytes = Buffer.alloc(3 * 1024 * 1024, 1);
  const asset = testAsset(bytes);
  const bounded = createPrivateByteCache({ maxBytes: 64 * 1024, maxEntryBytes: 16 * 1024 });
  const gateway = createAllenCoralAtlasS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: fakeS3Client(bytes, []), assets: { benthic: asset }, cache: bounded,
  });
  for (let index = 0; index < 50; index += 1) {
    const start = index * 10_000;
    await gateway.get(asset, { start, end: start + 9_999, length: 10_000 });
    assert.ok(bounded.bytes <= 64 * 1024);
  }
  assert.equal(bounded.count, 6);
});

test("cache limits come from environment with safe fallbacks", () => {
  assert.deepEqual(getPrivateCacheConfig({}), { maxBytes: 64 * 1024 * 1024, maxEntryBytes: 2 * 1024 * 1024 });
  assert.deepEqual(getPrivateCacheConfig({ PRIVATE_RESEARCH_CACHE_MAX_BYTES: "33554432", PRIVATE_RESEARCH_CACHE_MAX_ENTRY_BYTES: "1048576" }), { maxBytes: 33554432, maxEntryBytes: 1048576 });
  assert.deepEqual(getPrivateCacheConfig({ PRIVATE_RESEARCH_CACHE_MAX_BYTES: "lots", PRIVATE_RESEARCH_CACHE_MAX_ENTRY_BYTES: "1" }), { maxBytes: 64 * 1024 * 1024, maxEntryBytes: 2 * 1024 * 1024 });
});

test("owner-data handler over the on-demand S3 gateway: 206, auth, allowlist, and opaque 502", async () => {
  const asset = OWNER_DATA_ASSETS["livestock-farms"];
  const calls = [];
  const s3 = {
    async send(command) {
      calls.push(command.input);
      if (command.input.ChecksumMode) {
        return { ContentLength: asset.size, ETag: '"s3-etag"', ChecksumSHA256: Buffer.from(asset.sha256, "hex").toString("base64"), ChecksumType: "FULL_OBJECT" };
      }
      const [, start, end] = /^bytes=(\d+)-(\d+)$/.exec(command.input.Range);
      const length = Number(end) - Number(start) + 1;
      return { ContentLength: length, ContentRange: `bytes ${start}-${end}/${asset.size}`, ETag: '"s3-etag"', Body: Readable.from([Buffer.alloc(length, 9)]) };
    },
  };
  const gateway = createOwnerDataS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: s3, cache: createPrivateByteCache(),
  });
  const deps = (authenticate, gw = gateway) => ({ config: allenConfig, authenticate, gateway: gw, revokedSessions: new Set() });
  const ownerRequest = (name, range = "bytes=100-115") => request(`/api/private-research/owner-data/${name}`, { headers: { Range: range } });

  const ok = await handleOwnerDataRequest(ownerRequest("livestock-farms"), deps(allenOwner));
  assert.equal(ok.status, 206);
  assert.equal(ok.headers.get("content-range"), `bytes 100-115/${asset.size}`);
  assert.equal(ok.headers.get("content-length"), "16");
  assert.equal(ok.headers.get("etag"), `\"${asset.sha256}\"`);
  assert.deepEqual([...new Uint8Array(await ok.arrayBuffer())], Array(16).fill(9));
  const streamed = await handleOwnerDataRequest(ownerRequest("livestock-farms", `bytes=0-${asset.size - 1}`), deps(allenOwner));
  assert.equal(streamed.status, 206);
  assert.equal((await streamed.arrayBuffer()).byteLength, asset.size);

  const before = calls.length;
  assert.equal((await handleOwnerDataRequest(ownerRequest("livestock-farms"), deps(async () => ({ status: 401 })))).status, 401);
  assert.equal((await handleOwnerDataRequest(ownerRequest("livestock-farms"), deps(async () => ({ status: 403 })))).status, 403);
  assert.equal((await handleOwnerDataRequest(ownerRequest("not-listed"), deps(allenOwner))).status, 404);
  assert.equal((await handleOwnerDataRequest(ownerRequest("..%2Fjp-water%2Fwater"), deps(allenOwner))).status, 404);
  assert.equal((await handleOwnerDataRequest(ownerRequest("livestock-farms/extra"), deps(allenOwner))).status, 404);
  assert.equal(calls.length, before, "rejected requests never reach S3");

  const broken = createOwnerDataS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: { async send() { throw new Error("AccessDenied migu-private-research-ap-southeast-2/private-research/owner-data/x"); } },
    cache: createPrivateByteCache(),
  });
  const failed = await handleOwnerDataRequest(ownerRequest("livestock-farms"), deps(allenOwner, broken));
  assert.equal(failed.status, 502);
  const body = await failed.text();
  assert.doesNotMatch(body, /private-research\/|migu-|AccessDenied|sha|\.geojson/);

  let headed = false;
  const rangeFails = createOwnerDataS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: { async send(command) { if (!headed && command.input.ChecksumMode) { headed = true; return s3.send(command); } throw new Error("timeout private-research/owner-data"); } },
    cache: createPrivateByteCache(),
  });
  const rangeFailed = await handleOwnerDataRequest(ownerRequest("livestock-farms"), deps(allenOwner, rangeFails));
  assert.equal(rangeFailed.status, 502);
  assert.doesNotMatch(await rangeFailed.text(), /private-research\//);
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
    client: fakeS3Client(bytes, calls),
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

test("soil liquefaction assets enforce owner, probe, range and unknown asset boundaries", async () => {
  const calls = { head: 0, get: 0 };
  const privateGateway = {
    async head(asset) { calls.head += 1; return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; },
    async get(asset, range) {
      calls.get += 1;
      return {
        body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(range.length)); controller.close(); } }),
        contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream",
        etag: `"${asset.sha256}"`,
      };
    },
  };
  const revokedSessions = new Set();
  const deps = (authenticate) => ({ config: allenConfig, authenticate, gateway: privateGateway, revokedSessions });
  assert.equal((await handleSoilLiquefactionRequest(soilRequest(), deps(async () => ({ status: 401 })))).status, 401);
  assert.equal((await handleSoilLiquefactionRequest(soilRequest(), deps(async () => ({ status: 403 })))).status, 403);
  const probe = await handleSoilLiquefactionRequest(request("/api/private-research/soil-liquefaction/tiles?access=1"), deps(allenOwner));
  assert.equal(probe.status, 200);
  assert.deepEqual(await probe.json(), { allowed: true });
  assert.equal(calls.head, 0);
  // Range needs the real asset size; it stays skipped while the size/sha256 placeholder is unfilled.
  if (SOIL_LIQUEFACTION_ASSETS.tiles.size > 0) {
    const range = await handleSoilLiquefactionRequest(soilRequest("tiles", { headers: { Range: "bytes=0-3" } }), deps(allenOwner));
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), `bytes 0-3/${SOIL_LIQUEFACTION_ASSETS.tiles.size}`);
    assert.equal(range.headers.get("cache-control"), "private, no-store");
    assert.equal((await range.arrayBuffer()).byteLength, 4);
    assert.equal(calls.get, 1);
  }
  assert.equal((await handleSoilLiquefactionRequest(soilRequest("unknown"), deps(allenOwner))).status, 404);
  assert.equal((await handleSoilLiquefactionRequest(soilRequest("constructor"), deps(allenOwner))).status, 404);
});

test("soil liquefaction S3 gateway uses immutable private keys", async () => {
  const bytes = Buffer.from("soil-liquefaction");
  const asset = Object.freeze({
    filename: "soil-liquefaction.pmtiles",
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  const calls = [];
  const gateway = createSoilLiquefactionS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: fakeS3Client(bytes, calls),
    assets: { tiles: asset },
  });
  await gateway.head(asset);
  assert.deepEqual(calls, [{
    Bucket: "migu-private-research-ap-southeast-2",
    Key: `private-research/soil-liquefaction/${asset.sha256}/soil-liquefaction.pmtiles`,
    ChecksumMode: "ENABLED",
  }]);
});

test("soil liquefaction warmup is independent and shares the revoke boundary", async () => {
  const okGateway = {
    async head(asset) { return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; },
    async get(asset, range) {
      return {
        body: Buffer.alloc(range.length), contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream", etag: `"${asset.sha256}"`,
      };
    },
  };
  const failing = { async head() { throw new Error("missing"); } };
  const server = startAllenCoralAtlasServer({
    port: 0, warmupAttempts: 1, config: allenConfig,
    authenticate: async (authorization) => authorization === "Bearer owner" ? allenOwner() : { status: 401 },
    gateway: okGateway, jpWaterGateway: failing, soilLiquefactionGateway: okGateway, revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    await new Promise((resolve) => setTimeout(resolve, 50));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const root = `http://127.0.0.1:${address.port}/api/private-research`;
    const headers = { Authorization: "Bearer owner", Range: "bytes=0-3" };
    // A missing Japan water object must not affect the other families.
    const jp = await fetch(`${root}/jp-water/water`, { headers });
    assert.equal(jp.status, 503);
    assert.equal((await jp.json()).error, "private Japan water sidecar unavailable");
    const allen = await fetch(`${root}/allen-coral-atlas/benthic`, { headers });
    assert.equal(allen.status, 206);
    const soil = await fetch(`${root}/soil-liquefaction/tiles?access=1`, { headers: { Authorization: "Bearer owner" } });
    assert.equal(soil.status, 200);
    await fetch(`${root}/allen-coral-atlas/revoke`, { method: "POST", headers: { Authorization: "Bearer owner" } });
    assert.equal((await fetch(`${root}/soil-liquefaction/tiles`, { headers })).status, 401);
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("soil liquefaction failed warmup fails closed without affecting other families", async () => {
  const okGateway = { async head(asset) { return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; }, async get() { throw new Error("unused"); } };
  const server = startAllenCoralAtlasServer({
    port: 0, warmupAttempts: 1, config: allenConfig, authenticate: allenOwner,
    gateway: okGateway, jpWaterGateway: okGateway,
    soilLiquefactionGateway: { async head() { throw new Error("missing"); } }, revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    await new Promise((resolve) => setTimeout(resolve, 50));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const root = `http://127.0.0.1:${address.port}/api/private-research`;
    const soil = await fetch(`${root}/soil-liquefaction/tiles?access=1`, { headers: { Authorization: "Bearer owner" } });
    assert.equal(soil.status, 503);
    assert.equal((await soil.json()).error, "private soil liquefaction sidecar unavailable");
    const jp = await fetch(`${root}/jp-water/water?access=1`, { headers: { Authorization: "Bearer owner" } });
    assert.equal(jp.status, 200);
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("bss bridge assets enforce owner, probe, range and unknown asset boundaries", async () => {
  const calls = { head: 0, get: 0 };
  const privateGateway = {
    async head(asset) { calls.head += 1; return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; },
    async get(asset, range) {
      calls.get += 1;
      return {
        body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(range.length)); controller.close(); } }),
        contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream",
        etag: `"${asset.sha256}"`,
      };
    },
  };
  const revokedSessions = new Set();
  const deps = (authenticate) => ({ config: allenConfig, authenticate, gateway: privateGateway, revokedSessions });
  assert.equal((await handleBssBridgeRequest(bssRequest(), deps(async () => ({ status: 401 })))).status, 401);
  assert.equal((await handleBssBridgeRequest(bssRequest(), deps(async () => ({ status: 403 })))).status, 403);
  const probe = await handleBssBridgeRequest(request("/api/private-research/bss-bridge/tiles?access=1"), deps(allenOwner));
  assert.equal(probe.status, 200);
  assert.deepEqual(await probe.json(), { allowed: true });
  assert.equal(calls.head, 0);
  {
    const range = await handleBssBridgeRequest(bssRequest("tiles", { headers: { Range: "bytes=0-3" } }), deps(allenOwner));
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), `bytes 0-3/${BSS_BRIDGE_ASSETS.tiles.size}`);
    assert.equal(range.headers.get("cache-control"), "private, no-store");
    assert.equal((await range.arrayBuffer()).byteLength, 4);
    assert.equal(calls.get, 1);
  }
  assert.equal((await handleBssBridgeRequest(bssRequest("unknown"), deps(allenOwner))).status, 404);
  assert.equal((await handleBssBridgeRequest(bssRequest("constructor"), deps(allenOwner))).status, 404);
});

test("bss bridge S3 gateway uses immutable private keys", async () => {
  const bytes = Buffer.from("bss-bridge");
  const asset = Object.freeze({
    filename: "bss_bridge_location_direction_preview_20261002_v5.pmtiles",
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  const calls = [];
  const gateway = createBssBridgeS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
    client: fakeS3Client(bytes, calls),
    assets: { tiles: asset },
  });
  await gateway.head(asset);
  assert.deepEqual(calls, [{
    Bucket: "migu-private-research-ap-southeast-2",
    Key: `private-research/bss-bridge/${asset.sha256}/bss_bridge_location_direction_preview_20261002_v5.pmtiles`,
    ChecksumMode: "ENABLED",
  }]);
});

test("bss bridge warmup is independent and shares the revoke boundary", async () => {
  const okGateway = {
    async head(asset) { return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; },
    async get(asset, range) {
      return {
        body: Buffer.alloc(range.length), contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream", etag: `"${asset.sha256}"`,
      };
    },
  };
  const failing = { async head() { throw new Error("missing"); } };
  const server = startAllenCoralAtlasServer({
    port: 0, warmupAttempts: 1, config: allenConfig,
    authenticate: async (authorization) => authorization === "Bearer owner" ? allenOwner() : { status: 401 },
    gateway: okGateway, jpWaterGateway: failing, bssBridgeGateway: okGateway, revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    await new Promise((resolve) => setTimeout(resolve, 50));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const root = `http://127.0.0.1:${address.port}/api/private-research`;
    const headers = { Authorization: "Bearer owner", Range: "bytes=0-3" };
    // A missing Japan water object must not affect the other families.
    const jp = await fetch(`${root}/jp-water/water`, { headers });
    assert.equal(jp.status, 503);
    assert.equal((await jp.json()).error, "private Japan water sidecar unavailable");
    const allen = await fetch(`${root}/allen-coral-atlas/benthic`, { headers });
    assert.equal(allen.status, 206);
    const bss = await fetch(`${root}/bss-bridge/tiles?access=1`, { headers: { Authorization: "Bearer owner" } });
    assert.equal(bss.status, 200);
    await fetch(`${root}/allen-coral-atlas/revoke`, { method: "POST", headers: { Authorization: "Bearer owner" } });
    assert.equal((await fetch(`${root}/bss-bridge/tiles`, { headers })).status, 401);
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("bss bridge failed warmup fails closed without affecting other families", async () => {
  const okGateway = { async head(asset) { return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; }, async get() { throw new Error("unused"); } };
  const server = startAllenCoralAtlasServer({
    port: 0, warmupAttempts: 1, config: allenConfig, authenticate: allenOwner,
    gateway: okGateway, jpWaterGateway: okGateway,
    bssBridgeGateway: { async head() { throw new Error("missing"); } }, revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    await new Promise((resolve) => setTimeout(resolve, 50));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const root = `http://127.0.0.1:${address.port}/api/private-research`;
    const bss = await fetch(`${root}/bss-bridge/tiles?access=1`, { headers: { Authorization: "Bearer owner" } });
    assert.equal(bss.status, 503);
    assert.equal((await bss.json()).error, "private bss bridge sidecar unavailable");
    const jp = await fetch(`${root}/jp-water/water?access=1`, { headers: { Authorization: "Bearer owner" } });
    assert.equal(jp.status, 200);
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("bridge resilience assets enforce owner, probe, range and unknown asset boundaries", async () => {
  const calls = { head: 0, get: 0 };
  const privateGateway = {
    async head(asset) { calls.head += 1; return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; },
    async get(asset, range) {
      calls.get += 1;
      return {
        body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(range.length)); controller.close(); } }),
        contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream",
        etag: `"${asset.sha256}"`,
      };
    },
  };
  const revokedSessions = new Set();
  const deps = (authenticate) => ({ config: allenConfig, authenticate, gateway: privateGateway, revokedSessions });
  assert.equal((await handleBridgeResilienceRequest(bridgeResilienceRequest(), deps(async () => ({ status: 401 })))).status, 401);
  assert.equal((await handleBridgeResilienceRequest(bridgeResilienceRequest(), deps(async () => ({ status: 403 })))).status, 403);
  for (const name of ["tiles", "summary", "impacts", "destinations", "decay-impacts", "decay-summary", "fingerprint"]) {
    const probe = await handleBridgeResilienceRequest(request(`/api/private-research/bridge-resilience/${name}?access=1`), deps(allenOwner));
    assert.equal(probe.status, 200);
    assert.deepEqual(await probe.json(), { allowed: true });
  }
  assert.equal(calls.head, 0);
  let expectedGets = 0;
  for (const name of ["tiles", "summary", "impacts", "destinations", "decay-impacts", "decay-summary", "fingerprint"]) {
    const range = await handleBridgeResilienceRequest(bridgeResilienceRequest(name, { headers: { Range: "bytes=0-3" } }), deps(allenOwner));
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), `bytes 0-3/${BRIDGE_RESILIENCE_ASSETS[name].size}`);
    assert.equal(range.headers.get("cache-control"), "private, no-store");
    assert.equal((await range.arrayBuffer()).byteLength, 4);
    expectedGets += 1;
    assert.equal(calls.get, expectedGets);
  }
  assert.equal((await handleBridgeResilienceRequest(bridgeResilienceRequest("unknown"), deps(allenOwner))).status, 404);
  assert.equal((await handleBridgeResilienceRequest(bridgeResilienceRequest("constructor"), deps(allenOwner))).status, 404);
});

test("bridge resilience S3 gateway uses immutable private keys", async () => {
  for (const [name, filename] of [
    ["tiles", "bridge-resilience-20261002-v4.pmtiles"],
    ["summary", "bridge_summary.json"],
    ["impacts", "village_impacts.json"],
    ["destinations", "village_destinations.json"],
    ["decay-impacts", "decay_village_impacts.json"],
    ["decay-summary", "decay_summary.json"],
    ["fingerprint", "bridge_fingerprint.json"],
  ]) {
    assert.equal(BRIDGE_RESILIENCE_ASSETS[name].filename, filename);
    const bytes = Buffer.from(`bridge-resilience-${name}`);
    const asset = Object.freeze({
      filename,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    const calls = [];
    const gateway = createBridgeResilienceS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
      client: fakeS3Client(bytes, calls),
      assets: { [name]: asset },
    });
    await gateway.head(asset);
    assert.deepEqual(calls, [{
      Bucket: "migu-private-research-ap-southeast-2",
      Key: `private-research/bridge-resilience/${asset.sha256}/${filename}`,
      ChecksumMode: "ENABLED",
    }]);
  }
});

test("bridge resilience warmup is independent and shares the revoke boundary", async () => {
  const okGateway = {
    async head(asset) { return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; },
    async get(asset, range) {
      return {
        body: Buffer.alloc(range.length), contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream", etag: `"${asset.sha256}"`,
      };
    },
  };
  const failing = { async head() { throw new Error("missing"); } };
  const server = startAllenCoralAtlasServer({
    port: 0, warmupAttempts: 1, config: allenConfig,
    authenticate: async (authorization) => authorization === "Bearer owner" ? allenOwner() : { status: 401 },
    gateway: okGateway, jpWaterGateway: failing, bridgeResilienceGateway: okGateway, revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    await new Promise((resolve) => setTimeout(resolve, 50));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const root = `http://127.0.0.1:${address.port}/api/private-research`;
    const headers = { Authorization: "Bearer owner", Range: "bytes=0-3" };
    // A missing Japan water object must not affect the other families.
    const jp = await fetch(`${root}/jp-water/water`, { headers });
    assert.equal(jp.status, 503);
    assert.equal((await jp.json()).error, "private Japan water sidecar unavailable");
    const allen = await fetch(`${root}/allen-coral-atlas/benthic`, { headers });
    assert.equal(allen.status, 206);
    for (const name of ["tiles", "summary", "impacts", "destinations", "decay-impacts", "decay-summary", "fingerprint"]) {
      const br = await fetch(`${root}/bridge-resilience/${name}?access=1`, { headers: { Authorization: "Bearer owner" } });
      assert.equal(br.status, 200);
    }
    await fetch(`${root}/allen-coral-atlas/revoke`, { method: "POST", headers: { Authorization: "Bearer owner" } });
    for (const name of ["tiles", "summary", "impacts", "destinations", "decay-impacts", "decay-summary", "fingerprint"]) {
      assert.equal((await fetch(`${root}/bridge-resilience/${name}`, { headers })).status, 401);
    }
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("bridge resilience failed warmup fails closed without affecting other families", async () => {
  const okGateway = { async head(asset) { return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; }, async get() { throw new Error("unused"); } };
  const server = startAllenCoralAtlasServer({
    port: 0, warmupAttempts: 1, config: allenConfig, authenticate: allenOwner,
    gateway: okGateway, jpWaterGateway: okGateway,
    bridgeResilienceGateway: { async head() { throw new Error("missing"); } }, revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    await new Promise((resolve) => setTimeout(resolve, 50));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const root = `http://127.0.0.1:${address.port}/api/private-research`;
    for (const name of ["tiles", "summary", "impacts", "destinations", "decay-impacts", "decay-summary", "fingerprint"]) {
      const br = await fetch(`${root}/bridge-resilience/${name}?access=1`, { headers: { Authorization: "Bearer owner" } });
      assert.equal(br.status, 503);
      assert.equal((await br.json()).error, "private bridge resilience sidecar unavailable");
    }
    const jp = await fetch(`${root}/jp-water/water?access=1`, { headers: { Authorization: "Bearer owner" } });
    assert.equal(jp.status, 200);
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("bridge resilience assets pin filename, size and sha256", () => {
  const expected = {
    tiles: ["bridge-resilience-20261002-v4.pmtiles", 2676761, "417bb96b171b215afb6441c9a96bb2407a94f090f20eabc6357e6876311efeeb"],
    summary: ["bridge_summary.json", 361546, "1df50ae635f90e9c7e5ce4e9ae54314e5303ed8a3a041a3d595a168331b8628f"],
    impacts: ["village_impacts.json", 3338743, "fea835ee1fa905c1dfdb5800e1b725b05ec3e6ea1b662fe5aed0f7ef54558697"],
    destinations: ["village_destinations.json", 10034240, "532266b41a992586ba9f8b71116764d1b97e08ded732fbdff00a5d6dd04230a8"],
    "decay-impacts": ["decay_village_impacts.json", 2106225, "f230ac1ab2666678a614050509dc9d0300e4b043be37df821d2277a33155bf2d"],
    "decay-summary": ["decay_summary.json", 137261, "713ade9e59cf19767c97ba3e033c820c1fcb00e8a38fb3b8ff32956ca40819f3"],
    fingerprint: ["bridge_fingerprint.json", 229172, "a0791406d0b44763f8bb85321bb90bd6d2a8371c8f6fe65fe9b18779d7f54280"],
  };

  assert.deepEqual(Object.keys(BRIDGE_RESILIENCE_ASSETS).sort(), Object.keys(expected).sort());
  for (const [name, [filename, size, sha256]] of Object.entries(expected)) {
    assert.deepEqual({ ...BRIDGE_RESILIENCE_ASSETS[name] }, { filename, size, sha256 });
  }
  assert.ok(Object.isFrozen(BRIDGE_RESILIENCE_ASSETS));
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

function busCrowdingRequest(asset = "segments", options = {}) {
  return request(`/api/private-research/bus-crowding/${asset}`, options);
}

test("bus crowding allowlist is fixed: 34 keys without slashes, meta.json excluded", () => {
  const names = Object.keys(BUS_CROWDING_ASSETS);
  assert.equal(names.length, 34);
  assert.ok(Object.isFrozen(BUS_CROWDING_ASSETS));
  for (const name of names) {
    assert.match(name, /^[a-z0-9_-]+$/);
    const asset = BUS_CROWDING_ASSETS[name];
    assert.ok(Object.isFrozen(asset));
    assert.match(asset.filename, /^(segments\.geojson|lines\.json|v(137|180)\/(trips-)?[a-z0-9_]+\.json)$/);
    assert.match(asset.sha256, /^[0-9a-f]{64}$/);
    assert.ok(asset.size > 0 && asset.size <= MAX_RANGE_BYTES);
  }
  assert.ok(!names.some((name) => BUS_CROWDING_ASSETS[name].filename === "meta.json"));
});

test("bus crowding assets enforce owner, probe, range and unknown asset boundaries", async () => {
  const calls = { head: 0, get: 0 };
  const privateGateway = {
    async head(asset) { calls.head += 1; return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; },
    async get(asset, range) {
      calls.get += 1;
      return {
        body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(range.length)); controller.close(); } }),
        contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream",
        etag: `"${asset.sha256}"`,
      };
    },
  };
  const revokedSessions = new Set();
  const deps = (authenticate) => ({ config: allenConfig, authenticate, gateway: privateGateway, revokedSessions });
  assert.equal((await handleBusCrowdingRequest(busCrowdingRequest(), deps(async () => ({ status: 401 })))).status, 401);
  assert.equal((await handleBusCrowdingRequest(busCrowdingRequest(), deps(async () => ({ status: 403 })))).status, 403);
  const probe = await handleBusCrowdingRequest(request("/api/private-research/bus-crowding/segments?access=1"), deps(allenOwner));
  assert.equal(probe.status, 200);
  assert.deepEqual(await probe.json(), { allowed: true });
  assert.equal(calls.head, 0);
  for (const name of Object.keys(BUS_CROWDING_ASSETS)) {
    const range = await handleBusCrowdingRequest(busCrowdingRequest(name, { headers: { Range: "bytes=0-3" } }), deps(allenOwner));
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), `bytes 0-3/${BUS_CROWDING_ASSETS[name].size}`);
    assert.equal(range.headers.get("cache-control"), "private, no-store");
    assert.equal((await range.arrayBuffer()).byteLength, 4);
  }
  assert.equal(calls.get, Object.keys(BUS_CROWDING_ASSETS).length);
  // 只能用白名單 key；路徑、檔名、原型屬性、meta 一律 404，不碰 gateway。
  for (const bad of ["unknown", "constructor", "meta", "meta.json", "segments.geojson", "v137/base", "v137%2Fbase", "..%2Fsegments", "v137-base/extra"]) {
    assert.equal((await handleBusCrowdingRequest(busCrowdingRequest(bad), deps(allenOwner))).status, 404, bad);
  }
  assert.equal(calls.get, Object.keys(BUS_CROWDING_ASSETS).length);
  const missingRange = await handleBusCrowdingRequest(busCrowdingRequest("segments"), deps(allenOwner));
  assert.equal(missingRange.status, 416);
});

test("bus crowding local gateway verifies size and sha256 under the configured root", async () => {
  const { mkdir } = await import("node:fs/promises");
  const bytes = Buffer.from("{\"ov\":[]}");
  const asset = Object.freeze({ filename: "v137/base.json", size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  const dirs = [];
  try {
    for (let i = 0; i < 2; i += 1) {
      const dir = await mkdtemp(join(tmpdir(), "bus-crowding-"));
      dirs.push(dir);
      await mkdir(join(dir, "v137"));
      await writeFile(join(dir, "v137", "base.json"), bytes);
    }
    assert.equal((await createBusCrowdingGateway(dirs[0], { "v137-base": asset }).head(asset)).contentLength, bytes.length);
    const tampered = Object.freeze({ ...asset, sha256: "0".repeat(64) });
    await assert.rejects(createBusCrowdingGateway(dirs[1], { "v137-base": tampered }).head(tampered), /checksum mismatch/);
  } finally {
    for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  }
});

test("bus crowding S3 gateway uses immutable private keys", async () => {
  for (const name of ["segments", "lines", "v137-base", "v180-trips-s5_all_regular"]) {
    const { filename } = BUS_CROWDING_ASSETS[name];
    const bytes = Buffer.from(`bus-crowding-${name}`);
    const asset = Object.freeze({ filename, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    const calls = [];
    const gateway = createBusCrowdingS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
      client: fakeS3Client(bytes, calls),
      assets: { [name]: asset },
    });
    await gateway.head(asset);
    assert.deepEqual(calls, [{
      Bucket: "migu-private-research-ap-southeast-2",
      Key: `private-research/bus-crowding/${asset.sha256}/${filename}`,
      ChecksumMode: "ENABLED",
    }]);
  }
});

test("bus crowding warmup is independent and shares the revoke boundary", async () => {
  const okGateway = {
    async head(asset) { return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; },
    async get(asset, range) {
      return {
        body: Buffer.alloc(range.length), contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream", etag: `"${asset.sha256}"`,
      };
    },
  };
  const failing = { async head() { throw new Error("missing"); } };
  const server = startAllenCoralAtlasServer({
    port: 0, warmupAttempts: 1, config: allenConfig,
    authenticate: async (authorization) => authorization === "Bearer owner" ? allenOwner() : { status: 401 },
    gateway: okGateway, jpWaterGateway: failing, busCrowdingGateway: okGateway, revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    await new Promise((resolve) => setTimeout(resolve, 50));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const root = `http://127.0.0.1:${address.port}/api/private-research`;
    const headers = { Authorization: "Bearer owner", Range: "bytes=0-3" };
    assert.equal((await fetch(`${root}/jp-water/water`, { headers })).status, 503);
    assert.equal((await fetch(`${root}/bus-crowding/segments`, { headers: { Range: "bytes=0-3" } })).status, 401);
    assert.equal((await fetch(`${root}/bus-crowding/segments`, { headers })).status, 206);
    assert.equal((await fetch(`${root}/bus-crowding/v180-trips-base?access=1`, { headers: { Authorization: "Bearer owner" } })).status, 200);
    await fetch(`${root}/allen-coral-atlas/revoke`, { method: "POST", headers: { Authorization: "Bearer owner" } });
    assert.equal((await fetch(`${root}/bus-crowding/segments`, { headers })).status, 401);
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("bus crowding failed warmup fails closed without affecting other families", async () => {
  const okGateway = { async head(asset) { return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; }, async get() { throw new Error("unused"); } };
  const server = startAllenCoralAtlasServer({
    port: 0, warmupAttempts: 1, config: allenConfig, authenticate: allenOwner,
    gateway: okGateway, jpWaterGateway: okGateway,
    busCrowdingGateway: { async head() { throw new Error("missing"); } }, revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    await new Promise((resolve) => setTimeout(resolve, 50));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const root = `http://127.0.0.1:${address.port}/api/private-research`;
    const bus = await fetch(`${root}/bus-crowding/segments?access=1`, { headers: { Authorization: "Bearer owner" } });
    assert.equal(bus.status, 503);
    assert.equal((await bus.json()).error, "private bus crowding sidecar unavailable");
    const jp = await fetch(`${root}/jp-water/water?access=1`, { headers: { Authorization: "Bearer owner" } });
    assert.equal(jp.status, 200);
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

function ownerDataRequest(asset = "livestock-farms", options = {}) {
  return request(`/api/private-research/owner-data/${asset}`, options);
}

test("owner-data allowlist is fixed: lowercase keys without slashes or dots", () => {
  const names = Object.keys(OWNER_DATA_ASSETS);
  assert.ok(names.includes("livestock-farms") && names.includes("livestock-slaughterhouses"));
  assert.ok(Object.isFrozen(OWNER_DATA_ASSETS));
  for (const name of names) {
    assert.match(name, /^[a-z0-9-]+$/);
    const asset = OWNER_DATA_ASSETS[name];
    assert.ok(Object.isFrozen(asset));
    assert.match(asset.filename, /^[a-z0-9_]+\.((geo)?json|pmtiles)$/);
    assert.match(asset.sha256, /^[0-9a-f]{64}$/);
    assert.ok(asset.size > 0);
  }
});

test("owner-data assets enforce owner, probe, range and unknown asset boundaries", async () => {
  const calls = { head: 0, get: 0 };
  const privateGateway = {
    async head(asset) { calls.head += 1; return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; },
    async get(asset, range) {
      calls.get += 1;
      return {
        body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(range.length)); controller.close(); } }),
        contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream",
        etag: `"${asset.sha256}"`,
      };
    },
  };
  const revokedSessions = new Set();
  const deps = (authenticate) => ({ config: allenConfig, authenticate, gateway: privateGateway, revokedSessions });
  assert.equal((await handleOwnerDataRequest(ownerDataRequest(), deps(async () => ({ status: 401 })))).status, 401);
  assert.equal((await handleOwnerDataRequest(ownerDataRequest(), deps(async () => ({ status: 403 })))).status, 403);
  const probe = await handleOwnerDataRequest(request("/api/private-research/owner-data/livestock-farms?access=1"), deps(allenOwner));
  assert.equal(probe.status, 200);
  assert.deepEqual(await probe.json(), { allowed: true });
  assert.equal(calls.head, 0);
  for (const name of Object.keys(OWNER_DATA_ASSETS)) {
    const range = await handleOwnerDataRequest(ownerDataRequest(name, { headers: { Range: "bytes=0-3" } }), deps(allenOwner));
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), `bytes 0-3/${OWNER_DATA_ASSETS[name].size}`);
    assert.equal(range.headers.get("cache-control"), "private, no-store");
    assert.equal((await range.arrayBuffer()).byteLength, 4);
  }
  assert.equal(calls.get, Object.keys(OWNER_DATA_ASSETS).length);
  for (const bad of ["unknown", "constructor", "__proto__", "livestock_farms.geojson", "livestock-farms/x", "..%2Flivestock-farms", "LIVESTOCK-FARMS"]) {
    assert.equal((await handleOwnerDataRequest(ownerDataRequest(bad), deps(allenOwner))).status, 404, bad);
  }
  assert.equal(calls.get, Object.keys(OWNER_DATA_ASSETS).length);
  assert.equal((await handleOwnerDataRequest(ownerDataRequest("livestock-farms"), deps(allenOwner))).status, 416);
});

test("owner-data local gateway verifies size and sha256 under the configured root", async () => {
  const bytes = Buffer.from("{\"type\":\"FeatureCollection\",\"features\":[]}");
  const asset = Object.freeze({ filename: "livestock_farms.geojson", size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  // 本機 gateway 依路徑快取驗證結果，所以竄改案例用另一個目錄
  const dirs = [];
  try {
    for (let i = 0; i < 2; i += 1) {
      const dir = await mkdtemp(join(tmpdir(), "owner-data-"));
      dirs.push(dir);
      await writeFile(join(dir, "livestock_farms.geojson"), bytes);
    }
    assert.equal((await createOwnerDataGateway(dirs[0], { "livestock-farms": asset }).head(asset)).contentLength, bytes.length);
    const tampered = Object.freeze({ ...asset, sha256: "0".repeat(64) });
    await assert.rejects(createOwnerDataGateway(dirs[1], { "livestock-farms": tampered }).head(tampered), /checksum mismatch/);
  } finally {
    for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  }
});

test("owner-data S3 gateway uses immutable private keys", async () => {
  for (const name of Object.keys(OWNER_DATA_ASSETS)) {
    const { filename } = OWNER_DATA_ASSETS[name];
    const bytes = Buffer.from(`owner-data-${name}`);
    const asset = Object.freeze({ filename, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    const calls = [];
    const gateway = createOwnerDataS3Gateway({ accessKeyId: "test", secretAccessKey: "test", region: "ap-southeast-2" }, {
      client: fakeS3Client(bytes, calls),
      assets: { [name]: asset },
    });
    await gateway.head(asset);
    assert.deepEqual(calls, [{
      Bucket: "migu-private-research-ap-southeast-2",
      Key: `private-research/owner-data/${asset.sha256}/${filename}`,
      ChecksumMode: "ENABLED",
    }]);
  }
});

test("owner-data is lazy: served while other families fail warmup, never fetched at startup", async () => {
  let ownerHeads = 0;
  const ownerGateway = {
    async head(asset) { ownerHeads += 1; return { contentLength: asset.size, contentType: "application/octet-stream", etag: `"${asset.sha256}"` }; },
    async get(asset, range) {
      return {
        body: Buffer.alloc(range.length), contentLength: range.length,
        contentRange: `bytes ${range.start}-${range.end}/${asset.size}`,
        contentType: "application/octet-stream", etag: `"${asset.sha256}"`,
      };
    },
  };
  const failing = { async head() { throw new Error("missing"); } };
  const server = startAllenCoralAtlasServer({
    port: 0, warmupAttempts: 1, config: allenConfig,
    authenticate: async (authorization) => authorization === "Bearer owner" ? allenOwner() : { status: 401 },
    gateway: failing, jpWaterGateway: failing, soilLiquefactionGateway: failing, bssBridgeGateway: failing,
    bridgeResilienceGateway: failing, busCrowdingGateway: failing, ownerDataGateway: ownerGateway, revokedSessions: new Set(),
  });
  try {
    await once(server, "listening");
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(ownerHeads, 0);
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const root = `http://127.0.0.1:${address.port}/api/private-research`;
    const headers = { Authorization: "Bearer owner", Range: "bytes=0-3" };
    assert.equal((await fetch(`${root}/bus-crowding/segments`, { headers })).status, 503);
    assert.equal((await fetch(`${root}/owner-data/livestock-farms`, { headers: { Range: "bytes=0-3" } })).status, 401);
    assert.equal((await fetch(`${root}/owner-data/livestock-farms?access=1`, { headers: { Authorization: "Bearer owner" } })).status, 200);
    assert.equal(ownerHeads, 0);
    assert.equal((await fetch(`${root}/owner-data/livestock-slaughterhouses`, { headers })).status, 206);
    assert.equal((await fetch(`${root}/owner-data/nope`, { headers })).status, 404);
    await fetch(`${root}/allen-coral-atlas/revoke`, { method: "POST", headers: { Authorization: "Bearer owner" } });
    assert.equal((await fetch(`${root}/owner-data/livestock-farms`, { headers })).status, 401);
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
