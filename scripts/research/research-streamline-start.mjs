#!/usr/bin/env node
/**
 * Isolated general-analysis profile only: 3734 Vite -> 8794 research gateway.
 * It never stops, replaces, or re-pairs an existing local profile.
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workspaceRoot = resolve(root, "../../..");
const analyticsRoot = resolve(workspaceRoot, "../taipei-gis-analytics");
const runtime = resolve(root, "../runtime");
const viteConfig = resolve(runtime, "vite.config.mts");
const viteConfigTemplate = resolve(root, "scripts/research/research-streamline-vite.config.mts");
const gatewayStart = resolve(runtime, "start-v03-gateway.mjs");
const boundary = resolve(analyticsRoot, "data/processed/demographics/county_boundary/county_boundary_20260626.geojson");
const statePath = resolve(runtime, "research-streamline-profile.json");
const requiredEnvKeys = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
const command = process.argv[2] ?? "status";

function envKeyExists(key) {
  const result = spawnSync("grep", ["-q", `^${key}=`, resolve(workspaceRoot, ".env")], { stdio: "ignore" });
  return result.status === 0;
}

function configMatchesProfile() {
  return existsSync(viteConfig) && readFileSync(viteConfig, "utf8") === renderedViteConfig();
}

function renderedViteConfig() {
  return readFileSync(viteConfigTemplate, "utf8")
    .replaceAll("__MINI_ROOT__", root)
    .replaceAll("__WORKSPACE_ROOT__", workspaceRoot)
    .replaceAll("__ANALYTICS_ROOT__", analyticsRoot)
    .replaceAll("__RUNTIME_ROOT__", runtime);
}

function preflight() {
  const missing = [
    ...(!existsSync(gatewayStart) ? ["runtime/start-v03-gateway.mjs"] : []),
    ...(!existsSync(resolve(root, "node_modules/vite/bin/vite.js")) ? ["isolated node_modules/vite"] : []),
    ...(!existsSync(boundary) ? ["analytics county boundary"] : []),
    ...(!configMatchesProfile() ? ["runtime vite profile configuration"] : []),
  ];
  const missingEnvKeys = requiredEnvKeys.filter(key => !envKeyExists(key));
  return { profile: "research-streamline", frontend: "http://127.0.0.1:3734", gateway: "http://127.0.0.1:8794", analyticsBoundaryPresent: existsSync(boundary), configMatchesProfile: configMatchesProfile(), presentEnvKeys: requiredEnvKeys.filter(key => !missingEnvKeys.includes(key)), missingEnvKeys, missing };
}

function portStatus(port) {
  return new Promise(resolvePort => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolvePort("in_use"); });
    socket.once("error", error => {
      socket.destroy();
      resolvePort(error.code === "ECONNREFUSED" ? "unused" : "unknown");
    });
    socket.setTimeout(700, () => { socket.destroy(); resolvePort("unknown"); });
  });
}

function readState() {
  try { return JSON.parse(readFileSync(statePath, "utf8")); } catch { return null; }
}

function profileEnv() {
  return {
    ...process.env,
    PULSE_RESEARCH_GATEWAY_ORIGIN: "http://127.0.0.1:8794",
    PULSE_RESEARCH_ANALYTICS_ROOT: analyticsRoot,
    VITE_RESEARCH_POPULATION_PREVIEW: "1",
    VITE_RESEARCH_RAW_BOUNDARIES: "1",
    VITE_RESEARCH_POINT_PARTITIONS: "1",
  };
}

if (command === "config") {
  if (existsSync(viteConfig)) {
    if (!configMatchesProfile()) throw new Error("RUNTIME_VITE_CONFIG_DIFFERENT: refuse to overwrite existing runtime config");
    console.log(JSON.stringify({ status: "already_configured", config: viteConfig }, null, 2));
  } else {
    mkdirSync(runtime, { recursive: true, mode: 0o700 });
    writeFileSync(viteConfig, renderedViteConfig(), { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ status: "configured", config: viteConfig }, null, 2));
  }
  process.exit(0);
}

if (command === "check" || command === "status") {
  const result = preflight();
  const [frontendPort, gatewayPort] = await Promise.all([portStatus(3734), portStatus(8794)]);
  const blocked = result.missing.length || result.missingEnvKeys.length || frontendPort !== "unused" || gatewayPort !== "unused";
  console.log(JSON.stringify({ status: command === "check" ? (blocked ? "blocked" : "ready_to_start") : "observed", ...result, frontendPort, gatewayPort, state: readState() }, null, 2));
  process.exit(command === "check" && blocked ? 1 : 0);
}

if (command !== "start") throw new Error("Usage: node scripts/research/research-streamline-start.mjs config|check|status|start");
const result = preflight();
if (result.missing.length || result.missingEnvKeys.length) throw new Error(`PROFILE_PREFLIGHT_FAILED: ${JSON.stringify({ missing: result.missing, missingEnvKeys: result.missingEnvKeys })}`);
const [frontendPort, gatewayPort] = await Promise.all([portStatus(3734), portStatus(8794)]);
if (frontendPort !== "unused" || gatewayPort !== "unused") throw new Error(`PROFILE_PORT_NOT_UNUSED: ${JSON.stringify({ frontendPort, gatewayPort })}`);

mkdirSync(runtime, { recursive: true, mode: 0o700 });
const gatewayLog = openSync(resolve(runtime, "research-streamline-gateway.log"), "a", 0o600);
const viteLog = openSync(resolve(runtime, "research-streamline-vite.log"), "a", 0o600);
const env = profileEnv();
const gateway = spawn(process.execPath, [gatewayStart], { cwd: root, env, detached: true, stdio: ["ignore", gatewayLog, gatewayLog] });
const vite = spawn(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "3734", "--strictPort", "--config", viteConfig], { cwd: root, env, detached: true, stdio: ["ignore", viteLog, viteLog] });
gateway.unref(); vite.unref(); closeSync(gatewayLog); closeSync(viteLog);
let ready = false;
for (let attempt = 0; attempt < 16; attempt += 1) {
  await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
  const [frontend, gateway] = await Promise.all([portStatus(3734), portStatus(8794)]);
  if (frontend === "in_use" && gateway === "in_use") { ready = true; break; }
}
if (!ready) {
  for (const pid of [gateway.pid, vite.pid]) if (typeof pid === "number") { try { process.kill(pid, "SIGTERM"); } catch {} }
  throw new Error("PROFILE_START_UNVERIFIED: terminated only processes spawned by this command");
}
writeFileSync(statePath, JSON.stringify({ profile: "research-streamline", root, gatewayPid: gateway.pid, vitePid: vite.pid, startedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ status: "ports_listening", profile: "research-streamline", gatewayPid: gateway.pid, vitePid: vite.pid, note: "TCP listeners only; HTTP, pairing and browser acceptance remain separate. Existing processes were never stopped or replaced." }, null, 2));
