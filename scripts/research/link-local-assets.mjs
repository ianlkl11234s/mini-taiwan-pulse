#!/usr/bin/env node
// Reuse existing public map assets in a local worktree; never overwrite its files.
import { readdir, lstat, mkdir, realpath, symlink } from 'node:fs/promises';
import { resolve, relative, dirname, extname, basename } from 'node:path';
const sourceArg = process.argv[2];
if (!sourceArg) throw new Error('Usage: node scripts/research/link-local-assets.mjs <existing-public-directory>');
const source = await realpath(resolve(sourceArg));
const target = resolve(process.cwd(), 'public');
if (basename(source) !== 'public' || source === target) throw new Error('Expected a different existing public directory');
const allowed = new Set(['.json', '.geojson', '.pmtiles', '.pbf', '.png', '.jpg', '.webp', '.svg', '.bin', '.csv', '.gltf', '.glb']);
let linked = 0;
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || /^(private|secrets?|credentials?)$/i.test(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) { await visit(path); continue; }
    // Do not follow links out of the original public directory.
    if (!entry.isFile() || !allowed.has(extname(entry.name).toLowerCase())) continue;
    const destination = resolve(target, relative(source, path));
    try { await lstat(destination); continue; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(dirname(destination), { recursive: true });
    await symlink(path, destination); linked++;
  }
}
await visit(source);
console.log(JSON.stringify({ linked, source, target, overwritten: 0 }));
