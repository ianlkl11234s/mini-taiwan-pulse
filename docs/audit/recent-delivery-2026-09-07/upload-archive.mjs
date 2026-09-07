// Exact-manifest archival only. No sync/delete, no deploy-assets, no public ACLs.
import {createReadStream} from 'node:fs';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadEnv} from 'vite';
import {S3Client,HeadObjectCommand,PutObjectCommand,GetBucketPolicyCommand} from '@aws-sdk/client-s3';

const PLAN_HASH='e0ab1ca85c2d9f1869c047ace912d2f988adb8cb213b9f6dab5e8573fcfea4f4';
const planPath=new URL('./archive-plan.json',import.meta.url);
const receiptPath='/tmp/mtp-archive-receipt.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fileSha(path){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
const rawPlan=await readFile(planPath);
if(sha(rawPlan)!==PLAN_HASH)throw new Error('Approved manifest hash changed');
const plan=JSON.parse(rawPlan);
const unique=new Map();
for(const item of plan.files){
 const expected=`archives/${item.project}/sha256/${item.sha256}/${item.path.split('/').at(-1)}`;
 if(!/^[a-f0-9]{64}$/.test(item.sha256)||item.proposed_key!==expected||!['mini-taiwan-pulse','taipei-gis-analytics'].includes(item.project))throw new Error('Invalid archive destination');
 const prev=unique.get(item.proposed_key);
 if(prev&&(prev.sha256!==item.sha256||prev.bytes!==item.bytes))throw new Error('Conflicting archive key');
 unique.set(item.proposed_key,item);
 const info=await stat(item.local_path);
 if(!info.isFile()||info.size!==item.bytes||await fileSha(item.local_path)!==item.sha256)throw new Error(`Local content changed: ${item.project}/${item.path}`);
}
if(plan.files.length!==plan.file_count||plan.files.reduce((n,f)=>n+f.bytes,0)!==plan.bytes)throw new Error('Manifest totals changed');
console.log(JSON.stringify({phase:'preflight',files:plan.file_count,objects:unique.size,bytes:plan.bytes,manifestSha256:PLAN_HASH}));
if(!process.argv.includes('--upload'))process.exit(0);
const env=loadEnv('production','/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse','');
if(!env.S3_BUCKET||!env.S3_ACCESS_KEY||!env.S3_SECRET_KEY)throw new Error('S3 configuration missing');
const Bucket=env.S3_BUCKET;
if(Bucket!=='migu-gis-data-collector'||(env.S3_REGION||'ap-southeast-2')!=='ap-southeast-2')throw new Error('Archive destination differs from reviewed bucket/region');
const client=new S3Client({region:env.S3_REGION||'ap-southeast-2',credentials:{accessKeyId:env.S3_ACCESS_KEY,secretAccessKey:env.S3_SECRET_KEY},maxAttempts:1,requestHandler:{connectionTimeout:15000,requestTimeout:600000}});
// The inspected bucket publishes flight-arc only. Stop if that policy has changed.
const policy=JSON.parse((await client.send(new GetBucketPolicyCommand({Bucket}))).Policy||'{}');
for(const s of policy.Statement||[]){
 if(s.Effect!=='Allow')continue;
 const principals=JSON.stringify(s.Principal);
 if(!principals.includes('*'))continue;
 const resources=Array.isArray(s.Resource)?s.Resource:[s.Resource];
 if(resources.some(r=>r!==`arn:aws:s3:::${Bucket}/flight-arc/*`))throw new Error('Bucket public policy requires renewed archive review');
}
const receipt={status:'UPLOADING',startedAt:new Date().toISOString(),bucket:Bucket,manifestSha256:PLAN_HASH,files:plan.file_count,objects:unique.size,logicalBytes:plan.bytes,verified:[],failures:[]};
let checkpointPending=Promise.resolve();
const checkpoint=()=>{const snapshot=JSON.stringify(receipt,null,2)+'\n';checkpointPending=checkpointPending.then(()=>writeFile(receiptPath,snapshot));return checkpointPending;};
async function head(Key,bytes,checksum){
 try{const r=await client.send(new HeadObjectCommand({Bucket,Key,ChecksumMode:'ENABLED'}));if(r.ContentLength!==bytes||r.ChecksumSHA256!==checksum)throw new Error(`Existing object verification mismatch: ${Key}`);return r;}catch(e){if(e.$metadata?.httpStatusCode===404)return null;throw e;}
}
async function putVerified(Key,bytes,hash,body){
 const checksum=Buffer.from(hash,'hex').toString('base64');
 let existing=await head(Key,bytes,checksum);
 if(!existing){
  try{await client.send(new PutObjectCommand({Bucket,Key,Body:body(),ContentLength:bytes,ChecksumSHA256:checksum,IfNoneMatch:'*',ServerSideEncryption:'AES256',Metadata:{sha256:hash},ContentType:'application/octet-stream'}));}
  catch(e){if(e.$metadata?.httpStatusCode!==412)throw e;}
  existing=await head(Key,bytes,checksum);
  if(!existing)throw new Error('Uploaded object is missing');
 }
 return {bytes:existing.ContentLength,checksumSHA256:existing.ChecksumSHA256,encryption:existing.ServerSideEncryption};
}
const queue=[...unique.values()];let completed=0;
async function worker(){while(queue.length){const item=queue.shift();let lastError;for(let attempt=0;attempt<3;attempt++){
 try{const verified=await putVerified(item.proposed_key,item.bytes,item.sha256,()=>createReadStream(item.local_path));receipt.verified.push({key:item.proposed_key,sha256:item.sha256,...verified});lastError=null;break;}
 catch(e){lastError={key:item.proposed_key,error:e.name,status:e.$metadata?.httpStatusCode,message:String(e.message).slice(0,180)};if(e.$metadata?.httpStatusCode===403||String(e.message).includes('mismatch'))break;}
 }
 if(lastError)receipt.failures.push(lastError);
 completed++;if(completed%20===0||!queue.length){await checkpoint();console.log(JSON.stringify({phase:'upload',completed,total:unique.size,verified:receipt.verified.length,failed:receipt.failures.length}));}
}}
await Promise.all([worker(),worker(),worker()]);
if(receipt.failures.length){receipt.status='PARTIAL';await checkpoint();process.exitCode=1;}
else{
 const Key=`archives/manifests/sha256/${PLAN_HASH}.json`;
 receipt.remoteManifest={key:Key,...await putVerified(Key,rawPlan.length,PLAN_HASH,()=>rawPlan)};
 receipt.status='VERIFIED';receipt.completedAt=new Date().toISOString();await checkpoint();console.log(JSON.stringify({phase:'complete',status:receipt.status,objects:receipt.verified.length,manifest:Key}));
}
