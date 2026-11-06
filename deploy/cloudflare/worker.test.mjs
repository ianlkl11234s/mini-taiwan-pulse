// node --test deploy/cloudflare/worker.test.mjs
// fromOrigin()：新主機入口驗證 header（Access service token＋X-Pulse-Origin-Auth）只來自 Worker env。
import test from 'node:test';
import assert from 'node:assert/strict';
import { fromOrigin } from './src/worker.js';

const FORGED = {
  'CF-Access-Client-Id': 'forged-id',
  'CF-Access-Client-Secret': 'forged-secret',
  'X-Pulse-Origin-Auth': 'forged-auth',
  'X-Real-IP': '6.6.6.6',
  'X-Forwarded-For': '6.6.6.6',
  Cookie: 'session=abc',
  'CF-Connecting-IP': '203.0.113.7',
  Range: 'bytes=0-15',
};

async function call(env, { method = 'GET', originHeaders = {} } = {}) {
  const seen = {};
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (target, init) => {
    seen.target = String(target);
    seen.headers = init.headers;
    return new Response('ok', { status: 200, headers: originHeaders });
  };
  try {
    const url = new URL('https://pulse.example/api/private-research/coral?x=1');
    const req = new Request(url, { method, headers: FORGED });
    const res = await fromOrigin(req, { ORIGIN: 'https://origin.example', ...env }, url);
    return { seen, res };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('env 沒設：不帶任何入口驗證 header，偽造版本被刪掉', async () => {
  const { seen, res } = await call({});
  assert.equal(seen.target, 'https://origin.example/api/private-research/coral?x=1');
  for (const k of ['cf-access-client-id', 'cf-access-client-secret', 'x-pulse-origin-auth', 'cookie']) {
    assert.equal(seen.headers.get(k), null, k);
  }
  assert.equal(seen.headers.get('range'), 'bytes=0-15');
  assert.equal(res.headers.get('x-pulse-src'), 'origin');
});

test('X-Real-IP／X-Forwarded-For 一律用 CF-Connecting-IP 覆寫', async () => {
  const { seen } = await call({});
  assert.equal(seen.headers.get('x-real-ip'), '203.0.113.7');
  assert.equal(seen.headers.get('x-forwarded-for'), '203.0.113.7');
});

test('env 有設：以 env 值覆寫，不沿用瀏覽器送來的值', async () => {
  const { seen } = await call({ CF_ACCESS_CLIENT_ID: 'id.access', CF_ACCESS_CLIENT_SECRET: 'sec', PULSE_ORIGIN_SECRET: 'shared' });
  assert.equal(seen.headers.get('cf-access-client-id'), 'id.access');
  assert.equal(seen.headers.get('cf-access-client-secret'), 'sec');
  assert.equal(seen.headers.get('x-pulse-origin-auth'), 'shared');
});

test('只設 PULSE_ORIGIN_SECRET 時，Access header 仍不帶偽造值', async () => {
  const { seen } = await call({ PULSE_ORIGIN_SECRET: 'shared' });
  assert.equal(seen.headers.get('x-pulse-origin-auth'), 'shared');
  assert.equal(seen.headers.get('cf-access-client-id'), null);
  assert.equal(seen.headers.get('cf-access-client-secret'), null);
});

test('回應不帶出入口驗證 header', async () => {
  const { res } = await call(
    { CF_ACCESS_CLIENT_ID: 'id.access', CF_ACCESS_CLIENT_SECRET: 'sec', PULSE_ORIGIN_SECRET: 'shared' },
    { originHeaders: { 'CF-Access-Client-Id': 'id.access', 'CF-Access-Client-Secret': 'sec', 'X-Pulse-Origin-Auth': 'shared', 'Content-Type': 'text/plain' } },
  );
  for (const k of ['cf-access-client-id', 'cf-access-client-secret', 'x-pulse-origin-auth']) assert.equal(res.headers.get(k), null, k);
  assert.equal(res.headers.get('content-type'), 'text/plain');
  assert.equal(await res.text(), 'ok');
});
