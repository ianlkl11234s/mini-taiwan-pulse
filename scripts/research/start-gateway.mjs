#!/usr/bin/env node
// Local recovery launcher; use the existing site's public auth configuration.
import { loadEnv } from 'vite';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const email = process.env.PULSE_RESEARCH_PILOT_EMAILS;
if (!email || !/^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(email)) throw new Error('Set PULSE_RESEARCH_PILOT_EMAILS to the authorized test account.');
const site = loadEnv('development', root, 'VITE_');
if (!site.VITE_SUPABASE_URL || !site.VITE_SUPABASE_ANON_KEY) throw new Error('SITE_AUTH_CONFIGURATION_MISSING');
const runtime = resolve(root, '../runtime');
mkdirSync(runtime, { recursive: true, mode: 0o700 });
const gatewayEntry = process.env.PULSE_RESEARCH_GATEWAY_ENTRY
  ? resolve(process.env.PULSE_RESEARCH_GATEWAY_ENTRY)
  : resolve(root, '../gis-platform/services/research-gateway/server.mjs');
const child = spawn(process.execPath, [gatewayEntry], {
  stdio: 'inherit', env: { ...process.env, SUPABASE_URL: site.VITE_SUPABASE_URL, SUPABASE_ANON_KEY: site.VITE_SUPABASE_ANON_KEY,
    PULSE_RESEARCH_ALLOW_LOOPBACK: '1', PULSE_RESEARCH_HOST: '127.0.0.1', PULSE_RESEARCH_PORT: '8791', PULSE_RESEARCH_ORIGINS: 'http://127.0.0.1:3732',
    PULSE_RESEARCH_PILOT_ACCOUNTS: '', PULSE_RESEARCH_PILOT_EMAILS: email, PULSE_RESEARCH_STORE: resolve(runtime, 'map-exploration.sqlite') },
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', code => process.exit(code ?? 1));
