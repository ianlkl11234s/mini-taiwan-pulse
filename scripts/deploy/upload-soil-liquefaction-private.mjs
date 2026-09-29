/** Explicit private publication only: never part of build or public asset sync. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { S3Client, GetBucketPolicyCommand, GetBucketOwnershipControlsCommand, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { SOIL_LIQUEFACTION_ASSETS } from '../../server/coral-private/coral-private-server.mjs';

const root = process.argv[2];
if (!root) throw new Error('Pass the verified local soil liquefaction data directory');
const Bucket = 'migu-private-research-ap-southeast-2';
const region = 'ap-southeast-2';
const prefix = 'private-research/soil-liquefaction';
const client = new S3Client({ region, credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY } });

// Single source of truth: SOIL_LIQUEFACTION_ASSETS in the sidecar. It must be filled in
// and must agree with soil-liquefaction.receipt.json and the bytes on disk before anything is published.
const receipt = JSON.parse(await readFile(`${root}/soil-liquefaction.receipt.json`, 'utf8'));
// 04_private_pmtiles.py writes the artifact contract at the top level as size_bytes + sha256.
const receiptContract = Number.isInteger(receipt.size_bytes) && typeof receipt.sha256 === 'string'
  ? { size: receipt.size_bytes, sha256: receipt.sha256 }
  : null;
if (!receiptContract) throw new Error('Receipt has no size/sha256');

const assets = Object.entries(SOIL_LIQUEFACTION_ASSETS).map(([name, a]) => [name, a.filename, a.size, a.sha256]);
for (const [, , size, sha256] of assets) {
  if (!size || !/^[0-9a-f]{64}$/.test(sha256)) throw new Error('SOIL_LIQUEFACTION_ASSETS is still a placeholder; stop publication');
  if (receiptContract.size !== size || receiptContract.sha256 !== sha256) throw new Error('Receipt does not match SOIL_LIQUEFACTION_ASSETS');
}

// Fail closed on any public Allow outside the previously approved flight-arc prefix.
const policy = await client.send(new GetBucketPolicyCommand({ Bucket }));
for (const statement of JSON.parse(policy.Policy).Statement) {
  const principal = statement.Principal;
  const publicPrincipal = principal === '*' || (typeof principal === 'object' && JSON.stringify(principal).includes('"*"'));
  if (statement.Effect === 'Allow' && publicPrincipal) {
    const resources = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
    if (resources.some(value => !value.startsWith(`arn:aws:s3:::${Bucket}/flight-arc/`))) throw new Error('Unexpected public bucket policy; stop publication');
  }
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
  if (!exists) await client.send(new PutObjectCommand({ Bucket, Key, Body: bytes, IfNoneMatch: '*', ...privateAcl, ServerSideEncryption: 'AES256', CacheControl: 'private, no-store', ContentType: 'application/vnd.pmtiles', ChecksumSHA256: Buffer.from(sha256, 'hex').toString('base64') }));
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
