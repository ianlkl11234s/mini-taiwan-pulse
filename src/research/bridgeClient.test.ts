import { describe, expect, it, vi } from "vitest";
import { BridgeClient, BridgeError, MAX_BRIDGE_RESPONSE_BYTES, RESEARCH_API_PREFIX } from "./bridgeClient";

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

  it("accepts unclaimed pairing null fields and rejects shallow or extra state", async () => {
    const client = new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response({ pairingId: "pairing-1", claimed: false, approved: false, deviceLabel: null, phrase: null })));
    await expect(client.pairingStatus("pairing-1", "tab-1")).resolves.toMatchObject({ claimed: false, phrase: null });
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

  it.skipIf(!gatewayRoot)("parses real gateway pairing status and pending command state", async () => {
    const { join } = await import("node:path");
    const { pathToFileURL } = await import("node:url");
    const { createGateway } = await import(pathToFileURL(join(gatewayRoot!, "server.mjs")).href);
    const { MemoryPairingStore } = await import(pathToFileURL(join(gatewayRoot!, "pairing-service.mjs")).href);
    const handle = createGateway({ store: new MemoryPairingStore(), verifyBrowser: async (header: string) => header === "Bearer browser-token" ? { verified: true, accountId: "owner-1" } : (() => { throw new Error("AUTH_REQUIRED"); })(), origins: [] });
    const fetcher: typeof fetch = async (url, init) => handle(new Request(new URL(String(url), "http://gateway.local").href, init), { callerIp: "127.0.0.1" });
    const client = new BridgeClient(async () => "browser-token", fetcher);
    const study = await client.createStudy("tab-1");
    const pairing = await client.createPairing(study.studyId, study.tabId);
    const beforeClaim = await client.pairingStatus(pairing.pairingId, study.tabId);
    expect(beforeClaim).toMatchObject({ pairingId: pairing.pairingId, claimed: false, deviceLabel: null });
    const publicPost = (path: string, body: object, credential?: string) => handle(new Request(`http://gateway.local${RESEARCH_API_PREFIX}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(credential ? { authorization: `Research ${credential}` } : {}) }, body: JSON.stringify(body) }), { callerIp: "127.0.0.1" });
    const claim = await (await publicPost("/pairings/claim", { pairingId: pairing.pairingId, code: pairing.code, deviceLabel: "codex-local" })).json() as { claimSecret: string; phrase: string };
    const claimed = await client.pairingStatus(pairing.pairingId, study.tabId);
    expect(claimed).toMatchObject({ pairingId: pairing.pairingId, claimed: true, phrase: claim.phrase });
    await client.approve(pairing.pairingId, study.tabId, claim.phrase);
    const exchanged = await (await publicPost("/pairings/exchange", { pairingId: pairing.pairingId, claimSecret: claim.claimSecret })).json() as { credential: string; sessionId: string };
    await expect(client.sync(study.studyId, study.tabId)).resolves.toMatchObject({ studyId: study.studyId, pendingCommand: null });
    const manuallyMoved = await client.manual(study.studyId, study.tabId, 0, { camera: { center: [120.63, 24.16], zoom: 11 }, resultMode: "empty", focus: null });
    expect(manuallyMoved).toMatchObject({ revision: 1, paused: false, scene: { focus: null } });
    await expect(client.sync(study.studyId, study.tabId)).resolves.toMatchObject({ scene: { focus: null }, paused: false });
    const commandResponse = await publicPost("/commands", { protocolVersion: "1", sessionId: exchanged.sessionId, studyId: study.studyId, tabId: study.tabId, commandId: "command-1", expectedRevision: 1, expiresAt: Date.now() + 10_000, patch: { layers: { schools: true }, focus: null } }, exchanged.credential);
    expect(commandResponse.status).toBe(200);
    await expect(client.sync(study.studyId, study.tabId)).resolves.toMatchObject({ studyId: study.studyId, pendingCommand: { commandId: "command-1", patch: { layers: { schools: true }, focus: null } } });
  });
});
