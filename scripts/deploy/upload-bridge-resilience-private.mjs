/**
 * Explicit private publication only: never part of build or public asset sync.
 * 只在使用者明確授權時手動執行。橋梁韌性授權狀態 HOLD_BSS_BULK_REUSE_RIGHTS_UNCONFIRMED，
 * 僅站主可讀；不屬於 build、公開資產同步或 CDN upload。
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { S3Client, GetBucketPolicyCommand, GetBucketOwnershipControlsCommand, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { BRIDGE_RESILIENCE_ASSETS } from '../../server/coral-private/coral-private-server.mjs';

const root = process.argv[2];
if (!root) throw new Error('Pass the verified local bridge resilience data directory');
const Bucket = 'migu-private-research-ap-southeast-2';
const region = 'ap-southeast-2';
const prefix = 'private-research/bridge-resilience';
const client = new S3Client({ region, credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY } });

// Single source of truth: BRIDGE_RESILIENCE_ASSETS in the sidecar. local_validation.json
// ({assets:{<filename>:{size,sha256}}}) and the bytes on disk must agree with it on size and sha256.
const validation = JSON.parse(await readFile(`${root}/local_validation.json`, 'utf8'));

const assets = Object.entries(BRIDGE_RESILIENCE_ASSETS).map(([name, a]) => [name, a.filename, a.size, a.sha256]);
for (const [, filename, size, sha256] of assets) {
  if (!size || !/^[0-9a-f]{64}$/.test(sha256)) throw new Error('BRIDGE_RESILIENCE_ASSETS is invalid; stop publication');
  const recorded = validation.assets?.[filename];
  if (!recorded || recorded.size !== size || recorded.sha256 !== sha256) throw new Error(`local_validation.json does not match BRIDGE_RESILIENCE_ASSETS for ${filename}`);
  const local = await readFile(`${root}/${filename}`);
  if (local.length !== size || createHash('sha256').update(local).digest('hex') !== sha256) throw new Error('Local file does not match BRIDGE_RESILIENCE_ASSETS');
}

// Fail closed on any public Allow. This bucket holds private research only, so a
// missing bucket policy (NoSuchBucketPolicy) means there is no public grant at all.
let statements = [];
try {
  const policy = await client.send(new GetBucketPolicyCommand({ Bucket }));
  // IAM allows Statement to be a single object as well as an array; normalise before iterating.
  statements = [].concat(JSON.parse(policy.Policy).Statement ?? []);
} catch (error) {
  if (error?.name !== 'NoSuchBucketPolicy') throw error;
}
for (const statement of statements) {
  const principal = statement.Principal;
  const publicPrincipal = principal === '*' || (typeof principal === 'object' && JSON.stringify(principal).includes('"*"'));
  if (statement.Effect === 'Allow' && publicPrincipal) throw new Error('Unexpected public bucket policy; stop publication');
}
const ownership = await client.send(new GetBucketOwnershipControlsCommand({ Bucket }));
const ownerEnforced = ownership.OwnershipControls?.Rules?.some(rule => rule.ObjectOwnership === 'BucketOwnerEnforced');
const privateAcl = ownerEnforced ? {} : { ACL: 'private' };
const results = [];
for (const [product, filename, size, sha256] of assets) {
  const bytes = await readFile(`${root}/${filename}`);
  if (bytes.length !== size || createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('Local contract mismatch');
  const Key = `${prefix}/${sha256}/${filename}`;
  let exists = false;
  try { await client.send(new HeadObjectCommand({ Bucket, Key })); exists = true; }
  catch (error) { if (error.$metadata?.httpStatusCode !== 404) throw error; }
  if (!exists) await client.send(new PutObjectCommand({ Bucket, Key, Body: bytes, IfNoneMatch: '*', ...privateAcl, ServerSideEncryption: 'AES256', CacheControl: 'private, no-store', ContentType: filename.endsWith('.pmtiles') ? 'application/vnd.pmtiles' : 'application/json', ChecksumSHA256: Buffer.from(sha256, 'hex').toString('base64') }));
  const response = await client.send(new GetObjectCommand({ Bucket, Key, ChecksumMode: 'ENABLED' }));
  const downloaded = await response.Body.transformToByteArray();
  if (downloaded.length !== size || createHash('sha256').update(downloaded).digest('hex') !== sha256 || response.CacheControl !== 'private, no-store' || response.ServerSideEncryption !== 'AES256') throw new Error('Private readback mismatch');
  const head = await client.send(new HeadObjectCommand({ Bucket, Key }));
  if (head.ContentLength !== size) throw new Error('HeadObject size mismatch');
  const anonymous = await fetch(`https://${Bucket}.s3.${region}.amazonaws.com/${Key}`, { method: 'HEAD' });
  if (anonymous.status !== 403) throw new Error('Anonymous object access was not denied');
  results.push({ product, key: Key, size, sha256, uploaded: !exists, readback: 'sha256+bytes match', anonymousStatus: anonymous.status, encryption: response.ServerSideEncryption, cacheControl: response.CacheControl });
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), bucket: Bucket, results }, null, 2));
