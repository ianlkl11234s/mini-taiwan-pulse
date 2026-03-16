import { tableFromIPC } from "apache-arrow";
import type { Ship, ShipData } from "../types";
import { S3_BASE, SHIP_PREFIX } from "./s3Loader";

// ── Pulse API ──

const API = "/api/v1";

interface ShipDateInfo {
  date: string;
  frames: number;
  records: number;
}

/** 取得所有有船舶資料的日期（輕量） */
export async function fetchShipDates(): Promise<ShipDateInfo[]> {
  const res = await fetch(`${API}/ships/dates`);
  if (!res.ok) throw new Error(`ships/dates: ${res.status}`);
  const data = await res.json();
  return data.dates as ShipDateInfo[];
}

/** 從 Arrow IPC 載入單日船舶資料 */
export async function fetchShipDayArrow(date: string): Promise<ShipData> {
  const res = await fetch(`${API}/ships/day?date=${date}&format=arrow`);
  if (!res.ok) throw new Error(`ships/day ${date}: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const table = tableFromIPC(new Uint8Array(buffer));

  // flat table → grouped by mmsi
  const shipMap = new Map<number, Ship>();
  const mmsiCol = table.getChild("mmsi")!;
  const latCol = table.getChild("lat")!;
  const lonCol = table.getChild("lon")!;
  const vtypeCol = table.getChild("vtype")!;
  const tsCol = table.getChild("ts_unix")!;

  let tsMin = Infinity;
  let tsMax = -Infinity;

  for (let i = 0; i < table.numRows; i++) {
    const mmsi = mmsiCol.get(i) as number;
    const lat = latCol.get(i) as number;
    const lon = lonCol.get(i) as number;
    const vtype = vtypeCol.get(i) as number;
    const ts = Number(tsCol.get(i));

    if (ts < tsMin) tsMin = ts;
    if (ts > tsMax) tsMax = ts;

    let ship = shipMap.get(mmsi);
    if (!ship) {
      ship = {
        mmsi: String(mmsi),
        vessel_type: vtype,
        path: [],
      };
      shipMap.set(mmsi, ship);
    }
    ship.path.push([lat, lon, 0, ts]);
  }

  const ships = Array.from(shipMap.values());

  // DEBUG: 比較 Arrow 解析結果與預期格式
  if (ships.length > 0) {
    const sample = ships[0]!;
    console.log("[Ship/Arrow] sample ship:", {
      mmsi: sample.mmsi,
      vessel_type: sample.vessel_type,
      pathLen: sample.path.length,
      firstPoint: sample.path[0],
      lastPoint: sample.path[sample.path.length - 1],
    });
    console.log("[Ship/Arrow] timeRange:", { tsMin, tsMax, date });
  }

  return {
    metadata: {
      date,
      ship_count: ships.length,
      time_range: [
        tsMin === Infinity ? 0 : tsMin,
        tsMax === -Infinity ? 0 : tsMax,
      ] as [number, number],
    },
    ships,
  };
}

/** 從 API 載入最新一天（初始載入用） */
export async function loadShipsFromApi(): Promise<ShipData> {
  const dates = await fetchShipDates();
  if (!dates || dates.length === 0) throw new Error("No ship dates from API");
  const latest = dates[dates.length - 1]!.date;
  return fetchShipDayArrow(latest);
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

/** Legacy: 從本地檔案或 S3 載入 */
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
