#!/usr/bin/env node
/** Exploration-only smoke check of the built stdio entry. No login, pairing or map mutations. */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const pulseRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
let mcpRoot = resolve(pulseRoot, '../mini-pulse-gis-mcp');
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--smoke') continue;
  if (args[index] === '--mcp-root' && args[index + 1]) { mcpRoot = resolve(args[++index]); continue; }
  throw new Error('Usage: node scripts/research/evaluation-mcp.mjs --smoke [--mcp-root <path>]');
}
const require = createRequire(join(mcpRoot, 'package.json'));
const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/client')).href);
const { StdioClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/client/stdio')).href);
const expected = [
  'pulse_describe_layer_statistics', 'pulse_summarize_layer',
  'pulse_get_time_context', 'pulse_set_time',
  'pulse_get_layer_controls', 'pulse_set_layer_control', 'pulse_geocode_address',
  'pulse_pair_session', 'pulse_get_session', 'pulse_disconnect_session', 'pulse_get_study_state',
  'pulse_search_layers', 'pulse_get_layer_details', 'pulse_describe_layer', 'pulse_get_map_context', 'pulse_find_places',
  'pulse_set_layers', 'pulse_set_camera', 'pulse_fit_bounds', 'pulse_wait_scene_ready', 'pulse_get_query_result',
].sort();
const client = new Client({ name: 'pulse-exploration-smoke', version: '1.0.0' });
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(mcpRoot, 'dist/research/index.js')], env: { PATH: process.env.PATH ?? '' } }));
  const names = (await client.listTools()).tools.map(tool => tool.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error('EXPLORATION_TOOL_BOUNDARY_MISMATCH');
  for (const name of ['pulse_apply_scene', 'pulse_query_records', 'pulse_present_result', 'pulse_query_nearby']) {
    let rejected = false;
    try { const result = await client.callTool({ name, arguments: {} }); rejected = result.isError === true; }
    catch { rejected = true; }
    if (!rejected) throw new Error('ANALYSIS_TOOL_REACHABLE');
  }
  console.log(JSON.stringify({ mode: 'map-exploration', toolCount: names.length, tools: names, analysisToolsBlocked: true, pairedBrowserChecked: false }, null, 2));
} finally { await client.close(); }
