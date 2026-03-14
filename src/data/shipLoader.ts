import type { Ship, ShipData } from "../types";
import { S3_BASE, SHIP_PREFIX } from "./s3Loader";

// ── Pulse API ──

const API = "/api/v1";

/** 從 Pulse API 載入船舶資料（取最新一天） */
export async function loadShipsFromApi(): Promise<ShipData> {
  // 1. 取得可用日期
  const datesRes = await fetch(`${API}/ships/dates`);
  if (!datesRes.ok) throw new Error(`ships/dates: ${datesRes.status}`);
  const { dates } = await datesRes.json();
  if (!dates || dates.length === 0) throw new Error("No ship dates from API");

  // 取最後（最新）一天
  const latest = dates[dates.length - 1].date;

  // 2. 取該天資料
  const dayRes = await fetch(`${API}/ships/day?date=${latest}`);
  if (!dayRes.ok) throw new Error(`ships/day ${latest}: ${dayRes.status}`);
  const data = await dayRes.json();

  return {
    metadata: {
      date: data.date,
      ship_count: data.ship_count,
      time_range: data.time_range as [number, number],
    },
    ships: data.ships as Ship[],
  };
}

// ── Legacy loaders (fallback) ──

let legacyCached: ShipData | null = null;
const S3_SHIP = `${S3_BASE}/${SHIP_PREFIX}`;

interface ShipManifest {
  lastUpdated: string;
  dates: { date: string; shipCount: number }[];
}

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

  const merged: ShipData = {
    metadata: valid[0]!.metadata,
    ships: valid.flatMap((d) => d.ships),
  };
  merged.metadata.ship_count = merged.ships.length;
  return merged;
}

/** Legacy: 從本地檔案或 S3 載入（pulse-api 不可用時的 fallback） */
export async function loadShipsLegacy(): Promise<ShipData> {
  if (legacyCached) return legacyCached;

  try {
    const res = await fetch("/ship_data.json");
    if (res.ok) {
      const text = await res.text();
      if (text.trimStart().startsWith("<")) throw new Error("Got HTML, not JSON");
      legacyCached = JSON.parse(text);
      return legacyCached!;
    }
  } catch {
    // fall through to S3
  }

  console.log("[Ship] Local file unavailable, loading from S3...");
  legacyCached = await loadFromS3();
  return legacyCached!;
}
