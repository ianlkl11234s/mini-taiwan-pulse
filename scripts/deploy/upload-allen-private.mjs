/** Explicit private publication only: never part of build or public asset sync. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { S3Client, GetBucketPolicyCommand, GetBucketOwnershipControlsCommand, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
const root = process.argv[2];
if (!root) throw new Error('Pass the verified local Allen data directory');
const Bucket = 'migu-gis-data-collector';
const region = 'ap-southeast-2';
const client = new S3Client({ region, credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY } });
const assets = [
  ['benthic', 94597292, 'c877b8183253e109330c7315e1b37ddc6119d48ae710460634d36958aaaa1119'],
  ['geomorphic', 52624835, '750c28a8b7ea2eff84b18d71a1b5ef80f1065c5b47fbbf98995cda47b691bd41'],
];
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
for (const [product, size, sha256] of assets) {
  const filename = `allen_coral_atlas_${product}.pmtiles`;
  const bytes = await readFile(`${root}/${filename}`);
  if (bytes.length !== size || createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('Local contract mismatch');
  const Key = `private-research/allen-coral-atlas/${sha256}/${filename}`;
  let exists = false;
  try { await client.send(new HeadObjectCommand({ Bucket, Key })); exists = true; }
  catch (error) { if (error.$metadata?.httpStatusCode !== 404) throw error; }
  if (!exists) await client.send(new PutObjectCommand({ Bucket, Key, Body: bytes, IfNoneMatch: '*', ...privateAcl, ServerSideEncryption: 'AES256', CacheControl: 'private, no-store', ContentType: 'application/vnd.pmtiles', ChecksumSHA256: Buffer.from(sha256, 'hex').toString('base64') }));
  const response = await client.send(new GetObjectCommand({ Bucket, Key, ChecksumMode: 'ENABLED' }));
  const downloaded = await response.Body.transformToByteArray();
  if (downloaded.length !== size || createHash('sha256').update(downloaded).digest('hex') !== sha256 || response.CacheControl !== 'private, no-store' || response.ServerSideEncryption !== 'AES256') throw new Error('Private readback mismatch');
  const anonymous = await fetch(`https://${Bucket}.s3.${region}.amazonaws.com/${Key}`, { method: 'HEAD' });
  if (anonymous.status !== 403) throw new Error('Anonymous object access was not denied');
  results.push({ product, key: Key, size, sha256, uploaded: !exists, readback: 'sha256+bytes match', anonymousStatus: anonymous.status, encryption: response.ServerSideEncryption, cacheControl: response.CacheControl });
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), bucket: Bucket, results }, null, 2));
