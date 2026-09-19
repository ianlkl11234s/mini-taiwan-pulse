#!/usr/bin/env node
/** Real stdio + HTTP protocol acceptance with a simulated owner/tab, not Google/browser E2E.
 * Run: npx vite-node scripts/research/evaluation-statistics.mjs http://127.0.0.1:3732
 * No production auth settings, persistent database, or existing MCP processes are changed.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { BridgeClient } from '../../src/research/bridgeClient.ts';
import { QueryResponder } from '../../src/research/QueryResponder.ts';
import { summarizeLayer, describeLayerStatistics, searchLayerRecords } from '../../src/research/layerStatistics.ts';
import { listLayerCapabilities } from '../../src/research/layerCapabilities.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mcpRoot = resolve(root, '../mini-pulse-gis-mcp');
const gatewayRoot = resolve(root, '../gis-platform/services/research-gateway');
const site = new URL(process.argv[2] ?? 'http://127.0.0.1:3732');
if (site.protocol !== 'http:' || site.hostname !== '127.0.0.1' || site.username || site.password || site.pathname !== '/' || site.search || site.hash) throw new Error('LOCAL_TEST_SITE_ONLY');
const { createGateway, createHttpServer } = await import(pathToFileURL(join(gatewayRoot, 'server.mjs')).href);
const { MemoryPairingStore } = await import(pathToFileURL(join(gatewayRoot, 'pairing-service.mjs')).href);
const require = createRequire(join(mcpRoot, 'package.json'));
const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/client')).href);
const { StdioClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/client/stdio')).href);
const browserToken = randomUUID();
const gateway = createHttpServer(createGateway({ store: new MemoryPairingStore(), verifyBrowser: async header => {
  if (header !== `Bearer ${browserToken}`) throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
  return { verified: true, accountId: 'statistics-test-owner' };
}, origins: [] }), { trustedProxyIps: new Set() });
await new Promise((resolve, reject) => { gateway.once('error', reject); gateway.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${gateway.address().port}`;
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, init) => nativeFetch(typeof url === 'string' && url.startsWith('./') ? new URL(url, site) : url, init);
const browser = new BridgeClient(async () => browserToken, (url, init) => nativeFetch(new URL(String(url), origin), init));
const client = new Client({ name: 'statistics-protocol-acceptance', version: '1.0.0' });
let responder;
const evidence = [];
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(mcpRoot, 'dist/research/index.js')], env: { PATH: process.env.PATH ?? '', PULSE_RESEARCH_ORIGIN: origin, PULSE_RESEARCH_ALLOW_LOOPBACK: '1' } }));
  const tools = (await client.listTools()).tools.map(t => t.name);
  assert(tools.includes('pulse_summarize_layer'));
  assert(tools.includes('pulse_list_layer_capabilities'));
  assert(tools.includes('pulse_search_layer_records'));
  const study = await browser.createStudy('statistics-test-tab');
  const pairing = await browser.createPairing(study.studyId, study.tabId);
  const claim = await client.callTool({ name: 'pulse_pair_session', arguments: { pairingId: pairing.pairingId, code: pairing.code, deviceLabel: 'Statistics-Test' } });
  assert(!claim.isError); const phrase = claim.structuredContent.phrase;
  await browser.approve(pairing.pairingId, study.tabId, phrase);
  const session = await client.callTool({ name: 'pulse_get_session', arguments: {} });
  assert.equal(session.structuredContent.state, 'active');
  responder = new QueryResponder({ client: browser, ...study, pairingId: pairing.pairingId }, async query => {
    if (query.operation === 'describe_layer_statistics') return describeLayerStatistics(query.args);
    if (query.operation === 'summarize_layer') return summarizeLayer(query.args);
    if (query.operation === 'list_layer_capabilities') return listLayerCapabilities(query.args);
    if (query.operation === 'search_layer_records') return searchLayerRecords(query.args);
    throw new Error('OPERATION_UNSUPPORTED');
  }, () => { throw new Error('RESPONDER_FAILED'); });
  await browser.sync(study.studyId, study.tabId); responder.start();
  async function call(name, args) {
    const response = await client.callTool({ name, arguments: args });
    assert(!response.isError, 'MCP tool error');
    const receipt = response.structuredContent;
    assert.equal(receipt.status, 'complete'); assert.equal(receipt.result?.ok, true);
    return receipt.result.data;
  }
  const description = await call('pulse_describe_layer_statistics', {layerKey:'schools'});
  assert.equal(description.capabilities.area, false);
  const capabilities = await call('pulse_list_layer_capabilities', {});
  assert.equal(capabilities.totalMatched, 760);
  assert.equal(capabilities.returned, 20);
  assert.equal(capabilities.truncated, true);
  const schoolCapabilities = await call('pulse_list_layer_capabilities', {measure:'count',status:'ready'});
  assert(schoolCapabilities.layers.some(layer=>layer.layerKey==='schools' && layer.recordSearch==='ready'));
  assert.equal(schoolCapabilities.totalMatched,2);
  evidence.push({case:'capability_catalog_is_bounded',totalMatched:capabilities.totalMatched,returned:capabilities.returned,countReady:schoolCapabilities.totalMatched});
  const schoolRecords = await call('pulse_search_layer_records', {layerKey:'schools',query:'雙蓮',limit:2});
  assert(schoolRecords.totalMatched > 0);
  assert(schoolRecords.returned <= 2);
  assert(schoolRecords.records.every(record=>record.fields && !('geometry' in record.fields)));
  evidence.push({case:'school_record_search_is_bounded',totalMatched:schoolRecords.totalMatched,returned:schoolRecords.returned,fields:schoolRecords.returnedFields});
  const unsupportedRecords = await client.callTool({name:'pulse_search_layer_records',arguments:{layerKey:'publicLibraries',query:'圖書館'}});
  assert.equal(unsupportedRecords.structuredContent.status,'error');
  assert.equal(unsupportedRecords.structuredContent.result.ok,false);
  evidence.push({case:'unsupported_record_search_is_error_not_zero',error:unsupportedRecords.structuredContent.result.error});
  const total = await call('pulse_summarize_layer', {layerKey:'schools', groupBy:['city'], limit:50});
  assert.equal(total.totalMatched, 4315); assert.equal(total.groups.reduce((n,g)=>n+g.count,0),4315);
  evidence.push({case:'school_count_and_city_reconciliation', total:total.totalMatched, duplicateExtraRecords:total.identity.duplicateExtraRecords, sourceRefs:total.sourceRefs});
  for (const city of ['台北市','新北市']) {
    const result = await call('pulse_summarize_layer',{layerKey:'policeStation',filters:[{field:'city',value:city}],groupBy:['facility_subtype']});
    assert.equal(result.totalMatched, city==='台北市'?161:212);
    assert.equal(result.groups.reduce((n,g)=>n+g.count,0),result.totalMatched);
    evidence.push({case:'police_city_subtypes',city,schoolSourceRecords:total.groups.find(g=>g.values.city===city)?.count ?? null,total:result.totalMatched,groups:result.groups.map(g=>({category:g.values.facility_subtype,count:g.count})),unmatchedCity:result.administrativeAttribution.unmatchedCity,sourceRefs:result.sourceRefs});
  }
  const departments = await call('pulse_summarize_layer',{layerKey:'policeStation',filters:[{field:'city',value:'台北市'},{field:'facility_subtype',value:'police_dept'}]});
  evidence.push({case:'taipei_police_departments_only',total:departments.totalMatched});
  const page = await call('pulse_summarize_layer',{layerKey:'schools',groupBy:['district'],limit:2});
  const next = await call('pulse_summarize_layer',{layerKey:'schools',groupBy:['district'],offset:page.nextOffset,limit:2});
  assert.deepEqual(page.groupBy,['city','district']); assert(page.truncated); assert.equal(next.offset,2);
  evidence.push({case:'district_pagination',groupTotal:page.groupTotal,firstPositions:page.groups.map(g=>g.position),nextPositions:next.groups.map(g=>g.position)});
  const bad = await client.callTool({name:'pulse_summarize_layer',arguments:{layerKey:'schools',groupBy:['missingField']}});
  assert.equal(bad.structuredContent.status,'error'); assert.equal(bad.structuredContent.result.ok,false);
  evidence.push({case:'unsupported_field_is_error_not_zero',error:bad.structuredContent.result.error});
  await client.callTool({name:'pulse_disconnect_session',arguments:{}});
  assert.equal((await browser.browserStatus(study.studyId,study.tabId)).session.active,false);
  console.log(JSON.stringify({mode:'real-stdio-http-simulated-owner-tab',toolCount:tools.length,passed:true,realBrowserPaired:false,productionChecked:false,evidence},null,2));
} finally {
  responder?.stop(); await client.close(); await new Promise(resolve=>gateway.close(resolve)); globalThis.fetch=nativeFetch;
}
