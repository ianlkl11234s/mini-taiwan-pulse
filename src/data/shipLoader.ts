import type { ShipData } from "../types";

let cached: ShipData | null = null;

export async function loadShips(): Promise<ShipData> {
  if (cached) return cached;

  const res = await fetch("/ship_data.json");
  if (!res.ok) throw new Error(`Failed to load ship data: ${res.status}`);
  cached = await res.json();
  return cached!;
}
