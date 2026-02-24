/**
 * 上傳 ship_data.json 到 S3 ship-data/ 資料夾
 *
 * 用法：
 *   npm run s3:upload:ships
 *
 * 功能：
 *   1. 讀取本地 public/ship_data.json
 *   2. 上傳整包到 ship-data/YYYY/MM/DD/data.json（以 metadata.date 為路徑）
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
const PREFIX = "ship-data";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

interface ShipData {
  metadata: { date: string; ship_count: number; time_range: [number, number] };
  ships: unknown[];
}

interface ManifestDate {
  date: string;
  shipCount: number;
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

/**
 * 從 metadata.date 解析日期。
 * 格式可能為 "2026-02-18" 或 "2026-02-18 ~ 2026-02-19"，取首日。
 */
function parseDate(dateStr: string): string {
  return dateStr.split("~")[0]!.trim();
}

async function main() {
  const dataPath = resolve(__dirname, "../public/ship_data.json");
  console.log(`Reading ${dataPath}...`);
  const raw = readFileSync(dataPath, "utf-8");
  const data: ShipData = JSON.parse(raw);
  console.log(`Total ships: ${data.ships.length}`);

  const date = parseDate(data.metadata.date);
  const [y, m, d] = date.split("-");
  const key = `${PREFIX}/${y}/${m}/${d}/data.json`;

  console.log(`\n[${date}] ${data.ships.length} ships`);
  await upload(key, raw);

  // 合併既有 manifest
  const existing = await getExistingManifest();
  const existingDates = existing?.dates ?? [];
  const dateSet = new Map(existingDates.map((d) => [d.date, d]));
  dateSet.set(date, { date, shipCount: data.ships.length });

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
