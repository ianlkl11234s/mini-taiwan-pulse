import type { ShipData } from "../types";
import { S3_BASE, SHIP_PREFIX } from "./s3Loader";

let cached: ShipData | null = null;

const S3_SHIP = `${S3_BASE}/${SHIP_PREFIX}`;

interface ShipManifest {
  lastUpdated: string;
  dates: { date: string; shipCount: number }[];
}

/** 從 S3 載入所有日期的 ship data 並合併 */
async function loadFromS3(): Promise<ShipData> {
  const manifestRes = await fetch(`${S3_SHIP}/manifest.json`);
  if (!manifestRes.ok) throw new Error("Ship S3 manifest not available");
  const manifest: ShipManifest = await manifestRes.json();

  if (manifest.dates.length === 0) throw new Error("Ship S3 manifest has no dates");

  const fetches = manifest.dates.map(async (d) => {
    const [y, m, dd] = d.date.split("-");
    const res = await fetch(`${S3_SHIP}/${y}/${m}/${dd}/data.json`);
    if (!res.ok) return null;
    return (await res.json()) as ShipData;
  });

  const results = await Promise.all(fetches);
  const valid = results.filter((r): r is ShipData => r !== null);

  if (valid.length === 0) throw new Error("No ship data from S3");
  if (valid.length === 1) return valid[0]!;

  // 多日資料合併
  const merged: ShipData = {
    metadata: valid[0]!.metadata,
    ships: valid.flatMap((d) => d.ships),
  };
  merged.metadata.ship_count = merged.ships.length;
  return merged;
}

export async function loadShips(): Promise<ShipData> {
  if (cached) return cached;

  // 1. 嘗試本地
  try {
    const res = await fetch("/ship_data.json");
    if (res.ok) {
      const text = await res.text();
      if (text.trimStart().startsWith("<")) throw new Error("Got HTML, not JSON");
      cached = JSON.parse(text);
      return cached!;
    }
  } catch {
    // fall through to S3
  }

  // 2. S3 fallback
  console.log("[Ship] Local file unavailable, loading from S3...");
  cached = await loadFromS3();
  return cached!;
}
