/**
 * 上傳 aviation_data.json 到 S3 flight-arc/ 資料夾
 *
 * 用法：
 *   npm run s3:upload
 *
 * 功能：
 *   1. 讀取本地 public/aviation_data.json
 *   2. 依日期分組航班
 *   3. 上傳每天的資料到 flight-arc/YYYY/MM/DD/data.json
 *   4. 產生並上傳 manifest.json（日期、機場、航班數）
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BUCKET = process.env.S3_BUCKET ?? "migu-gis-data-collector";
const REGION = process.env.S3_REGION ?? "ap-southeast-2";
const PREFIX = "flight-arc";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

interface Flight {
  fr24_id: string;
  origin_icao: string;
  dest_icao: string;
  dep_time: number;
  arr_time: number;
  path: number[][];
  [key: string]: unknown;
}

interface DayGroup {
  date: string;
  flights: Flight[];
  airports: Set<string>;
}

function getFlightDate(f: Flight): string {
  // 優先用 dep_time，fallback 到 path 首點
  const ts = f.dep_time > 0 ? f.dep_time : (f.path[0]?.[3] ?? 0);
  if (ts === 0) return "unknown";
  const d = new Date(ts * 1000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function groupByDate(flights: Flight[]): Map<string, DayGroup> {
  const groups = new Map<string, DayGroup>();
  for (const f of flights) {
    const date = getFlightDate(f);
    if (date === "unknown") continue;
    if (!groups.has(date)) {
      groups.set(date, { date, flights: [], airports: new Set() });
    }
    const g = groups.get(date)!;
    g.flights.push(f);
    if (f.origin_icao?.startsWith("RC")) g.airports.add(f.origin_icao);
    if (f.dest_icao?.startsWith("RC")) g.airports.add(f.dest_icao);
  }
  return groups;
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

async function main() {
  const dataPath = resolve(__dirname, "../public/aviation_data.json");
  console.log(`Reading ${dataPath}...`);
  const raw = readFileSync(dataPath, "utf-8");
  const flights: Flight[] = JSON.parse(raw);
  console.log(`Total flights: ${flights.length}`);

  const groups = groupByDate(flights);
  const dates = [...groups.keys()].sort();
  console.log(`Dates: ${dates.join(", ")}\n`);

  // 上傳每天的資料
  for (const date of dates) {
    const g = groups.get(date)!;
    const [y, m, d] = date.split("-");
    const key = `${PREFIX}/${y}/${m}/${d}/data.json`;
    const body = JSON.stringify(g.flights);
    console.log(`[${date}] ${g.flights.length} flights, airports: ${[...g.airports].sort().join(", ")}`);
    await upload(key, body);
  }

  // 產生 manifest
  const manifest = {
    lastUpdated: new Date().toISOString(),
    totalFlights: flights.length,
    dates: dates.map((date) => {
      const g = groups.get(date)!;
      return {
        date,
        flightCount: g.flights.length,
        airports: [...g.airports].sort(),
      };
    }),
  };
  await upload(`${PREFIX}/manifest.json`, JSON.stringify(manifest, null, 2));

  console.log("\nDone!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
