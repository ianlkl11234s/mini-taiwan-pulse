#!/usr/bin/env node
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const localResearchEnv = loadEnv("development", root, "PULSE_RESEARCH_");
const runtimeEnv = { ...localResearchEnv, ...process.env };
const runtime = resolve(root, "../runtime/research-local-stack");
const statePath = resolve(runtime, "state.json");
const command = process.argv[2] ?? "status";

const sleep = ms => new Promise(done => setTimeout(done, ms));
const readState = () => {
  try {
    const value = JSON.parse(readFileSync(statePath, "utf8"));
    return Number.isSafeInteger(value.pid) && value.pid > 1 ? value : null;
  } catch { return null; }
};
const alive = pid => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};
const probe = async url => {
  try { return (await fetch(url, { signal: AbortSignal.timeout(1000) })).status; } catch { return 0; }
};

if (command === "serve") {
  mkdirSync(runtime, { recursive: true, mode: 0o700 });
  writeFileSync(statePath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { mode: 0o600 });
  const children = [
    spawn(process.execPath, [resolve(root, "scripts/research/start-gateway.mjs")], { cwd: root, env: runtimeEnv, stdio: "inherit" }),
    spawn("npm", ["run", "dev:exploration"], { cwd: root, env: runtimeEnv, stdio: "inherit" }),
  ];
  let stopping = false;
  const stop = signal => {
    if (stopping) return;
    stopping = true;
    for (const child of children) if (!child.killed) child.kill(signal);
    rmSync(statePath, { force: true });
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
  for (const child of children) child.on("exit", code => {
    if (!stopping) {
      console.error(`local stack child exited (${code ?? "signal"})`);
      stop("SIGTERM");
    }
  });
  await new Promise(() => {});
}

if (command === "start") {
  const email = runtimeEnv.PULSE_RESEARCH_PILOT_EMAILS;
  if (!email || !/^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(email)) throw new Error("Set PULSE_RESEARCH_PILOT_EMAILS to the authorized test account.");
  const current = readState();
  if (current && alive(current.pid)) {
    console.log(JSON.stringify({ status: "already_running", pid: current.pid, frontend: await probe("http://127.0.0.1:3732/"), gateway: await probe("http://127.0.0.1:8791/") }));
    process.exit(0);
  }
  mkdirSync(runtime, { recursive: true, mode: 0o700 });
  rmSync(statePath, { force: true });
  const output = openSync(resolve(runtime, "stack.log"), "a", 0o600);
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve"], { cwd: root, env: runtimeEnv, detached: true, stdio: ["ignore", output, output] });
  child.unref(); closeSync(output);
  for (let attempt = 0; attempt < 40; attempt++) {
    const [frontend, gateway] = await Promise.all([probe("http://127.0.0.1:3732/"), probe("http://127.0.0.1:8791/")]);
    if (frontend === 200 && gateway === 404) {
      console.log(JSON.stringify({ status: "running", pid: child.pid, frontend, gateway }));
      process.exit(0);
    }
    if (!alive(child.pid)) break;
    await sleep(250);
  }
  if (alive(child.pid)) process.kill(-child.pid, "SIGTERM");
  throw new Error(`LOCAL_STACK_START_FAILED: ${resolve(runtime, "stack.log")}`);
}

if (command === "stop") {
  const current = readState();
  if (current && alive(current.pid)) process.kill(-current.pid, "SIGTERM");
  rmSync(statePath, { force: true });
  console.log(JSON.stringify({ status: "stopped" }));
  process.exit(0);
}

if (command === "status") {
  const current = readState();
  console.log(JSON.stringify({ status: current && alive(current.pid) ? "running" : "stopped", pid: current && alive(current.pid) ? current.pid : null, frontend: await probe("http://127.0.0.1:3732/"), gateway: await probe("http://127.0.0.1:8791/") }));
  process.exit(0);
}

throw new Error("Usage: node scripts/research/local-stack.mjs start|stop|status");
