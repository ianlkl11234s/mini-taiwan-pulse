#!/usr/bin/env node
/**
 * Offline MCP evaluation harness. It reads only registered Pulse public assets;
 * it is a data/reasoning check, never a login, browser, or presentation check.
 */
import { access, appendFile, readFile, realpath, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_PULSE_ROOT = "/private/tmp/pulse-research-open-ended-20260915";
const DEFAULT_MCP_ROOT = "/private/tmp/pulse-research-open-ended-mcp-20260915";
const ANALYSIS_OPERATIONS = new Set(["compare_neighborhoods", "spatial_query", "aggregate_records", "join_records", "calculate_metric", "read_series", "compare_series", "get_data_quality", "get_record_evidence", "get_analysis_result", "get_result_bounds", "list_results", "remove_result"]);

function args(argv) {
  const out = { pulseRoot: process.env.PULSE_EVAL_PULSE_ROOT ?? DEFAULT_PULSE_ROOT, mcpRoot: process.env.PULSE_EVAL_MCP_ROOT ?? DEFAULT_MCP_ROOT, serve: false, smoke: false };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === "--serve") out.serve = true;
    else if (value === "--smoke") out.smoke = true;
    else if (value === "--pulse-root") out.pulseRoot = argv[++index] ?? "";
    else if (value === "--mcp-root") out.mcpRoot = argv[++index] ?? "";
    else throw new Error("INVALID_ARGUMENT");
  }
  return out;
}

function moduleRequire(mcpRoot) { return createRequire(join(resolve(mcpRoot), "package.json")); }
async function sdk(mcpRoot, name) { return import(pathToFileURL(moduleRequire(mcpRoot).resolve(name)).href); }
function errorCode(error) {
  const message = error instanceof Error ? error.message : "";
  if (/^(?:DATASET_ASSET_MISSING|INVALID_DATASET|DATASET_NOT_FOUND|DATASET_UNAVAILABLE|LAYER_DENIED|INVALID_INPUT|RESULT_NOT_FOUND_OR_EXPIRED|PLAN_NOT_FOUND_OR_EXPIRED|GRID_ARTIFACT_VERSION_MISMATCH)$/.test(message)) return message;
  if (/^[A-Z][A-Z0-9_]{0,63}$/.test(message)) return message;
  return "LOCAL_EVALUATION_ERROR";
}

async function offlineFetchFactory(pulseRoot) {
  const publicRoot = await realpath(join(resolve(pulseRoot), "public"));
  return async function offlineFetch(input) {
    const original = input instanceof URL ? input.href : typeof input === "string" ? input : input.url;
    const raw = typeof original === "string" ? original.replace(/^\.\//, "/") : original;
    if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) throw new Error("DATASET_ASSET_MISSING");
    const pathname = raw.split("?", 1)[0];
    const candidate = resolve(publicRoot, `.${pathname}`);
    const checked = relative(publicRoot, candidate);
    if (checked.startsWith("..") || isAbsolute(checked)) throw new Error("DATASET_ASSET_MISSING");
    try {
      const target = await realpath(candidate);
      if (relative(publicRoot, target).startsWith("..")) throw new Error("DATASET_ASSET_MISSING");
      const info = await stat(target);
      if (!info.isFile() || info.size > MAX_BYTES) throw new Error("DATASET_ASSET_MISSING");
      const body = await readFile(target);
      const type = target.endsWith(".json") || target.endsWith(".geojson") ? "application/json" : "application/octet-stream";
      return new Response(body, { status: 200, headers: { "content-type": type, "content-length": String(body.byteLength) } });
    } catch (error) {
      if (error instanceof Error && error.message === "DATASET_ASSET_MISSING") throw error;
      return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
    }
  };
}

async function production(pulseRoot) {
  const vite = await import(pathToFileURL(join(resolve(pulseRoot), "node_modules/vite/dist/node/index.js")).href);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = await offlineFetchFactory(pulseRoot);
  const server = await vite.createServer({ root: resolve(pulseRoot), configFile: false, cacheDir: process.env.PULSE_EVAL_VITE_CACHE ?? "/private/tmp/pulse-evaluation-vite-cache", appType: "custom", logLevel: "error", server: { middlewareMode: true, hmr: false } });
  try {
    const [exploration, datasets, analysis, nearby] = await Promise.all([
      server.ssrLoadModule("/src/research/dataExploration.ts"),
      server.ssrLoadModule("/src/research/researchDatasets.ts"),
      server.ssrLoadModule("/src/research/researchAnalysisSession.ts"),
      server.ssrLoadModule("/src/research/nearbyData.ts"),
    ]);
    return { ...exploration, ...datasets, ...analysis, ...nearby, close: async () => { globalThis.fetch = originalFetch; await server.close(); } };
  } catch (error) { globalThis.fetch = originalFetch; await server.close(); throw error; }
}

async function appendTrace(entry) {
  const destination = process.env.PULSE_EVAL_TRACE;
  if (!destination) return;
  await appendFile(destination, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
}

async function createRelay(pulseRoot, mcpRoot) {
  const runtime = await production(pulseRoot);
  const session = new runtime.ResearchAnalysisSession(() => new Set());
  const receipts = new Map();
  let serial = 0;
  const run = async (operation, input) => {
    if (operation === "explore_data") return runtime.exploreData(input, { locked: new Set(), visible: new Set() }, datasetId => session.queryRecords({ datasetId, limit: 2 }));
    if (operation === "search_datasets") return runtime.searchDatasets(input.query, input.offset, input.limit);
    if (operation === "describe_dataset") { await runtime.ensureDataset(input.datasetId, new Set()); return runtime.describeDataset(input.datasetId); }
    if (operation === "query_records") return session.queryRecords(input);
    if (operation === "plan_data_access") return session.planDataAccess(input.query);
    if (operation === "materialize_data") return session.materializeData(input.planId);
    if (ANALYSIS_OPERATIONS.has(operation)) return session.execute(operation, input);
    const discovery = { search_layers: "discoverLayers", describe_layer: "describeLayer", find_places: "findPlaces", read_layer: "readLayer", nearby: "queryNearby" };
    if (!(operation in discovery)) throw new Error("INVALID_INPUT");
    const query = { ...input };
    if (operation === "nearby") query.center = { lng: input.center[0], lat: input.center[1] };
    return runtime.executeDiscovery(discovery[operation], query, { locked: new Set(), visible: new Set() });
  };
  const { RelayClientError } = await import(pathToFileURL(moduleRequire(mcpRoot).resolve("./dist/research/relayClient.js")).href);
  return {
    async getSession() { return { state: "active", sessionId: "test-session", studyId: "test-study", tabId: "test-tab", capabilities: ["offline_evaluation"], expiresAt: Date.now() + 60_000, mode: "TEST_ONLY" }; },
    async getStudyState() { return { studyId: "test-study", tabId: "test-tab", revision: 0, scene: { camera: { center: [121.525, 25.025], zoom: 12 }, resultMode: "empty" }, view: { revision: 0, phase: "empty" }, connected: false, paused: false, pendingCommand: null, mode: "TEST_ONLY" }; },
    async query(operation, input) {
      const requestId = `eval-${++serial}`;
      let receipt;
      try { receipt = { requestId, status: "complete", result: { ok: true, data: await run(operation, input) } }; }
      catch (error) { receipt = { requestId, status: "error", result: { ok: false, error: errorCode(error) } }; }
      receipts.set(requestId, receipt);
      await appendTrace({ tool: operation, status: receipt.status });
      return receipt;
    },
    async getQueryResult(requestId) { return receipts.get(requestId) ?? { requestId, status: "expired" }; },
    async applyScene() { throw new RelayClientError("TEST_NO_BROWSER_PRESENTATION", "Offline evaluation has no browser presentation."); },
    async waitSceneReady() { throw new RelayClientError("TEST_NO_BROWSER_PRESENTATION", "Offline evaluation has no browser presentation."); },
    async pairSession() { throw new RelayClientError("TEST_ONLY", "Offline evaluation does not pair sessions."); },
    async disconnectSession() { return { state: "unpaired" }; },
    close: runtime.close,
  };
}

async function serve(options) {
  const [{ createResearchServer }, { serveStdio }] = await Promise.all([
    import(pathToFileURL(join(resolve(options.mcpRoot), "dist/research/server.js")).href),
    sdk(options.mcpRoot, "@modelcontextprotocol/server/stdio"),
  ]);
  const relay = await createRelay(options.pulseRoot, options.mcpRoot);
  const stdio = serveStdio(() => createResearchServer({ relayClient: relay }), { onerror() { console.error("Offline evaluation MCP error; request contents omitted."); } });
  const stop = async () => { await relay.close(); await stdio.close(); };
  process.once("SIGINT", () => void stop()); process.once("SIGTERM", () => void stop());
}

async function smoke(options) {
  const [{ Client }, { StdioClientTransport }] = await Promise.all([sdk(options.mcpRoot, "@modelcontextprotocol/client"), sdk(options.mcpRoot, "@modelcontextprotocol/client/stdio")]);
  const client = new Client({ name: "pulse-evaluation-smoke", version: "0.1.0" });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [process.argv[1], "--serve", "--pulse-root", options.pulseRoot, "--mcp-root", options.mcpRoot], env: process.env }));
    const explore = await client.callTool({ name: "pulse_explore_data", arguments: { query: "教育資源", probe: true } });
    const queried = await client.callTool({ name: "pulse_query_records", arguments: { datasetId: "tw-schools", limit: 1 } });
    if (explore.isError || queried.isError) throw new Error("SMOKE_TOOL_ERROR");
    const exploreReceipt = explore.structuredContent;
    const queryReceipt = queried.structuredContent;
    process.stdout.write(`${JSON.stringify({ mode: "offline_data_reasoning_only", exploreStatus: exploreReceipt?.status, exploreResult: exploreReceipt?.result?.ok, queryStatus: queryReceipt?.status, queryResult: queryReceipt?.result?.ok })}\n`);
  } finally { await client.close(); }
}

const options = args(process.argv.slice(2));
await access(join(resolve(options.pulseRoot), "package.json")); await access(join(resolve(options.mcpRoot), "dist/research/server.js"));
if (options.smoke) await smoke(options); else if (options.serve) await serve(options); else throw new Error("Use --serve or --smoke");
