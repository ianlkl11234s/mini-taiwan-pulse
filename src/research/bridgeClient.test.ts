import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { BRIDGE_TIMEOUT_MS, BRIDGE_WAIT_TIMEOUT_MS, BROWSER_WAIT_HOLD_MS, BridgeClient, BridgeError, MAX_BRIDGE_RESPONSE_BYTES, MAX_RESULT_BYTES, RESEARCH_API_PREFIX, RESULT_FETCH_TIMEOUT_MS, visibleResultIds, warehouseBaseResultId } from "./bridgeClient";

const gatewayRoot = process.env.PULSE_RESEARCH_GATEWAY_ROOT;

const state = { studyId: "study-1", tabId: "tab-1", revision: 0, scene: { camera: { center: [121.525, 25.025], zoom: 12 }, resultMode: "empty" }, view: { revision: 0, phase: "empty" }, connected: true, paused: false, pendingCommand: null };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

describe("BridgeClient", () => {
  it("uses fixed same-origin JSON POST and does not expose token in URL or body", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(state));
    const client = new BridgeClient(async () => "secret-token", fetcher);
    await client.sync("study-1", "tab-1");
    expect(fetcher).toHaveBeenCalledWith(`${RESEARCH_API_PREFIX}/browser/sync`, expect.objectContaining({ method: "POST", redirect: "error", cache: "no-store", headers: { "content-type": "application/json", authorization: "Bearer secret-token" }, body: JSON.stringify({ studyId: "study-1", tabId: "tab-1" }) }));
  });

  it("relays consented network operations through the authenticated same-origin gateway", async () => {
    const providerResponse = { graph: { engineVersion: "3.5.1" }, payload: { type: "FeatureCollection", features: [] } };
    const fetcher = vi.fn().mockResolvedValue(response(providerResponse));
    const client = new BridgeClient(async () => "secret-token", fetcher);
    const args = { center: [121.5, 25], contoursMinutes: [5], provider: "valhalla", externalConsent: true };
    await expect(client.networkProvider("study-1", "tab-1", "walking_isochrone", args)).resolves.toEqual(providerResponse);
    expect(fetcher).toHaveBeenCalledWith(`${RESEARCH_API_PREFIX}/browser/network-provider`, expect.objectContaining({
      method: "POST", headers: { "content-type": "application/json", authorization: "Bearer secret-token" },
      body: JSON.stringify({ studyId: "study-1", tabId: "tab-1", operation: "walking_isochrone", args }),
    }));
  });

  it("calls the default browser fetch without BridgeClient as this", async () => {
    let receiver: unknown = "not-called";
    vi.stubGlobal("fetch", function (this: unknown) { receiver = this; return Promise.resolve(response(state)); });
    try {
      const client = new BridgeClient(async () => "token");
      await client.sync("study-1", "tab-1");
      expect(receiver).not.toBe(client);
    } finally { vi.unstubAllGlobals(); }
  });

  it("rejects missing auth, malformed response, bounded response and sanitized errors", async () => {
    await expect(new BridgeClient(async () => null, vi.fn()).sync("study-1", "tab-1")).rejects.toMatchObject({ code: "AUTH_REQUIRED" } satisfies Partial<BridgeError>);
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ nope: true }))).sync("study-1", "tab-1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" } satisfies Partial<BridgeError>);
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ error: { code: "unsafe value from upstream" } }, 500))).sync("study-1", "tab-1")).rejects.toMatchObject({ code: "BRIDGE_REQUEST_FAILED" } satisfies Partial<BridgeError>);
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(new Response("x".repeat(MAX_BRIDGE_RESPONSE_BYTES + 1)))).sync("study-1", "tab-1")).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" } satisfies Partial<BridgeError>);
  });

  it("keeps Retry-After for conservative client scheduling and validates safe resume metadata", async () => {
    const limited = new Response(JSON.stringify({ error: { code: "RATE_LIMITED" } }), { status: 429, headers: { "content-type": "application/json", "retry-after": "7" } });
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(limited)).sync("study-1", "tab-1")).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterMs: 7_000 });
    const resume = { studyId: "study-1", tabId: "tab-1", session: { active: true, sessionId: "session-1", expiresAt: 123, hardExpiresAt: 456 }, snapshot: state };
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response(resume))).browserStatus("study-1", "tab-1")).resolves.toMatchObject({ session: { active: true }, snapshot: { studyId: "study-1" } });
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ ...resume, snapshot: { ...state, tabId: "other" } }))).browserStatus("study-1", "tab-1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("accepts bounded layer, spatial, and network query operations in the wait envelope", async () => {
    for (const operation of ["describe_layer_statistics", "summarize_layer", "list_layer_capabilities", "search_layer_records", "create_analysis_scope", "spatial_query", "aggregate_by_area", "route_distance", "walking_isochrone"]) {
      const request = { requestId: "query-1", operation, args: { layerKey: "schools" }, expiresAt: Date.now() + 30_000 };
      const envelope = { version: "0f1e2d3c4b5a6978", snapshot: state, request, agent: { deviceLabel: null } };
      await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response(envelope))).wait("study-1", "tab-1", null, null, true)).resolves.toMatchObject({ request });
    }
    const unknown = { version: "0f1e2d3c4b5a6978", snapshot: state, request: { requestId: "q", operation: "run_sql", args: {}, expiresAt: 1 }, agent: { deviceLabel: null } };
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response(unknown))).wait("study-1", "tab-1", null, null, true)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects shallow or extra state", async () => {
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ ...state, scene: { resultMode: "empty" } }))).sync("study-1", "tab-1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" } satisfies Partial<BridgeError>);
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ ...state, extra: true }))).sync("study-1", "tab-1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" } satisfies Partial<BridgeError>);
  });

  it("accepts cleared and valid focus, but rejects malformed focus", async () => {
    for (const focus of [null, { resultId: "result-1", recordId: "row:1" }]) {
      const client = new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ ...state, scene: { ...state.scene, focus } })));
      await expect(client.sync("study-1", "tab-1")).resolves.toMatchObject({ scene: { focus } });
    }
    const client = new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ ...state, scene: { ...state.scene, focus: { resultId: "r" } } })));
    await expect(client.sync("study-1", "tab-1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("normalizes legacy result references and accepts canonical ordered visibility groups", async () => {
    for (const results of [null, { resultIds: ["analysis-nearest-1"] }, { resultIds: Array.from({ length: 8 }, (_, index) => `result-${index + 1}`) }]) {
      const client = new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ ...state, scene: { ...state.scene, results } })));
      const synced = await client.sync("study-1", "tab-1");
      expect(synced.scene.results).toEqual(results === null ? null : { items: results.resultIds.map(resultId => ({ resultId, visible: true, groupId: null })), groups: [] });
    }
    const canonical = { items: [{ resultId: "school-result", visible: true, groupId: "education" }, { resultId: "hidden-result", visible: false, groupId: null }, { resultId: "group-hidden", visible: true, groupId: "hidden" }], groups: [{ groupId: "education", label: "教育", visible: true }, { groupId: "hidden", label: "不顯示", visible: false }] };
    const client = new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ ...state, scene: { ...state.scene, results: canonical } })));
    await expect(client.sync("study-1", "tab-1")).resolves.toMatchObject({ scene: { results: canonical } });
    expect(visibleResultIds(canonical)).toEqual(["school-result"]);
    for (const results of [{ resultIds: [] }, { resultIds: ["same", "same"] }, { resultIds: Array.from({ length: 9 }, (_, index) => String(index + 1)) }]) {
      const client = new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ ...state, scene: { ...state.scene, results } })));
      await expect(client.sync("study-1", "tab-1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    }
    for (const results of [
      { items: [{ resultId: "same", visible: true, groupId: null }, { resultId: "same", visible: true, groupId: null }], groups: [] },
      { items: [{ resultId: "orphan", visible: true, groupId: "none" }], groups: [] },
      { items: [{ resultId: "ok", visible: true, groupId: null }], groups: [{ groupId: "bad", label: "", visible: true }] },
    ]) {
      const client = new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ ...state, scene: { ...state.scene, results } })));
      await expect(client.sync("study-1", "tab-1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    }
  });

  it("accepts one bounded layer-control scene value and rejects malformed values", async () => {
    const layerControl = { layerKey: "schools", controlId: "schoolsOpacity", value: 0.5, expectedValue: 0.8 };
    const client = new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ ...state, scene: { ...state.scene, layerControl } })));
    await expect(client.sync("study-1", "tab-1")).resolves.toMatchObject({ scene: { layerControl } });
    const invalid = new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ ...state, scene: { ...state.scene, layerControl: { ...layerControl, value: Number.NaN } } })));
    await expect(invalid.sync("study-1", "tab-1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("accepts time and viewport scenes while rejecting malformed command fields", async () => {
    const framing = { bounds: [119,21,123,26], padding: 24, maxZoom: 12 };
    const timeline = { mode: "replay", time: 1789603200, playing: false, speed: 60 };
    const client = new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ ...state, scene: { ...state.scene, framing, timeline } })));
    await expect(client.sync("study-1", "tab-1")).resolves.toMatchObject({ scene: { framing, timeline } });
    for (const invalid of [{ framing: {...framing, bounds:[123,21,119,26]} }, { timeline: { mode:"replay" } }, { timeline: { mode:"live",playing:true } }]) {
      const broken = new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ ...state, scene: { ...state.scene, ...invalid } })));
      await expect(broken.sync("study-1", "tab-1")).rejects.toMatchObject({ code:"INVALID_RESPONSE" });
    }
  });

  it.skipIf(!gatewayRoot)("parses real gateway agent tokens, token bind and pending command state", async () => {
    const { join } = await import("node:path");
    const { pathToFileURL } = await import("node:url");
    const { createGateway } = await import(pathToFileURL(join(gatewayRoot!, "server.mjs")).href);
    const { MemoryPairingStore } = await import(pathToFileURL(join(gatewayRoot!, "pairing-service.mjs")).href);
    const handle = createGateway({ store: new MemoryPairingStore(), verifyBrowser: async (header: string) => header === "Bearer browser-token" ? { verified: true, accountId: "owner-1" } : (() => { throw new Error("AUTH_REQUIRED"); })(), origins: [] });
    const fetcher: typeof fetch = async (url, init) => handle(new Request(new URL(String(url), "http://gateway.local").href, init), { callerIp: "127.0.0.1" });
    const client = new BridgeClient(async () => "browser-token", fetcher);
    const study = await client.createStudy("tab-1");
    const created = await client.createAgentToken("Claude Code");
    expect(created).toMatchObject({ label: "Claude Code" });
    const listed = await client.listAgentTokens();
    expect(listed).toEqual([{ tokenId: created.tokenId, label: "Claude Code", createdAt: created.createdAt, expiresAt: created.expiresAt, lastUsedAt: null, activeSessions: 0 }]);
    expect(JSON.stringify(listed)).not.toContain(created.token);
    const publicPost = (path: string, body: object, authorization?: string) => handle(new Request(`http://gateway.local${RESEARCH_API_PREFIX}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) }, body: JSON.stringify(body) }), { callerIp: "127.0.0.1" });
    await client.sync(study.studyId, study.tabId); // tab seen → listed and bindable without any pairing code
    const tabs = await (await publicPost("/agent/tabs", {}, `Agent ${created.token}`)).json() as { tabs: { studyId: string; tabLabel: string; agent: string }[] };
    expect(tabs.tabs).toEqual([expect.objectContaining({ studyId: study.studyId, tabLabel: "TAB1", agent: "none" })]);
    const exchanged = await (await publicPost("/agent/bind", { studyId: study.studyId, deviceLabel: "Claude-macbook" }, `Agent ${created.token}`)).json() as { credential: string; sessionId: string };
    await expect(client.listAgentTokens()).resolves.toEqual([expect.objectContaining({ tokenId: created.tokenId, activeSessions: 1 })]);
    await expect(client.sync(study.studyId, study.tabId)).resolves.toMatchObject({ studyId: study.studyId, pendingCommand: null });
    const manuallyMoved = await client.manual(study.studyId, study.tabId, 0, { camera: { center: [120.63, 24.16], zoom: 11 }, resultMode: "empty", focus: null });
    expect(manuallyMoved).toMatchObject({ revision: 1, paused: false, scene: { focus: null } });
    await expect(client.sync(study.studyId, study.tabId)).resolves.toMatchObject({ scene: { focus: null }, paused: false });
    const canonicalResults = { items: [{ resultId: "analysis-nearest-1", visible: true, groupId: null }], groups: [] };
    const commandResponse = await publicPost("/commands", { protocolVersion: "1", sessionId: exchanged.sessionId, studyId: study.studyId, tabId: study.tabId, commandId: "command-1", expectedRevision: 1, expiresAt: Date.now() + 10_000, patch: { layers: { schools: true }, focus: null, results: canonicalResults } }, `Research ${exchanged.credential}`);
    expect(commandResponse.status).toBe(200);
    await expect(client.sync(study.studyId, study.tabId)).resolves.toMatchObject({ studyId: study.studyId, pendingCommand: { commandId: "command-1", patch: { layers: { schools: true }, focus: null, results: canonicalResults } } });
    await client.revokeAgentToken(created.tokenId);
    await expect(client.listAgentTokens()).resolves.toEqual([]);
    await expect(client.revokeAgentToken(created.tokenId)).rejects.toMatchObject({ code: "TOKEN_NOT_FOUND" });
  }, 15_000);
});

describe("BridgeClient P1 result channel", () => {
  const studyId = "a".repeat(32);
  const tabId = "3f9a2b1c-0000-4000-8000-000000000000";

  it("GETs result bytes on the base id with Bearer auth, no body, no query string", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{\"type\":\"FeatureCollection\",\"features\":[]}", { headers: { "content-type": "application/geo+json", "x-result-sha256": "ignored" } }));
    const client = new BridgeClient(async () => "secret-token", fetcher);
    await expect(client.fetchResult(studyId, tabId, "wh-3:point")).resolves.toBe("{\"type\":\"FeatureCollection\",\"features\":[]}");
    expect(fetcher).toHaveBeenCalledWith(`${RESEARCH_API_PREFIX}/browser/results/${studyId}/${tabId}/wh-3`, expect.objectContaining({ method: "GET", redirect: "error", cache: "no-store", headers: { authorization: "Bearer secret-token" } }));
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty("body");
    expect(warehouseBaseResultId("wh-12:multipolygon")).toBe("wh-12");
    expect(warehouseBaseResultId("analysis-1")).toBeNull();
    await expect(client.fetchResult("not-a-study", tabId, "wh-3")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(client.fetchResult(studyId, tabId, "../wh-3")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("maps gateway JSON errors (401/404) to bridge codes", async () => {
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ error: { code: "RESULT_NOT_FOUND" } }, 404))).fetchResult(studyId, tabId, "wh-3")).rejects.toMatchObject({ code: "RESULT_NOT_FOUND" });
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ error: { code: "AUTH_REQUIRED" } }, 401))).fetchResult(studyId, tabId, "wh-3")).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(new Response("<html>", { status: 502 }))).fetchResult(studyId, tabId, "wh-3")).rejects.toMatchObject({ code: "BRIDGE_REQUEST_FAILED" });
  });

  it("aborts a result body larger than 24 MiB, by header or while streaming", async () => {
    let pulled = 0; let cancelled = false;
    const chunk = new Uint8Array(1024 * 1024);
    const body = new ReadableStream<Uint8Array>({ pull(controller) { pulled += 1; controller.enqueue(chunk); }, cancel() { cancelled = true; } });
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(new Response(body))).fetchResult(studyId, tabId, "wh-3")).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThanOrEqual(MAX_RESULT_BYTES / chunk.byteLength + 2);
    const declared = new Response("x", { headers: { "content-length": String(MAX_RESULT_BYTES + 1) } });
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(declared)).fetchResult(studyId, tabId, "wh-3")).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });

  it("uses a 30 s budget for result bytes", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn((_input: unknown, init: RequestInit) => new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
      const pending = new BridgeClient(async () => "t", fetcher as unknown as typeof fetch).fetchResult(studyId, tabId, "wh-3");
      const settled = expect(pending).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
      await vi.advanceTimersByTimeAsync(8_000);
      expect(fetcher.mock.calls[0]?.[1].signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(RESULT_FETCH_TIMEOUT_MS - 8_000);
      await settled;
    } finally { vi.useRealTimers(); }
  });

  it("posts meta requests and validates the strict envelope", async () => {
    const meta = { results: [{ resultId: "wh-3", sha256: "b".repeat(64), bytes: 120034, label: "台北車站周邊", featureCount: 40, style: null }], missing: ["wh-5"] };
    const fetcher = vi.fn().mockResolvedValue(response(meta));
    await expect(new BridgeClient(async () => "t", fetcher).resultsMeta(studyId, tabId, ["wh-3", "wh-5"])).resolves.toEqual(meta);
    expect(fetcher).toHaveBeenCalledWith(`${RESEARCH_API_PREFIX}/browser/results/meta`, expect.objectContaining({ method: "POST", body: JSON.stringify({ studyId, tabId, resultIds: ["wh-3", "wh-5"] }) }));
    for (const bad of [{ results: [], missing: [], extra: 1 }, { results: [{ ...meta.results[0], sha256: "X" }], missing: [] }, { results: [], missing: ["../x"] }]) {
      await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response(bad))).resultsMeta(studyId, tabId, ["wh-3"])).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    }
  });
});

describe("BridgeClient P2 long poll", () => {
  const envelope = { version: "0f1e2d3c4b5a6978", snapshot: state, request: null, agent: { deviceLabel: null } };
  it("posts the wait body with a 20 s hold and validates the exact envelope", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(envelope));
    await expect(new BridgeClient(async () => "t", fetcher).wait("study-1", "tab-1", "a1b2c3d4e5f60718", "query-9", false)).resolves.toMatchObject({ version: envelope.version, snapshot: { studyId: "study-1" }, request: null, agent: { deviceLabel: null } });
    expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual({ studyId: "study-1", tabId: "tab-1", knownVersion: "a1b2c3d4e5f60718", inFlightRequestId: "query-9", acceptQueries: false, waitMs: BROWSER_WAIT_HOLD_MS });
    expect(fetcher.mock.calls[0]?.[0]).toBe(`${RESEARCH_API_PREFIX}/browser/wait`);
    for (const bad of [{ ...envelope, extra: 1 }, { ...envelope, version: "short" }, { ...envelope, agent: { deviceLabel: null, sessionExpiresAt: 1 } }, { ...envelope, snapshot: { ...state, extra: true } }]) {
      await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response(bad))).wait("study-1", "tab-1", null, null, true)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    }
  });

  it("keeps the timeout chain ordered (hold < gateway 25 s < bridge wait < nginx 30 s < Cloudflare 100 s; hold < 45 s activity)", () => {
    const GATEWAY_WAIT_TIMER_MS = 25_000, NGINX_READ_MS = 30_000, CLOUDFLARE_MS = 100_000, ACTIVE_WINDOW_MS = 45_000;
    expect(BROWSER_WAIT_HOLD_MS).toBe(20_000);
    expect(BRIDGE_WAIT_TIMEOUT_MS).toBe(27_000);
    expect(BROWSER_WAIT_HOLD_MS).toBeLessThan(GATEWAY_WAIT_TIMER_MS);
    expect(GATEWAY_WAIT_TIMER_MS).toBeLessThan(BRIDGE_WAIT_TIMEOUT_MS);
    expect(BRIDGE_WAIT_TIMEOUT_MS).toBeLessThan(NGINX_READ_MS);
    expect(NGINX_READ_MS).toBeLessThan(CLOUDFLARE_MS);
    expect(BROWSER_WAIT_HOLD_MS).toBeLessThan(ACTIVE_WINDOW_MS);
    expect(BRIDGE_TIMEOUT_MS).toBe(8_000);
    expect(nginxReadTimeout("/api/research/v1/")).toBe(NGINX_READ_MS);
  });
});

function nginxReadTimeout(prefix: string): number {
  const conf = readFileSync("nginx.conf", "utf8");
  const block = conf.slice(conf.indexOf(`location ^~ ${prefix} {`));
  return Number(/proxy_read_timeout (\d+)s;/.exec(block.slice(0, block.indexOf("\n    }")))?.[1]) * 1_000;
}

describe("BridgeClient P3 agent tokens", () => {
  const tokenId = "0123456789abcdef0123456789abcdef";
  const secret = `pat_${"A".repeat(43)}`;
  const created = { tokenId, token: secret, label: "Claude Code", createdAt: 1_000, expiresAt: 1_000 + 30 * 86_400_000 };
  const summary = { tokenId, label: "Claude Code", createdAt: 1_000, expiresAt: 1_000 + 30 * 86_400_000, lastUsedAt: null, activeSessions: 0 };

  it("posts the three token endpoints with Bearer auth and exact bodies", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(created))
      .mockResolvedValueOnce(response({ tokens: [summary, { ...summary, tokenId: "f".repeat(32), lastUsedAt: 2_000, activeSessions: 1 }] }))
      .mockResolvedValueOnce(response({ revoked: true }));
    const client = new BridgeClient(async () => "owner", fetcher);
    await expect(client.createAgentToken("Claude Code")).resolves.toEqual(created);
    await expect(client.listAgentTokens()).resolves.toHaveLength(2);
    await expect(client.revokeAgentToken(tokenId)).resolves.toBeUndefined();
    const calls = fetcher.mock.calls.map(([url, init]) => [url, (init as RequestInit).body, ((init as RequestInit).headers as Record<string, string>).authorization]);
    expect(calls).toEqual([
      [`${RESEARCH_API_PREFIX}/agent-tokens/create`, JSON.stringify({ label: "Claude Code" }), "Bearer owner"],
      [`${RESEARCH_API_PREFIX}/agent-tokens/list`, JSON.stringify({}), "Bearer owner"],
      [`${RESEARCH_API_PREFIX}/agent-tokens/revoke`, JSON.stringify({ tokenId }), "Bearer owner"],
    ]);
  });

  it("rejects malformed create responses", async () => {
    for (const bad of [
      { ...created, token: "not-a-token" },
      { ...created, tokenId: "XYZ" },
      { ...created, label: "" },
      { ...created, expiresAt: "soon" },
      { ...created, extra: true },
      { tokenId, label: "Claude Code", createdAt: 1, expiresAt: 2 },
    ]) await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response(bad))).createAgentToken("Claude Code")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects list items that leak a secret or carry malformed fields", async () => {
    for (const bad of [
      { ...summary, token: secret },
      { ...summary, tokenId: "short" },
      { ...summary, lastUsedAt: "never" },
      { ...summary, activeSessions: -1 },
      { ...summary, activeSessions: 1.5 },
    ]) await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ tokens: [bad] }))).listAgentTokens()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ tokens: Array.from({ length: 51 }, () => summary) }))).listAgentTokens()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response([summary]))).listAgentTokens()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("requires exactly { revoked: true } and keeps the gateway error code", async () => {
    for (const bad of [{ revoked: false }, { revoked: true, studyIds: [] }, {}]) {
      await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response(bad))).revokeAgentToken(tokenId)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    }
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ error: { code: "TOKEN_NOT_FOUND" } }, 404))).revokeAgentToken(tokenId)).rejects.toMatchObject({ code: "TOKEN_NOT_FOUND" });
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ error: { code: "TOKEN_LIMIT" } }, 409))).createAgentToken("x")).rejects.toMatchObject({ code: "TOKEN_LIMIT" });
  });

  it("no longer exposes the pairing-code methods", () => {
    const client = new BridgeClient(async () => "t", vi.fn()) as unknown as Record<string, unknown>;
    for (const removed of ["createPairing", "pairingStatus", "approve"]) expect(client[removed]).toBeUndefined();
  });
});
