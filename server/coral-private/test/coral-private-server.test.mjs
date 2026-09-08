import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPECTED_SHA256,
  EXPECTED_SIZE,
  MAX_RANGE_BYTES,
  getConfig,
  handleCoralRequest,
  parseRange,
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

const owner = async () => ({ status: 200 });

test("Range accepts exactly one bounded byte range", () => {
  assert.deepEqual(parseRange("bytes=0-0"), { start: 0, end: 0, length: 1 });
  assert.equal(parseRange(`bytes=0-${MAX_RANGE_BYTES - 1}`).length, MAX_RANGE_BYTES);
  assert.equal(parseRange("bytes=0-"), null);
  assert.equal(parseRange("bytes=-100"), null);
  assert.equal(parseRange("bytes=0-1,4-5"), null);
  assert.equal(parseRange(`bytes=0-${MAX_RANGE_BYTES}`), null);
});

test("Supabase server settings accept non-secret VITE fallbacks", () => {
  const resolved = getConfig({
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_ANON_KEY: "anon-key",
    S3_ACCESS_KEY: "access-key",
    S3_SECRET_KEY: "secret-key",
    CORAL_PRIVATE_BUCKET: "migu-gis-data-collector",
    CORAL_PRIVATE_KEY: "private-research/coral-reef/v4.1/coral.pmtiles",
    CORAL_PRIVATE_REGION: "ap-southeast-2",
  });
  assert.equal(resolved.supabaseUrl, "https://example.supabase.co");
  assert.equal(resolved.supabaseAnonKey, "anon-key");
});

test("missing configuration fails closed", async () => {
  const output = await handleCoralRequest(request(), { config: { error: "configuration unavailable" } });
  assert.equal(output.status, 503);
  assert.equal(output.headers.get("cache-control"), "private, no-store");
});

test("only the coral endpoint is served", async () => {
  const output = await handleCoralRequest(request("/api/private-research/other"), { config, authenticate: owner });
  assert.equal(output.status, 404);
});

test("CORS only reflects an exact configured origin", async () => {
  const denied = await handleCoralRequest(request("/api/private-research/coral", { headers: { Origin: "https://attacker.example" } }), { config, authenticate: owner });
  assert.equal(denied.status, 403);
  const options = await handleCoralRequest(request("/api/private-research/coral", { method: "OPTIONS", headers: { Origin: "https://pulse.example.test" } }), { config });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-origin"), "https://pulse.example.test");
  assert.equal(options.headers.get("access-control-allow-headers"), "Authorization, Range");
});

test("authentication is required, and only the fixed owner is authorized", async () => {
  const unauthenticated = await handleCoralRequest(request(), { config, authenticate: async () => ({ status: 401 }) });
  assert.equal(unauthenticated.status, 401);
  const otherUser = await handleCoralRequest(request(), { config, authenticate: async () => ({ status: 403 }) });
  assert.equal(otherUser.status, 403);
});

test("access probe is authorized and does not read S3", async () => {
  const s3 = gateway();
  const output = await handleCoralRequest(request("/api/private-research/coral?access=1"), { config, authenticate: owner, gateway: s3 });
  assert.equal(output.status, 200);
  assert.deepEqual(await output.json(), { allowed: true });
  assert.equal(s3.calls.head, 0);
  assert.equal(s3.calls.get, 0);
});

test("HEAD returns verified private metadata without fetching object bytes", async () => {
  const s3 = gateway();
  const output = await handleCoralRequest(request("/api/private-research/coral", { method: "HEAD" }), { config, authenticate: owner, gateway: s3 });
  assert.equal(output.status, 200);
  assert.equal(output.headers.get("content-length"), String(EXPECTED_SIZE));
  assert.equal(output.headers.get("etag"), '"coral-etag"');
  assert.equal(s3.calls.head, 1);
  assert.equal(s3.calls.get, 0);
});

test("GET requires Range and proxies only the verified byte window", async () => {
  const s3 = gateway();
  const missingRange = await handleCoralRequest(request(), { config, authenticate: owner, gateway: s3 });
  assert.equal(missingRange.status, 416);
  assert.equal(missingRange.headers.get("content-range"), `bytes */${EXPECTED_SIZE}`);

  const output = await handleCoralRequest(request("/api/private-research/coral", { headers: { Range: "bytes=0-3" } }), { config, authenticate: owner, gateway: s3 });
  assert.equal(output.status, 206);
  assert.equal(output.headers.get("content-range"), `bytes 0-3/${EXPECTED_SIZE}`);
  assert.equal(output.headers.get("content-length"), "4");
  assert.equal(output.headers.get("cache-control"), "private, no-store");
  assert.equal(await output.text(), "data");
  assert.equal(s3.calls.get, 1);
  assert.equal(s3.calls.ifMatch, '"coral-etag"');
});

test("integrity and S3 range mismatches fail closed", async () => {
  const wrongChecksum = gateway({ head: { checksumSHA256: Buffer.from("wrong").toString("base64") } });
  const integrity = await handleCoralRequest(request("/api/private-research/coral", { method: "HEAD" }), { config, authenticate: owner, gateway: wrongChecksum });
  assert.equal(integrity.status, 502);

  const wrongRange = gateway({ get: { contentRange: `bytes 1-4/${EXPECTED_SIZE}` } });
  const range = await handleCoralRequest(request("/api/private-research/coral", { headers: { Range: "bytes=0-3" } }), { config, authenticate: owner, gateway: wrongRange });
  assert.equal(range.status, 502);
});
