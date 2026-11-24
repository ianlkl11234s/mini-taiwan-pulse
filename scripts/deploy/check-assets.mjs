#!/usr/bin/env node
/**
 * `npm run check:assets`（CI-4）：資產測試的前置與 R2 核對。計畫見 docs/features/public-assets-r2/PLAN.md。
 *
 * 預設：依 deploy/asset-test-files.txt 準備 public/ 資料檔，再跑資產測試（vitest.assets.config.ts）。
 *   本機已有且 sha256 與 lock 相符 → 沿用；本機檔與 lock 不符 → 失敗（lock 過期或檔案被改）。
 *   本機沒有 → delivery=r2 的從 R2 下載到 .asset-cache/<sha256>（CI 以 actions/cache 保留），比對 sha256 後複製到 public/；
 *   其他 delivery（s3／pending／git／undecided）不在 R2：明確列出，交給測試的 assetAvailable() 印出略過。
 *   R2 回 404 且基準 lock（--base，預設 origin/master）沒有這個路徑 = 還沒發版的新檔 → 改從 S3 deploy-assets/ 下載，
 *   一樣比對 sha256 與 bytes（CI-10，決策邏輯在 asset-source.mjs）。S3 取回的檔放暫存目錄，不進 .asset-cache
 *   （actions/cache 在公開 repo 可被 fork PR 還原，未發版的檔不能進快取），也不寫回 R2。
 *   S3 金鑰讀 S3_ACCESS_KEY／S3_SECRET_KEY／S3_BUCKET／S3_REGION；沒有就照舊紅燈並說明原因。
 *   之後的參數原樣交給 vitest（例如 --maxWorkers=2）。
 * --download-only：只準備檔案，不跑測試。
 * --verify-only [--paths <清單檔>] [--out <tsv>]：不寫 public/，從 R2 整檔下載、比對 bytes 與 sha256。
 *   預設核對 lock 裡全部 delivery=r2 的條目；--paths 指定清單（每行一個 public/ 路徑，# 開頭為註解）。
 *   移出 git 前的關卡（PLAN.md 每批固定步驟第 4 步）。
 */
import { createHash } from "node:crypto";
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { memoBaseLock, resolveAsset } from "./asset-source.mjs";

const LOCK = JSON.parse(readFileSync("deploy/public-assets.lock.json", "utf8"));
const BY_PATH = new Map(LOCK.entries.map((e) => [e.path, e]));
const CACHE = ".asset-cache";
// S3 備援取回的檔（未發版）只放這裡，不放 CACHE
const S3_TMP = join(process.env.RUNNER_TEMP || tmpdir(), "pulse-check-assets-s3");
const CONCURRENCY = 6;
// R2 公開網域會擋部分自動化 User-Agent（Python urllib 回 403）
const HEADERS = { "User-Agent": "curl/8.7.1 (pulse check-assets)" };

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const option = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};

const readList = (file) =>
  readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

function sha256File(path) {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    let bytes = 0;
    createReadStream(path)
      .on("data", (c) => { h.update(c); bytes += c.length; })
      .on("error", reject)
      .on("end", () => resolve({ sha256: h.digest("hex"), bytes }));
  });
}

const urlOf = (e) => LOCK.r2_base + e.path.slice("public/".length).split("/").map(encodeURIComponent).join("/");

/** 下載整檔並計算 sha256；連線中斷時重試 3 次（R2 大檔偶爾 terminated）。 */
async function download(e, dest, once = downloadOnce) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await once(e, dest);
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

/** 下載整檔並計算 sha256；dest 有給就寫檔（先寫暫存再改名）。 */
async function downloadOnce(e, dest) {
  const res = await fetch(urlOf(e), { headers: HEADERS });
  if (!res.ok || !res.body) return { status: res.status, error: `HTTP ${res.status}` };
  return { status: 200, ...(await hashBody(res.body, e, dest)) };
}

/** 串流算 sha256；dest 有給且與 lock 相符才寫檔（先寫暫存再改名）。 */
async function hashBody(body, e, dest) {
  const h = createHash("sha256");
  let bytes = 0;
  const chunks = dest ? [] : null;
  for await (const c of body) {
    h.update(c);
    bytes += c.length;
    chunks?.push(c);
  }
  const sha256 = h.digest("hex");
  if (dest && sha256 === e.sha256 && bytes === e.bytes) {
    mkdirSync(dirname(dest), { recursive: true });
    const tmp = `${dest}.part`;
    writeFileSync(tmp, Buffer.concat(chunks));
    renameSync(tmp, dest);
  }
  return { sha256, bytes };
}

const s3Env = () => ({
  accessKeyId: process.env.S3_ACCESS_KEY || "",
  secretAccessKey: process.env.S3_SECRET_KEY || "",
  bucket: process.env.S3_BUCKET || "",
  region: process.env.S3_REGION || "",
});
// GitHub Actions 缺 secret 時是空字串，不是 undefined
const s3Configured = () => { const c = s3Env(); return Boolean(c.accessKeyId && c.secretAccessKey && c.bucket); };
let s3Client;

/** 從 S3 deploy-assets/<s3_key> 取檔；404 NoSuchKey 與 403（只有 GetObject 權限時，缺檔也回 403）都回 status。 */
async function downloadS3Once(e, dest) {
  const c = s3Env();
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  s3Client ??= new S3Client({ region: c.region || "us-east-1", followRegionRedirects: true, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } });
  let res;
  try {
    res = await s3Client.send(new GetObjectCommand({ Bucket: c.bucket, Key: e.s3_key }));
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode;
    if (status === 404 || status === 403) return { status, error: err.name };
    throw err;
  }
  return { status: 200, ...(await hashBody(res.Body, e, dest)) };
}

/** 基準 lock（PR：origin/master；master push：上一個 master）的路徑清單。讀不到就丟錯，由 resolveAsset 轉成紅燈。 */
function readBaseLockPaths(ref) {
  const text = execFileSync("git", ["show", `${ref}:deploy/public-assets.lock.json`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(text).entries.map((x) => x.path);
}

async function pool(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

async function verifyOnly() {
  const pathsFile = option("--paths");
  const out = option("--out");
  const entries = pathsFile
    ? readList(pathsFile).map((p) => BY_PATH.get(p) ?? { path: p, missingInLock: true })
    : LOCK.entries.filter((e) => e.delivery === "r2");
  let done = 0;
  const results = await pool(entries, async (e) => {
    let status;
    if (e.missingInLock) status = "NOT_IN_LOCK";
    else {
      try {
        const r = await download(e, null);
        status = r.error ?? (r.sha256 === e.sha256 && r.bytes === e.bytes ? "SAME" : `DIFF(bytes ${r.bytes} vs ${e.bytes})`);
      } catch (err) {
        status = `ERR ${err.message}`;
      }
    }
    if (++done % 50 === 0) console.error(`… ${done}/${entries.length}`);
    return [e.path, status];
  });
  const counts = {};
  for (const [, s] of results) counts[s.split("(")[0]] = (counts[s.split("(")[0]] ?? 0) + 1;
  if (out) writeFileSync(out, results.map((r) => r.join("\t")).join("\n") + "\n");
  console.log(`R2 整檔核對 ${results.length} 筆：`, counts);
  const bad = results.filter(([, s]) => s !== "SAME");
  for (const [p, s] of bad) console.log(`  ✗ ${p}\t${s}`);
  return bad.length ? 1 : 0;
}

async function prepare() {
  const wanted = readList("deploy/asset-test-files.txt");
  const notInLock = wanted.filter((p) => !BY_PATH.has(p));
  if (notInLock.length) {
    console.error(`deploy/asset-test-files.txt 有 lock 沒有的路徑：\n  ${notInLock.join("\n  ")}`);
    return 1;
  }
  mkdirSync(CACHE, { recursive: true });
  const baseRef = option("--base") || process.env.ASSET_BASE_REF || "origin/master";
  const inBaseLock = memoBaseLock(() => readBaseLockPaths(baseRef));
  const hasS3 = s3Configured();
  console.log(`S3 備援金鑰：${hasS3 ? "有" : "沒有（R2 缺的新檔會紅燈）"}；新檔判斷基準：${baseRef}`);
  const stats = { local: 0, cache: 0, downloaded: 0, s3: 0 };
  const fromS3 = [];
  const unavailable = [];
  const failures = [];
  await pool(wanted.map((p) => BY_PATH.get(p)), async (e) => {
    if (existsSync(e.path)) {
      const r = await sha256File(e.path);
      if (r.sha256 === e.sha256 && r.bytes === e.bytes) { stats.local++; return; }
      failures.push(`${e.path}：本機檔與 lock 不符（bytes ${r.bytes} vs ${e.bytes}）；資料改了要重跑 python3 scripts/deploy/build-public-assets-lock.py`);
      return;
    }
    if (e.delivery !== "r2") { unavailable.push(`${e.path}（delivery=${e.delivery}）`); return; }
    const cached = join(CACHE, e.sha256);
    if (existsSync(cached) && (await sha256File(cached)).sha256 === e.sha256) {
      mkdirSync(dirname(e.path), { recursive: true });
      copyFileSync(cached, e.path);
      stats.cache++;
      return;
    }
    rmSync(cached, { force: true });
    const s3Dest = join(S3_TMP, e.sha256);
    try {
      const r = await resolveAsset(e, {
        fetchR2: (x) => download(x, cached),
        inBaseLock,
        s3Configured: hasS3,
        fetchS3: (x) => download(x, s3Dest, downloadS3Once),
        baseLabel: baseRef,
      });
      if (!r.ok) { failures.push(`${e.path}：${r.reason}`); return; }
      mkdirSync(dirname(e.path), { recursive: true });
      if (r.source === "s3") {
        copyFileSync(s3Dest, e.path);
        stats.s3++;
        fromS3.push(e.path);
      } else {
        copyFileSync(cached, e.path);
        stats.downloaded++;
      }
    } catch (err) {
      failures.push(`${e.path}：下載失敗 ${err.message}`);
    }
  });
  console.log(`資產檔 ${wanted.length} 個：本機相符 ${stats.local}、快取 ${stats.cache}、從 R2 下載 ${stats.downloaded}、從 S3 備援 ${stats.s3}`);
  if (fromS3.length) console.log(`ℹ 還沒發版、R2 尚無，改從 S3 取並核對 sha256：\n  ${fromS3.join("\n  ")}`);
  if (unavailable.length) {
    console.log(`⚠ 不在 R2、本機也沒有（相關測試會印出略過，需本機或 S3 取得）${unavailable.length} 個：\n  ${unavailable.join("\n  ")}`);
  }
  if (failures.length) {
    console.error(`✗ ${failures.length} 個檔有問題：\n  ${failures.join("\n  ")}`);
    return 1;
  }
  return 0;
}

async function main() {
  if (flag("--verify-only")) return verifyOnly();
  const downloadOnly = flag("--download-only");
  const code = await prepare();
  if (code || downloadOnly) return code;
  const r = spawnSync("npx", ["vitest", "run", "-c", "vitest.assets.config.ts", ...args], { stdio: "inherit" });
  return r.status ?? 1;
}

process.exit(await main());
