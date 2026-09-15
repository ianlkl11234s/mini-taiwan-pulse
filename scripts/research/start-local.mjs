#!/usr/bin/env node
// Run from the Pulse repo. Restore only known pilot assets, then verify real HTTP bytes.
import { readFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const port = Number(option('--port') ?? 3731);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('INVALID_PORT');
const root = process.cwd();
const assets = ['/education/schools.geojson', '/culture/public_libraries_national.geojson'];
const receipts = [];
for (const url of assets) {
  const target = resolve(root, `public${url}`);
  try { await stat(target); } catch {
    const source = option('--asset-source');
    if (!source) throw new Error(`ASSET_MISSING: ${url}; pass --asset-source <existing-public-directory>`);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(source, `.${url}`), target, 1); // exclusive; never overwrite
  }
  const info = await stat(target);
  if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error(`INVALID_ASSET: ${url}`);
  const bytes = await readFile(target); const json = JSON.parse(bytes.toString('utf8'));
  if (json.type !== 'FeatureCollection' || !Array.isArray(json.features)) throw new Error(`INVALID_GEOJSON: ${url}`);
  receipts.push({ url, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, records: json.features.length });
}
const child = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, ...(option('--gateway-origin') ? { PULSE_RESEARCH_GATEWAY_ORIGIN: option('--gateway-origin') } : {}), ...(option('--analytics-root') ? { PULSE_RESEARCH_ANALYTICS_ROOT: option('--analytics-root') } : {}) },
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', code => process.exit(code ?? 1));
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) }); if (response.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('SERVER_START_TIMEOUT');
  for (const receipt of receipts) {
    const response = await fetch(`http://127.0.0.1:${port}${receipt.url}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error(`ASSET_HTTP_FAILED: ${receipt.url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== receipt.sha256) throw new Error(`ASSET_HTTP_HASH_MISMATCH: ${receipt.url}`);
  }
  console.log(JSON.stringify({ status: 'pilot_assets_verified', origin: `http://127.0.0.1:${port}`, receipts }));
} catch (error) { console.error(error.message); child.kill('SIGTERM'); process.exitCode = 1; }
