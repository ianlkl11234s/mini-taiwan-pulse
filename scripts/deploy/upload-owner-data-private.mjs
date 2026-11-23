/**
 * Explicit private publication only: never part of build or public asset sync.
 * 站主限定靜態資料通用家族 owner-data（2026-11-08 起取代 Supabase owner-only RPC 的靜態圖層）：
 * 只上傳到私有 bucket，僅站主經 coral-private sidecar 可讀；不屬於 build、公開資產同步或 CDN upload。
 * 內容定址（<prefix>/<sha256>/<filename>），已存在就不重傳；舊版本留在 bucket 供回滾。本腳本不刪任何物件。
 *
 * 用法：set -a; . .env; set +a; node scripts/deploy/upload-owner-data-private.mjs <repo>/owner-data.local
 * 2026-11-23 起只有「bucket 裡還沒有」的資產才需要本機檔：每項先 HeadObject，已存在＝present（只核對大小）；
 * 不存在才要求資料夾裡有該檔、local_validation.json（{assets:{<filename>:{size,sha256}}}）有該列，
 * 且本機 bytes 的 size／sha256 與 OWNER_DATA_ASSETS 一致，才上傳。不存在又沒有本機檔＝missing，非 0 結束。
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { S3Client, GetBucketPolicyCommand, GetBucketOwnershipControlsCommand, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { OWNER_DATA_ASSETS } from '../../server/coral-private/owner-data-assets.mjs';

const Bucket = 'migu-private-research-ap-southeast-2';
const region = 'ap-southeast-2';
const prefix = 'private-research/owner-data';

export const ownerDataKey = (asset) => `${prefix}/${asset.sha256}/${asset.filename}`;

/**
 * 純函式：決定每項資產怎麼處理。
 * @param assets  [{ product, filename, size, sha256 }]
 * @param existing  Map<key, ContentLength>：bucket 裡已存在的 key（HeadObject 結果）
 * @param validation  local_validation.json 內容（可為 null＝沒有這個檔）
 * @param local  Map<filename, { size, sha256 }>：本機實際檔案的大小與雜湊（沒有檔就不在 Map 裡）
 * @returns { present, upload, missing, errors }；errors 非空就不可上傳任何東西
 */
export function planOwnerDataUpload(assets, existing, validation, local) {
  const present = [], upload = [], missing = [], errors = [];
  for (const a of assets) {
    if (!a.size || !/^[0-9a-f]{64}$/.test(a.sha256)) { errors.push(`${a.filename}: OWNER_DATA_ASSETS is invalid`); continue; }
    const key = ownerDataKey(a);
    if (existing.has(key)) {
      if (existing.get(key) !== a.size) errors.push(`${a.filename}: bucket object size ${existing.get(key)} != ${a.size}`);
      else present.push(a);
      continue;
    }
    const file = local.get(a.filename);
    if (!file) { missing.push(a); continue; }
    const recorded = validation?.assets?.[a.filename];
    if (!recorded || recorded.size !== a.size || recorded.sha256 !== a.sha256) { errors.push(`${a.filename}: local_validation.json does not match OWNER_DATA_ASSETS`); continue; }
    if (file.size !== a.size || file.sha256 !== a.sha256) { errors.push(`${a.filename}: local file does not match OWNER_DATA_ASSETS`); continue; }
    upload.push(a);
  }
  return { present, upload, missing, errors };
}

async function main() {
  const root = process.argv[2];
  if (!root) throw new Error('Pass the verified local owner data directory (owner-data.local)');
  const client = new S3Client({ region, credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY } });

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

  // Single source of truth: OWNER_DATA_ASSETS in the sidecar.
  const assets = Object.entries(OWNER_DATA_ASSETS).map(([product, a]) => ({ product, filename: a.filename, size: a.size, sha256: a.sha256 }));
  const existing = new Map();
  for (const a of assets) {
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket, Key: ownerDataKey(a) }));
      existing.set(ownerDataKey(a), head.ContentLength);
    } catch (error) { if (error.$metadata?.httpStatusCode !== 404) throw error; }
  }
  let validation = null;
  try { validation = JSON.parse(await readFile(`${root}/local_validation.json`, 'utf8')); }
  catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const local = new Map();
  const bytesOf = new Map();
  for (const a of assets) {
    if (existing.has(ownerDataKey(a))) continue;
    let bytes;
    try { bytes = await readFile(`${root}/${a.filename}`); }
    catch (error) { if (error?.code === 'ENOENT') continue; throw error; }
    bytesOf.set(a.filename, bytes);
    local.set(a.filename, { size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }

  const plan = planOwnerDataUpload(assets, existing, validation, local);
  if (plan.errors.length) throw new Error(`Owner data contract mismatch; nothing uploaded:\n${plan.errors.join('\n')}`);

  const uploaded = [];
  for (const a of plan.upload) {
    const Key = ownerDataKey(a);
    const bytes = bytesOf.get(a.filename);
    await client.send(new PutObjectCommand({ Bucket, Key, Body: bytes, IfNoneMatch: '*', ...privateAcl, ServerSideEncryption: 'AES256', CacheControl: 'private, no-store', ContentType: a.filename.endsWith('.geojson') ? 'application/geo+json' : a.filename.endsWith('.pmtiles') ? 'application/vnd.pmtiles' : 'application/json', ChecksumSHA256: Buffer.from(a.sha256, 'hex').toString('base64') }));
    const response = await client.send(new GetObjectCommand({ Bucket, Key, ChecksumMode: 'ENABLED' }));
    const downloaded = await response.Body.transformToByteArray();
    if (downloaded.length !== a.size || createHash('sha256').update(downloaded).digest('hex') !== a.sha256 || response.CacheControl !== 'private, no-store' || response.ServerSideEncryption !== 'AES256') throw new Error('Private readback mismatch');
    const head = await client.send(new HeadObjectCommand({ Bucket, Key }));
    if (head.ContentLength !== a.size) throw new Error('HeadObject size mismatch');
    const anonymous = await fetch(`https://${Bucket}.s3.${region}.amazonaws.com/${Key}`, { method: 'HEAD' });
    if (anonymous.status !== 403) throw new Error('Anonymous object access was not denied');
    uploaded.push({ product: a.product, key: Key, size: a.size, sha256: a.sha256, readback: 'sha256+bytes match', anonymousStatus: anonymous.status, encryption: response.ServerSideEncryption, cacheControl: response.CacheControl });
  }

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(), bucket: Bucket,
    present: plan.present.map((a) => a.product),
    uploaded,
    missing: plan.missing.map((a) => a.product),
  }, null, 2));
  if (plan.missing.length) {
    console.error(`missing ${plan.missing.length} asset(s): not in bucket and no local file`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
