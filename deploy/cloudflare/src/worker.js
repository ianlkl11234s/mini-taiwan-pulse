// Mini Taiwan Pulse 測試站 Worker（第 ③ 關）。
// 重現 nginx.conf 的路由：網頁走 Workers 靜態資產、圖層大檔走 R2（data.itsmigu.com/site/）、
// /api 與短效 manifest 測試期間暫時轉回現行正式站；氣候、GFW 由 sync-rotating.mjs 同步到 R2。
// 規格來源：nginx.conf（v2.22.1）；每段註解標 nginx 行號。

const R2_BASE = 'https://data.itsmigu.com/site';

const HSTS = 'max-age=31536000';
const CSP_MAIN_ENF = "frame-ancestors 'self'; object-src 'none'; base-uri 'self'";
const CSP_MAIN_RO = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https://protomaps.github.io; worker-src 'self' blob:; child-src 'self' blob:; connect-src 'self' https://protomaps.github.io https://utcmcikhvxnohbxchbrs.supabase.co wss://utcmcikhvxnohbxchbrs.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://data.itsmigu.com https://pub-eae6980c040441adbd1eaded2870d3d2.r2.dev; frame-src 'self' https:; media-src 'self' blob: https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
const CSP_EMBED = "frame-ancestors *; object-src 'none'; base-uri 'self'";
const CSP_STRICT = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const CSP_CARD = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; child-src 'self' blob:; connect-src 'self' https://utcmcikhvxnohbxchbrs.supabase.co https://data.itsmigu.com https://protomaps.github.io https://pub-eae6980c040441adbd1eaded2870d3d2.r2.dev; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const CSP_LAB = "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://utcmcikhvxnohbxchbrs.supabase.co; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

const SEC = { 'Strict-Transport-Security': HSTS, 'X-Content-Type-Options': 'nosniff' };
const HTML = (csp) => ({ 'Cache-Control': 'no-cache', ...SEC, 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Security-Policy': csp });
const MAIN = { ...HTML(CSP_MAIN_ENF), 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy-Report-Only': CSP_MAIN_RO };

// nginx L7-13 $static_cache_control
const CC_RULES = [
  [/manifest[^/]*\.json$/i, 'public, max-age=300, must-revalidate'],
  [/_current\.[^/]+$/i, 'public, max-age=300, must-revalidate'],
  [/_(19|20)[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])([^0-9/][^/]*)?$/i, 'public, max-age=31536000, immutable'],
  [/\.[0-9a-f]{8,}\.[a-z0-9.]+$/i, 'public, max-age=31536000, immutable'],
];
const ccMap = (p) => (CC_RULES.find(([re]) => re.test(p)) || [, 'public, max-age=86400'])[1];
const CC_1Y = 'public, max-age=31536000, immutable';

// nginx L284-542：先 /data 再 dist
const DATA_THEN_DIST = ['geo', 'h3', 'bus', 'forestry', 'fishery', 'flood', 'urban', 'culture', 'civic_facilities', 'religion', 'funeral', 'welfare', 'hazards', 'indigenous_rural', 'marine', 'environment', 'public_life', 'poi', 'harm_reduction', 'world', 'tourism', 'coverage'];
// 純 /data（非 ^~），值為固定 Cache-Control，null = map
const DATA_ONLY = { water_resources: null, agriculture: null, business_registry: CC_1Y, industrial_zone: CC_1Y, sports: null, education: null, 'static-rpc': null, medical: null, base_map: null, fire: null, police_justice: null, road: null, rail: null, 'embed-snapshots': CC_1Y, 'embed-rail': CC_1Y };
// ^~ 前綴：不受 L893 副檔名正則影響
const CARET = ['/climate/', '/network_structures/', '/global-maritime/', '/jp-heights/', '/jp-medical/', '/flight-trails/', '/blog/', '/card/', '/lab/', '/assets/', '/api/research/v1/', '/.private-allen'];
// 短效指標檔：測試期一律以正式站為準，避免 R2 一次性副本過期
const SHORT_LIVED = [/manifest[^/]*\.json$/i, /_current\.[^/]+$/i, /^\/jp-heights\/catalog\.json$/, /^\/(aviation_data|ship_data|temperature_grid)\.json$/];

const MIME = { pmtiles: 'application/vnd.pmtiles', geojson: 'application/geo+json', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', csv: 'text/csv', txt: 'text/plain', bin: 'application/octet-stream', gz: 'application/octet-stream', arrow: 'application/octet-stream', mp4: 'video/mp4' };
const extOf = (p) => (p.match(/\.([A-Za-z0-9]+)$/) || [, ''])[1].toLowerCase();

function withHeaders(res, extra, { status, drop = [] } = {}) {
  const h = new Headers(res.headers);
  for (const k of drop) h.delete(k);
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(res.body, { status: status ?? res.status, statusText: res.statusText, headers: h });
}
const notFound = (extra = SEC) => new Response('<html><head><title>404 Not Found</title></head><body><center><h1>404 Not Found</h1></center></body></html>', { status: 404, headers: { 'Content-Type': 'text/html', ...extra } });
const redirect = (loc, status, extra = SEC) => new Response(null, { status, headers: { Location: loc, ...extra } });

async function asset(env, req, path) {
  const u = new URL(req.url); u.pathname = path; u.search = '';
  const r = await env.ASSETS.fetch(new Request(u, req));
  if (r.status === 404) return null;
  const h = new Headers(r.headers);
  if (!h.get('content-type') && MIME[extOf(path)]) h.set('Content-Type', MIME[extOf(path)]);
  h.set('Accept-Ranges', 'bytes');
  // 靜態資產 binding 不處理 Range → 自己切（PMTiles 必須 206）
  const m = r.status === 200 && (req.headers.get('range') || '').match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    const buf = await r.arrayBuffer();
    const size = buf.byteLength;
    let start, end;
    if (m[1] === '') { start = Math.max(0, size - Number(m[2])); end = size - 1; }
    else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
    if (start >= size || start > end) {
      h.set('Content-Range', `bytes */${size}`); h.delete('content-length');
      return new Response(null, { status: 416, headers: h });
    }
    h.set('Content-Range', `bytes ${start}-${end}/${size}`);
    h.set('Content-Length', String(end - start + 1));
    return new Response(req.method === 'HEAD' ? null : buf.slice(start, end + 1), { status: 206, headers: h });
  }
  return new Response(r.body, { status: r.status, headers: h });
}

// R2 公開網域（走 Cloudflare 邊緣快取）；保留 Range／條件請求
async function fromR2(req, path, cc) {
  const h = new Headers();
  for (const k of ['range', 'if-none-match', 'if-modified-since', 'if-range']) { const v = req.headers.get(k); if (v) h.set(k, v); }
  const r = await fetch(R2_BASE + path, { method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers: h });
  if (r.status === 404 || r.status === 403) return null;
  const out = new Headers();
  for (const k of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) { const v = r.headers.get(k); if (v) out.set(k, v); }
  out.set('Content-Type', MIME[extOf(path)] || 'application/octet-stream');
  if (cc && r.status < 400) out.set('Cache-Control', cc);
  out.set('X-Pulse-Src', 'r2');
  return new Response(r.body, { status: r.status, headers: out });
}

// 轉回現行正式站（Zeabur）。測試站網址與正式站不同，不會迴圈。
async function fromOrigin(req, env, url, tag = 'origin') {
  const target = new URL(url.pathname + url.search, env.ORIGIN);
  const h = new Headers(req.headers);
  h.delete('host'); h.delete('cookie');
  const ip = req.headers.get('cf-connecting-ip'); if (ip) { h.set('X-Forwarded-For', ip); h.set('X-Real-IP', ip); }
  const init = { method: req.method, headers: h, redirect: 'manual' };
  if (!['GET', 'HEAD'].includes(req.method)) { init.body = req.body; init.duplex = 'half'; }
  const r = await fetch(target, init);
  return withHeaders(r, { 'X-Pulse-Src': tag });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    let path;
    try { path = decodeURIComponent(url.pathname); } catch { return notFound(); }

    // L32 dotfile（含 /.well-known、/.private-allen）
    if (path.includes('/.')) return notFound();

    // /api/*：research-gateway 與私有 sidecar 只能轉回正式站
    if (path.startsWith('/api/')) return fromOrigin(req, env, url);

    // HTML 入口（L683-772）
    if (path === '/embed' || path === '/embed.html') {
      const r = await asset(env, req, '/embed.html');
      return r ? withHeaders(r, HTML(CSP_EMBED)) : notFound();
    }
    if (path === '/privacy' || path === '/privacy.html') {
      const r = await asset(env, req, '/privacy.html');
      return r ? withHeaders(r, HTML(CSP_STRICT)) : notFound();
    }
    if (path === '/blog') return redirect('/blog/' + url.search, 301);
    if (path.startsWith('/blog/')) {
      let m;
      if (/^\/blog\/rail\/?$/.test(path)) return redirect('/blog/layers/' + url.search, 301, HTML(CSP_STRICT));
      if ((m = path.match(/^\/blog\/rail\/([a-z0-9-]+)(\/.*)?$/))) return redirect(`/blog/${m[1]}${m[2] || ''}${url.search}`, 301, HTML(CSP_STRICT));
      if (/^\/blog(?:\/[a-z0-9-]+){1,2}$/.test(path)) return redirect(path + '/' + url.search, 301, HTML(CSP_STRICT));
      const r = (await asset(env, req, path)) || (path.endsWith('/') ? await asset(env, req, path + 'index.html') : null);
      return r ? withHeaders(r, HTML(CSP_STRICT)) : notFound(HTML(CSP_STRICT));
    }
    if (path === '/card') return notFound();
    if (path.startsWith('/card/')) {
      const r = await asset(env, req, '/card.html');
      return r ? withHeaders(r, { 'Cache-Control': 'no-store', ...SEC, 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex', 'Content-Security-Policy': CSP_CARD }, { status: 200 }) : notFound();
    }
    if (path === '/lab') return redirect('/lab/', 308);
    if (path.startsWith('/lab/')) {
      const r = (path.endsWith('/') ? null : await asset(env, req, path)) || (await asset(env, req, '/lab/index.html'));
      return r ? withHeaders(r, { 'Cache-Control': 'no-store', ...SEC, 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': CSP_LAB }, { status: 200 }) : notFound();
    }
    if (path.startsWith('/assets/')) {
      const r = await asset(env, req, path);
      return r ? withHeaders(r, { 'Cache-Control': CC_1Y, ...SEC }) : notFound();
    }

    const seg = path.split('/')[1] || '';
    const isCaret = CARET.some((p) => path.startsWith(p));

    // 輪替資料（sync-rotating.mjs 每小時同步到 R2）：L443-489、L586
    if (seg === 'climate') return (await fromR2(req, path, ccMap(path))) || notFound({});
    if (seg === 'global-maritime') {
      const cc = /^\/global-maritime\/gfw-hourly\/(v3-shadow\/|v4\/)?manifest\.json$/.test(path) ? 'public,max-age=60,s-maxage=60,stale-while-revalidate=300'
        : /^\/global-maritime\/gfw-hourly\/(v3-shadow\/|v4\/)?releases\//.test(path) ? 'public,max-age=604800,s-maxage=604800,immutable' : null;
      return (await fromR2(req, path, cc)) || notFound(cc ? { 'Cache-Control': cc } : SEC);
    }

    // 短效指標檔：測試期轉回正式站
    if (SHORT_LIVED.some((re) => re.test(path))) return fromOrigin(req, env, url);

    // ^~ 純 R2 家族（L562、L776-831）
    if (seg === 'network_structures') return (await fromR2(req, path, ccMap(path))) || fromOrigin(req, env, url, 'origin-miss');
    if (seg === 'jp-heights' || seg === 'jp-medical' || seg === 'flight-trails') {
      const cc = /^\/(jp-heights\/assets|jp-medical\/releases|flight-trails\/releases)\//.test(path) ? CC_1Y : (seg === 'flight-trails' ? 'no-store' : 'public,max-age=60');
      return (await fromR2(req, path, cc)) || fromOrigin(req, env, url, 'origin-miss');
    }

    // L277 ookla：只走 dist
    if (/^\/geo\/ookla_(fixed_global|mobile_global|tw_z14|tw_z16)(_[0-9]+)?\.(geojson|pmtiles)$/.test(path)) {
      const r = await asset(env, req, path);
      return r ? withHeaders(r, { 'Cache-Control': ccMap(path) }) : notFound();
    }

    // L893 靜態副檔名正則：非 ^~ 路徑一律從 dist 供檔、7 天 immutable
    if (!isCaret && /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$/i.test(path)) {
      const r = await asset(env, req, path);
      return r ? withHeaders(r, { 'Cache-Control': 'public, max-age=604800, immutable', ...SEC }) : notFound();
    }

    // 先 R2 再 dist（L284-542）
    if (DATA_THEN_DIST.includes(seg)) {
      const r2 = await fromR2(req, path, ccMap(path));
      if (r2) return r2;
      const r = await asset(env, req, path);
      return r ? withHeaders(r, { 'Cache-Control': ccMap(path) }) : notFound({});
    }
    // 純 R2（L319-673）；測試期 R2 沒有時轉回正式站並標記，方便事後清點
    if (seg in DATA_ONLY) {
      return (await fromR2(req, path, DATA_ONLY[seg] || ccMap(path))) || fromOrigin(req, env, url, 'origin-miss');
    }

    // location /（L843）：dist → 目錄 index → SPA fallback（有副檔名回 404）
    const r = (await asset(env, req, path)) || (path.endsWith('/') ? await asset(env, req, path + 'index.html') : null);
    if (r) return withHeaders(r, MAIN);
    if (/\.[A-Za-z0-9]+$/.test(path)) return notFound();
    const idx = await asset(env, req, '/index.html');
    return withHeaders(idx, MAIN, { status: 200 });
  },
};
