#!/usr/bin/env node
/** Exploration and typed-analysis schema smoke of the built stdio entry. No login or map mutation. */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const pulseRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
let mcpRoot = resolve(pulseRoot, '../mini-pulse-gis-mcp-layer-discovery');
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--smoke') continue;
  if (args[index] === '--mcp-root' && args[index + 1]) { mcpRoot = resolve(args[++index]); continue; }
  throw new Error('Usage: node scripts/research/evaluation-mcp.mjs --smoke [--mcp-root <path>]');
}
const require = createRequire(join(mcpRoot, 'package.json'));
const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/client')).href);
const { StdioClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/client/stdio')).href);
const expected = [
  'pulse_route_request',
  'pulse_describe_layer_statistics', 'pulse_summarize_layer',
  'pulse_list_layer_capabilities', 'pulse_search_layer_records',
  'pulse_get_time_context', 'pulse_set_time',
  'pulse_get_layer_controls', 'pulse_set_layer_control', 'pulse_geocode_address',
  'pulse_pair_session', 'pulse_get_session', 'pulse_disconnect_session', 'pulse_get_study_state',
  'pulse_search_layers', 'pulse_search_datasets', 'pulse_describe_dataset', 'pulse_query_records',
  'pulse_plan_data_access', 'pulse_materialize_data', 'pulse_spatial_query', 'pulse_aggregate_records', 'pulse_join_records', 'pulse_calculate_metric',
  'pulse_read_series', 'pulse_compare_series', 'pulse_get_data_quality', 'pulse_get_record_evidence', 'pulse_get_analysis_result', 'pulse_get_result_bounds', 'pulse_list_results', 'pulse_remove_result',
  'pulse_get_layer_details', 'pulse_describe_layer', 'pulse_get_map_context', 'pulse_find_places',
  'pulse_set_layers', 'pulse_set_camera', 'pulse_present_result', 'pulse_fit_bounds', 'pulse_wait_scene_ready', 'pulse_get_query_result',
].sort();
const client = new Client({ name: 'pulse-exploration-smoke', version: '1.0.0' });
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(mcpRoot, 'dist/research/index.js')], env: {
    PATH: process.env.PATH ?? '',
    PULSE_OPENROUTER_ENV_FILE: join(pulseRoot, '.env'),
  } }));
  const names = (await client.listTools()).tools.map(tool => tool.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    const missing = expected.filter(name => !names.includes(name));
    const extra = names.filter(name => !expected.includes(name));
    throw new Error(`EXPLORATION_TOOL_BOUNDARY_MISMATCH missing=${missing.join(',')} extra=${extra.join(',')}`);
  }
  const route = await client.callTool({ name: 'pulse_route_request', arguments: { query: '比較台中各區醫院數量並顯示在地圖上' } });
  if (!route.isError && (route.structuredContent?.executed !== false || !['mcp', 'review'].includes(route.structuredContent?.surface))) throw new Error('JEV_SHADOW_ROUTING_MISMATCH');
  const geocode = await client.callTool({ name: 'pulse_geocode_address', arguments: { query: '臺北市信義區市府路45號' } });
  const geocodeData = geocode.structuredContent?.result?.data;
  if (geocode.isError || geocode.structuredContent?.status !== 'complete' || geocodeData?.status !== 'matched' || geocodeData?.candidates?.[0]?.precision !== 'exact_cache') throw new Error('LOCAL_GEOCODER_MISMATCH');
  for (const name of ['pulse_apply_scene', 'pulse_query_nearby']) {
    let rejected = false;
    try { const result = await client.callTool({ name, arguments: {} }); rejected = result.isError === true; }
    catch { rejected = true; }
    if (!rejected) throw new Error('UNREGISTERED_TOOL_REACHABLE');
  }
  for (const [name, arguments_] of [
    ['pulse_aggregate_records', { resultId: 'result-1', operation: 'sum' }],
    ['pulse_spatial_query', { resultId: 'result-1', predicate: 'nearest', center: [121.5, 25], radiusM: 10 }],
    ['pulse_calculate_metric', { resultId: 'result-1', operation: 'eval', numeratorField: 'value', denominatorField: 'baseline' }],
  ]) {
    const result = await client.callTool({ name, arguments: arguments_ });
    if (result.isError !== true) throw new Error(`ANALYSIS_NEGATIVE_SCHEMA_MISMATCH ${name}`);
  }
  console.log(JSON.stringify({ mode: 'typed-analysis', toolCount: names.length, tools: names, jevRouting: route.isError ? 'provider_unavailable' : route.structuredContent, localGeocoder: { status: geocodeData.status, precision: geocodeData.candidates[0].precision, source: geocodeData.candidates[0].source }, negativeSchemasChecked: true, pairedBrowserChecked: false }, null, 2));
} finally { await client.close(); }
