import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadEnv} from 'vite';
import {S3Client,GetObjectCommand,GetObjectAclCommand,GetPublicAccessBlockCommand,GetBucketPolicyCommand} from '@aws-sdk/client-s3';
const base=new URL('./',import.meta.url);
const rawPlan=await readFile(new URL('archive-plan.json',base));
const planHash=createHash('sha256').update(rawPlan).digest('hex');
assert.equal(planHash,'e0ab1ca85c2d9f1869c047ace912d2f988adb8cb213b9f6dab5e8573fcfea4f4');
const plan=JSON.parse(rawPlan);
const receipt=JSON.parse(await readFile('/tmp/mtp-archive-receipt.json'));
assert.equal(receipt.manifestSha256,planHash);
assert.equal(receipt.remoteManifest.key,`archives/manifests/sha256/${planHash}.json`);
assert.equal(receipt.files,plan.files.length);assert.equal(receipt.logicalBytes,plan.files.reduce((n,f)=>n+f.bytes,0));
assert.equal(receipt.status,'VERIFIED');assert.equal(receipt.failures.length,0);
const expected=new Map(plan.files.map(f=>[f.proposed_key,f]));
assert.equal(receipt.verified.length,expected.size);assert.equal(receipt.objects,expected.size);
const seen=new Set();
for(const row of receipt.verified){assert(!seen.has(row.key));seen.add(row.key);const f=expected.get(row.key);assert(f);assert.equal(row.sha256,f.sha256);assert.equal(row.bytes,f.bytes);assert.equal(row.checksumSHA256,Buffer.from(f.sha256,'hex').toString('base64'));assert.equal(row.encryption,'AES256');}
const env=loadEnv('production','/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse','');
assert.equal(env.S3_BUCKET,'migu-gis-data-collector');
const Bucket=env.S3_BUCKET;
const client=new S3Client({region:'ap-southeast-2',credentials:{accessKeyId:env.S3_ACCESS_KEY,secretAccessKey:env.S3_SECRET_KEY}});
const publicAccess=(await client.send(new GetPublicAccessBlockCommand({Bucket}))).PublicAccessBlockConfiguration;
assert.equal(publicAccess.IgnorePublicAcls,true);assert.equal(publicAccess.BlockPublicAcls,true);
const policy=JSON.parse((await client.send(new GetBucketPolicyCommand({Bucket}))).Policy);
for(const s of policy.Statement||[]){if(s.Effect!=='Allow'||!JSON.stringify(s.Principal).includes('*'))continue;const resources=Array.isArray(s.Resource)?s.Resource:[s.Resource];assert(resources.every(r=>r===`arn:aws:s3:::${Bucket}/flight-arc/*`));}
const remote=await client.send(new GetObjectCommand({Bucket,Key:receipt.remoteManifest.key}));
const digest=createHash('sha256').update(await remote.Body.transformToByteArray()).digest('hex');
assert.equal(digest,receipt.manifestSha256);
const samples=[receipt.remoteManifest.key,...['mini-taiwan-pulse','taipei-gis-analytics'].map(p=>receipt.verified.find(r=>r.key.startsWith(`archives/${p}/`)).key)];
const privateChecks=[];
for(const Key of samples){const acl=await client.send(new GetObjectAclCommand({Bucket,Key}));assert(!(acl.Grants||[]).some(g=>g.Grantee?.URI));const url=`https://${Bucket}.s3.ap-southeast-2.amazonaws.com/${Key.split('/').map(encodeURIComponent).join('/')}`;const res=await fetch(url,{method:'HEAD'});assert.equal(res.status,403);privateChecks.push({key:Key,anonymousHeadStatus:res.status,groupAclGrants:0});}
receipt.independentVerification={checkedAt:new Date().toISOString(),uniqueBytes:receipt.verified.reduce((n,r)=>n+r.bytes,0),manifestGetSha256:digest,publicAccessBlock:publicAccess,bucketPolicy:policy,privateChecks};
await writeFile(new URL('archive-upload-receipt.json',base),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:receipt.status,files:plan.files.length,objects:expected.size,uniqueBytes:receipt.independentVerification.uniqueBytes,privateChecks:privateChecks.length}));
