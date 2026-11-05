#!/usr/bin/env node
/**
 * 輪替資料 S3 deploy-assets → R2 mini-tw-pulse/site/ 同步（取代容器內 refresh-climate.sh／refresh-gfw-hourly.sh）。
 *
 *   node deploy/cloudflare/sync-rotating.mjs                 # dry-run：只讀兩邊、印計畫
 *   node deploy/cloudflare/sync-rotating.mjs --execute       # 真的寫 R2
 *   node deploy/cloudflare/sync-rotating.mjs --execute --prune   # 另刪退役滿 8 天的 GFW release
 *   選項：--only gfw|climate、--env <path>（只載入下列 7 個 key，已存在的環境變數優先）、--concurrency N（≤4）
 *
 * 比對基準一律是 R2 現況（list 取 size＋ETag，必要時 HEAD 讀 metadata），不依賴本機狀態。
 * GFW：驗證沿用 scripts/deploy/refresh-gfw-hourly.mjs 的 validateManifest；資產全部驗過 bytes＋sha256 並寫入後才換 root。
 * climate：一般檔先傳，指標檔（*_latest.png → *_latest.json → frames/manifest.json）最後傳；不刪舊。
 * 寫入守門：key 只准 site/climate/ 或 site/global-maritime/gfw-hourly/ 開頭。R2 只用 R2_MIGRATION_* 金鑰。
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { validateManifest } from '../../scripts/deploy/refresh-gfw-hourly.mjs';

export const R2_BUCKET = 'mini-tw-pulse';
export const ALLOWED_PREFIXES = ['site/climate/', 'site/global-maritime/gfw-hourly/'];
export const GFW_NAMESPACES = ['', 'v3-shadow', 'v4'];
export const RETIRE_GRACE_MS = 8 * 86400000; // 7 天 immutable ＋ root／邊緣快取寬限，同 mjs CACHE_GRACE_MS
const ENV_KEYS = ['S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_REGION', 'S3_BUCKET', 'R2_ENDPOINT_URL', 'R2_MIGRATION_ACCESS_KEY_ID', 'R2_MIGRATION_SECRET_ACCESS_KEY'];
const MAX_MANIFEST = 16 * 1024 * 1024;

export const CACHE = {
  gfwRoot: 'public,max-age=60,s-maxage=60,stale-while-revalidate=300',
  gfwRelease: 'public,max-age=604800,s-maxage=604800,immutable',
  climate: 'public, max-age=300, must-revalidate',
};
// 與 deploy/cloudflare/src/worker.js 的 MIME 表一致；.gz（含 .json.gz）一律 octet-stream、不設 Content-Encoding。
const MIME = { pmtiles: 'application/vnd.pmtiles', geojson: 'application/geo+json', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', csv: 'text/csv', txt: 'text/plain', bin: 'application/octet-stream', gz: 'application/octet-stream', arrow: 'application/octet-stream' };
export function contentType(key) {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  return MIME[ext] ?? 'application/octet-stream';
}

function fail(message) { throw new Error(message); }

/** 唯一寫入／刪除守門：其他前綴、路徑跳脫、空段一律拒絕。 */
export function assertWritableKey(key) {
  if (typeof key !== 'string' || !ALLOWED_PREFIXES.some(p => key.startsWith(p))) fail(`refusing R2 key outside allowed prefixes: ${JSON.stringify(key)}`);
  const parts = key.split('/');
  if (parts.some(p => p === '' || p === '.' || p === '..' || !/^[A-Za-z0-9._-]+$/.test(p))) fail(`refusing unsafe R2 key: ${JSON.stringify(key)}`);
  return key;
}

export function loadEnv(path) {
  if (!path || !existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m || !ENV_KEYS.includes(m[1]) || process.env[m[1]]) continue;
    let v = m[2].trim();
    if (v.length >= 2 && v[0] === v.at(-1) && `"'`.includes(v[0])) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

const unq = etag => (etag ?? '').replaceAll('"', '');
const sha256 = buf => createHash('sha256').update(buf).digest('hex');

async function pool(items, limit, fn) {
  const errors = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      try { await fn(item); } catch (error) { errors.push(error); }
    }
  }));
  return errors;
}

// ───────────── storage adapters（測試以假物件替換） ─────────────
function isMissing(error) {
  return error?.name === 'NoSuchKey' || error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404;
}
async function bodyBuffer(body) {
  const chunks = []; let size = 0;
  for await (const c of body) { size += c.length; if (size > MAX_MANIFEST) fail('object exceeds manifest size limit'); chunks.push(c); }
  return Buffer.concat(chunks);
}

export async function awsStores() {
  const { S3Client, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
  const need = (keys) => { const miss = keys.filter(k => !process.env[k]); if (miss.length) fail(`missing env: ${miss.join(', ')} (R2 只用 R2_MIGRATION_*)`); };
  need(['S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET', 'R2_ENDPOINT_URL', 'R2_MIGRATION_ACCESS_KEY_ID', 'R2_MIGRATION_SECRET_ACCESS_KEY']);
  const s3 = new S3Client({ region: process.env.S3_REGION || 'ap-southeast-2', credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY } });
  const r2 = new S3Client({
    region: 'auto', endpoint: process.env.R2_ENDPOINT_URL,
    credentials: { accessKeyId: process.env.R2_MIGRATION_ACCESS_KEY_ID, secretAccessKey: process.env.R2_MIGRATION_SECRET_ACCESS_KEY },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const S3B = process.env.S3_BUCKET;
  const lister = (client, bucket) => async (prefix) => {
    const out = new Map(); let token;
    do {
      const r = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
      for (const o of r.Contents ?? []) out.set(o.Key, { size: o.Size, etag: unq(o.ETag), lastModified: o.LastModified?.getTime() });
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
    return out;
  };
  const getter = (client, bucket) => async (key) => {
    try { const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key })); return await bodyBuffer(r.Body); }
    catch (e) { if (isMissing(e)) return null; throw e; }
  };
  return {
    src: {
      list: lister(s3, S3B),
      get: getter(s3, S3B),
      /** 串流寫到 path，同時算 sha256／md5；null = 確認不存在。 */
      async download(key, path) {
        let r;
        try { r = await s3.send(new GetObjectCommand({ Bucket: S3B, Key: key })); }
        catch (e) { if (isMissing(e)) return null; throw e; }
        const sha = createHash('sha256'), md5 = createHash('md5'); let bytes = 0;
        await pipeline(r.Body, async function* (source) {
          for await (const c of source) { sha.update(c); md5.update(c); bytes += c.length; yield c; }
        }, createWriteStream(path));
        return { bytes, sha256: sha.digest('hex'), md5: md5.digest('hex'), etag: unq(r.ETag) };
      },
    },
    dst: {
      list: lister(r2, R2_BUCKET),
      get: getter(r2, R2_BUCKET),
      async head(key) {
        try { const h = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); return { size: h.ContentLength, etag: unq(h.ETag), metadata: h.Metadata ?? {} }; }
        catch (e) { if (isMissing(e)) return null; throw e; }
      },
      async put(key, { file, body, bytes, contentType: ct, cacheControl, metadata }) {
        assertWritableKey(key);
        await r2.send(new PutObjectCommand({
          Bucket: R2_BUCKET, Key: key, Body: body ?? createReadStream(file), ContentLength: body ? body.length : bytes,
          ContentType: ct, CacheControl: cacheControl, Metadata: metadata,
        }));
      },
      async del(keys) {
        keys.forEach(assertWritableKey);
        for (let i = 0; i < keys.length; i += 1000) {
          const r = await r2.send(new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects: keys.slice(i, i + 1000).map(Key => ({ Key })), Quiet: true } }));
          if (r.Errors?.length) fail(`R2 delete failed for ${r.Errors.length} keys`);
        }
      },
    },
  };
}

/** 防呆包裝：所有 put／del 先過守門；dry-run 只記錄不寫。 */
function guardedDst(dst, execute) {
  return {
    ...dst,
    async put(key, opts) { assertWritableKey(key); if (execute) await dst.put(key, opts); },
    async del(keys) { keys.forEach(assertWritableKey); if (execute) await dst.del(keys); },
  };
}

function newStats(name) { return { name, status: 'pending', checked: 0, uploaded: 0, uploadedBytes: 0, skipped: 0, deleted: 0, note: '', ms: 0 }; }

// ───────────── GFW ─────────────
function releaseDate(m) { return m.latest_complete_date ?? m.selected_utc_date; }
function referencedIds(root) {
  const ids = new Set([root.release_id]);
  for (const p of root.published_releases ?? []) {
    const m = /\/releases\/([^/]+)\//.exec(p?.manifest_key ?? '');
    if (m) ids.add(m[1]);
  }
  return ids;
}

/** 單一 namespace：讀 S3 root → 驗證 → 補 R2 缺少／不符的 release 資產 → 全部成功才換 root。 */
export async function syncGfwNamespace({ ns, src, dst, execute, work, concurrency = 4, now = Date.now(), log = () => {} }) {
  const stats = newStats(`gfw:${ns || 'canonical'}`);
  const srcPrefix = `deploy-assets/global-maritime/gfw-hourly${ns ? '/' + ns : ''}`;
  const dstPrefix = `site/global-maritime/gfw-hourly${ns ? '/' + ns : ''}`;
  const out = guardedDst(dst, execute);
  const rootKey = `${dstPrefix}/manifest.json`;
  assertWritableKey(rootKey);

  const rootBytes = await src.get(`${srcPrefix}/manifest.json`);
  const installedBytes = await dst.get(rootKey);
  if (rootBytes === null) {
    if (installedBytes !== null) fail('upstream root disappeared; keeping R2 root');
    stats.status = 'absent'; stats.note = 'S3 無 root manifest，略過';
    return stats;
  }
  const manifest = JSON.parse(rootBytes.toString('utf8'));
  if (manifest.schema_version === 4) fail('schema 4 root 尚未支援（v4 驗證邏輯未 export，需先抽出共用）');
  const assets = validateManifest(manifest);
  const rootSha = sha256(rootBytes);

  let installed = null;
  if (installedBytes !== null) {
    installed = JSON.parse(installedBytes.toString('utf8'));
    if (releaseDate(installed) > releaseDate(manifest)) fail('refusing release date regression');
    if (installed.release_id === manifest.release_id && JSON.stringify(installed.assets) !== JSON.stringify(manifest.assets)) fail('immutable release changed');
  }
  const rootCurrent = installedBytes !== null && sha256(installedBytes) === rootSha;

  const relPrefix = `releases/${manifest.release_id}/`;
  const [have, upstream] = await Promise.all([dst.list(`${dstPrefix}/${relPrefix}`), src.list(`${srcPrefix}/${relPrefix}`)]);
  const todo = [];
  const needHead = [];
  for (const a of assets) {
    stats.checked++;
    const key = assertWritableKey(`${dstPrefix}/${a.path}`);
    const r = have.get(key);
    if (!r || r.size !== a.bytes) { todo.push(a); continue; }
    const s = upstream.get(`${srcPrefix}/${a.path}`);
    if (s && s.etag && !s.etag.includes('-') && s.etag === r.etag) { stats.skipped++; continue; }
    needHead.push(a); // ETag 無法比 → 讀 metadata sha256
  }
  const headErrors = await pool(needHead, concurrency, async (a) => {
    const h = await dst.head(`${dstPrefix}/${a.path}`);
    if (h && h.size === a.bytes && h.metadata.sha256 === a.sha256) stats.skipped++; else todo.push(a);
  });
  if (headErrors.length) throw headErrors[0];

  log(`[gfw] ${ns || 'canonical'} release ${manifest.release_id}: ${assets.length} assets, ${todo.length} to upload (${todo.reduce((s, a) => s + a.bytes, 0)} B), root ${rootCurrent ? 'current' : 'will switch'}`);
  if (!execute) {
    stats.uploaded = todo.length; stats.uploadedBytes = todo.reduce((s, a) => s + a.bytes, 0);
    stats.status = 'dry-run'; stats.note = `release ${manifest.release_id}${rootCurrent ? '（root 已是最新）' : '（root 將更換）'}`;
    return stats;
  }

  let n = 0;
  const errors = await pool(todo, concurrency, async (a) => {
    const temp = join(work, `gfw-${process.pid}-${n++}`);
    try {
      const got = await src.download(`${srcPrefix}/${a.path}`, temp);
      if (got === null || got.bytes !== a.bytes || got.sha256 !== a.sha256) fail(`artifact download/hash/bytes verification failed: ${a.path}`);
      await out.put(`${dstPrefix}/${a.path}`, { file: temp, bytes: a.bytes, contentType: contentType(a.path), cacheControl: CACHE.gfwRelease, metadata: { sha256: a.sha256, 'src-etag': got.etag } });
      stats.uploaded++; stats.uploadedBytes += a.bytes;
    } finally { rmSync(temp, { force: true }); }
  });
  if (errors.length) { stats.status = 'failed'; fail(`${errors.length} asset(s) failed, root not switched: ${errors[0].message}`); }

  if (!rootCurrent) {
    if (installed && installed.release_id !== manifest.release_id) {
      const receiptKey = `${dstPrefix}/.retired/${installed.release_id}.json`;
      if (await dst.head(receiptKey) === null) {
        await out.put(receiptKey, { body: Buffer.from(JSON.stringify({ releaseId: installed.release_id, retiredAt: now, replacedBy: manifest.release_id })), contentType: 'application/json', cacheControl: 'no-store', metadata: {} });
      }
    }
    // 指標最後換；用的是驗證過的同一份 bytes，不重抓。
    await out.put(rootKey, { body: rootBytes, contentType: 'application/json', cacheControl: CACHE.gfwRoot, metadata: { sha256: rootSha } });
    stats.uploaded++; stats.uploadedBytes += rootBytes.length;
  }
  stats.status = rootCurrent ? 'current' : 'installed';
  stats.note = `release ${manifest.release_id}`;
  return stats;
}

/** --prune：R2 上不被 root（含 published_releases）引用、且退役 receipt 滿 8 天的 release 才刪。 */
export async function pruneGfwNamespace({ ns, dst, execute, now = Date.now(), log = () => {} }) {
  const stats = newStats(`prune:${ns || 'canonical'}`);
  const dstPrefix = `site/global-maritime/gfw-hourly${ns ? '/' + ns : ''}`;
  const out = guardedDst(dst, execute);
  const rootBytes = await dst.get(`${dstPrefix}/manifest.json`);
  if (rootBytes === null) { stats.status = 'absent'; return stats; }
  const keep = referencedIds(JSON.parse(rootBytes.toString('utf8')));
  const objects = await dst.list(`${dstPrefix}/releases/`);
  const byId = new Map();
  for (const key of objects.keys()) {
    const id = key.slice(`${dstPrefix}/releases/`.length).split('/')[0];
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(key);
  }
  for (const [id, keys] of byId) {
    stats.checked++;
    if (keep.has(id)) { stats.skipped++; continue; }
    const receiptKey = `${dstPrefix}/.retired/${id}.json`;
    const receipt = await dst.get(receiptKey);
    if (receipt === null) {
      // 沒有退役紀錄（例如手動放入）：現在起算，8 天後才可刪。
      await out.put(receiptKey, { body: Buffer.from(JSON.stringify({ releaseId: id, retiredAt: now, replacedBy: null })), contentType: 'application/json', cacheControl: 'no-store', metadata: {} });
      stats.skipped++; continue;
    }
    const r = JSON.parse(receipt.toString('utf8'));
    if (r.releaseId !== id || !Number.isFinite(r.retiredAt) || now - r.retiredAt < RETIRE_GRACE_MS) { stats.skipped++; continue; }
    log(`[prune] ${ns || 'canonical'} delete release ${id} (${keys.length} objects)`);
    await out.del([...keys, receiptKey]);
    stats.deleted += keys.length;
  }
  stats.status = execute ? 'done' : 'dry-run';
  return stats;
}

// ───────────── climate ─────────────
export function climateRank(rel) {
  if (rel === 'frames/manifest.json') return 3;
  if (/_latest\.json$/.test(rel)) return 2;
  if (/_latest\.[A-Za-z0-9]+$/.test(rel)) return 1;
  return 0;
}

export async function syncClimate({ src, dst, execute, work, concurrency = 4, log = () => {} }) {
  const stats = newStats('climate');
  const out = guardedDst(dst, execute);
  const [upstream, have] = await Promise.all([src.list('deploy-assets/climate/'), dst.list('site/climate/')]);
  const todo = [];
  const needHead = [];
  for (const [key, s] of upstream) {
    const rel = key.slice('deploy-assets/climate/'.length);
    if (!rel || rel.endsWith('/')) continue;
    stats.checked++;
    const dkey = assertWritableKey(`site/climate/${rel}`);
    const r = have.get(dkey);
    if (r && r.size === s.size && s.etag && r.etag === s.etag && !s.etag.includes('-')) { stats.skipped++; continue; }
    if (r && r.size === s.size) needHead.push({ rel, key, dkey, s }); else todo.push({ rel, key, dkey, s });
  }
  const headErrors = await pool(needHead, concurrency, async (t) => {
    const h = await dst.head(t.dkey);
    if (h && h.metadata['src-etag'] === t.s.etag) stats.skipped++; else todo.push(t);
  });
  if (headErrors.length) throw headErrors[0];

  const phases = [0, 1, 2, 3].map(rank => todo.filter(t => climateRank(t.rel) === rank));
  const plannedBytes = todo.reduce((s, t) => s + t.s.size, 0);
  log(`[climate] ${stats.checked} objects, ${todo.length} to upload (${plannedBytes} B), pointers ${phases.slice(1).flat().length}`);
  if (!execute) { stats.uploaded = todo.length; stats.uploadedBytes = plannedBytes; stats.status = 'dry-run'; return stats; }

  let n = 0;
  for (const [rank, items] of phases.entries()) {
    const errors = await pool(items, rank === 0 ? concurrency : 1, async (t) => {
      const temp = join(work, `climate-${process.pid}-${n++}`);
      try {
        const got = await src.download(t.key, temp);
        if (got === null) fail(`climate object vanished: ${t.rel}`);
        if (got.etag && !got.etag.includes('-') && got.md5 !== got.etag) fail(`climate md5 mismatch: ${t.rel}`);
        await out.put(t.dkey, { file: temp, bytes: got.bytes, contentType: contentType(t.rel), cacheControl: CACHE.climate, metadata: { sha256: got.sha256, 'src-etag': got.etag } });
        stats.uploaded++; stats.uploadedBytes += got.bytes;
      } finally { rmSync(temp, { force: true }); }
    });
    // 一般檔有失敗就不換指標；指標內部也依序（png → json → manifest），任一失敗即停。
    if (errors.length) { stats.status = 'failed'; fail(`climate: ${errors.length} upload(s) failed at phase ${rank}, later pointers not switched: ${errors[0].message}`); }
  }
  stats.status = todo.length ? 'updated' : 'current';
  return stats;
}

// ───────────── CLI ─────────────
function parseArgs(argv) {
  const args = { execute: false, prune: false, only: null, env: null, concurrency: 4 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--execute') args.execute = true;
    else if (a === '--dry-run') args.execute = false;
    else if (a === '--prune') args.prune = true;
    else if (a === '--only') args.only = argv[++i];
    else if (a === '--env') args.env = argv[++i];
    else if (a === '--concurrency') args.concurrency = Math.max(1, Math.min(4, Number(argv[++i]) || 4));
    else fail(`unknown argument: ${a}`);
  }
  if (args.only && !['gfw', 'climate'].includes(args.only)) fail('--only must be gfw or climate');
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.env) loadEnv(resolve(args.env));
  const { src, dst } = await awsStores();
  const work = mkdtempSync(join(tmpdir(), 'sync-rotating-'));
  const results = [];
  let failed = false;
  const t0 = Date.now();
  const run = async (name, fn) => {
    const t = Date.now();
    try { const s = await fn(); s.ms = Date.now() - t; results.push(s); }
    catch (error) { failed = true; results.push({ ...newStats(name), status: 'ERROR', note: error.message, ms: Date.now() - t }); }
  };
  const log = (m) => console.log(m);
  console.log(`[sync-rotating] mode=${args.execute ? 'EXECUTE' : 'dry-run'}${args.prune ? ' +prune' : ''} concurrency=${args.concurrency}`);
  try {
    if (args.only !== 'climate') {
      for (const ns of GFW_NAMESPACES) await run(`gfw:${ns || 'canonical'}`, () => syncGfwNamespace({ ns, src, dst, execute: args.execute, work, concurrency: args.concurrency, log }));
      if (args.prune) for (const ns of GFW_NAMESPACES) await run(`prune:${ns || 'canonical'}`, () => pruneGfwNamespace({ ns, dst, execute: args.execute, log }));
    }
    if (args.only !== 'gfw') await run('climate', () => syncClimate({ src, dst, execute: args.execute, work, concurrency: args.concurrency, log }));
  } finally { rmSync(work, { recursive: true, force: true }); }

  console.log('\nsection            status     checked  upload  bytes          skipped  deleted  seconds  note');
  for (const s of results) {
    console.log(`${s.name.padEnd(18)} ${s.status.padEnd(10)} ${String(s.checked).padStart(7)} ${String(s.uploaded).padStart(7)} ${String(s.uploadedBytes).padStart(14)} ${String(s.skipped).padStart(8)} ${String(s.deleted).padStart(8)} ${(s.ms / 1000).toFixed(1).padStart(8)}  ${s.note}`);
  }
  const tot = results.reduce((a, s) => ({ n: a.n + s.uploaded, b: a.b + s.uploadedBytes }), { n: 0, b: 0 });
  console.log(`total: ${args.execute ? 'uploaded' : 'planned'} ${tot.n} files, ${(tot.b / 1e9).toFixed(3)} GB, elapsed ${((Date.now() - t0) / 1000).toFixed(1)} s${failed ? ' — ERRORS' : ''}`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`[sync-rotating] ${error.message}`); process.exitCode = 1; });
}
