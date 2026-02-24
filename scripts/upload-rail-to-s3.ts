/**
 * 上傳 rail_bundle.json 到 S3 rail-data/ 資料夾
 *
 * 用法：
 *   npm run s3:upload:rail
 *
 * 前置：
 *   python3 scripts/bundle-rail-data.py  → 產出 public/rail_bundle.json
 *
 * 功能：
 *   1. 讀取本地 public/rail_bundle.json
 *   2. 上傳到 rail-data/YYYY/MM/DD/bundle.json
 *   3. 產生並上傳 manifest.json
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BUCKET = process.env.S3_BUCKET ?? "migu-gis-data-collector";
const REGION = process.env.S3_REGION ?? "ap-southeast-2";
const PREFIX = "rail-data";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

interface RailBundle {
  metadata: {
    date: string;
    systems: string[];
  };
  systems: Record<string, unknown>;
}

interface ManifestDate {
  date: string;
  systems: string[];
}

interface Manifest {
  lastUpdated: string;
  dates: ManifestDate[];
}

async function upload(key: string, body: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/json",
    }),
  );
  console.log(`  ✓ s3://${BUCKET}/${key} (${(body.length / 1024).toFixed(0)} KB)`);
}

async function getExistingManifest(): Promise<Manifest | null> {
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: `${PREFIX}/manifest.json` }),
    );
    const text = await res.Body!.transformToString();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function main() {
  const dataPath = resolve(__dirname, "../public/rail_bundle.json");
  console.log(`Reading ${dataPath}...`);
  const raw = readFileSync(dataPath, "utf-8");
  const bundle: RailBundle = JSON.parse(raw);

  const date = bundle.metadata.date;
  const systems = bundle.metadata.systems;
  const [y, m, d] = date.split("-");
  const key = `${PREFIX}/${y}/${m}/${d}/bundle.json`;

  console.log(`\n[${date}] systems: ${systems.join(", ")}`);
  await upload(key, raw);

  // 合併既有 manifest
  const existing = await getExistingManifest();
  const existingDates = existing?.dates ?? [];
  const dateSet = new Map(existingDates.map((d) => [d.date, d]));
  dateSet.set(date, { date, systems });

  const manifest: Manifest = {
    lastUpdated: new Date().toISOString(),
    dates: [...dateSet.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
  await upload(`${PREFIX}/manifest.json`, JSON.stringify(manifest, null, 2));

  console.log("\nDone!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
