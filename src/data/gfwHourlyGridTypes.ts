export interface GfwHourlyGridVessel {
  vesselId: string;
  mmsi: string | null;
  shipName: string | null;
  vesselType: string | null;
  flag: string | null;
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value : undefined;
}

export function parseGfwHourlyGridVessels(raw: unknown): GfwHourlyGridVessel[] | null {
  let decoded: unknown = raw;
  if (typeof raw === "string") {
    try { decoded = JSON.parse(raw); } catch { return null; }
  }
  if (!Array.isArray(decoded)) return null;
  const vessels: GfwHourlyGridVessel[] = [];
  for (const item of decoded) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
    const o = item as Record<string, unknown>;
    const vesselId = optionalString(o.vessel_id);
    const mmsi = optionalString(o.mmsi);
    const shipName = optionalString(o.ship_name);
    const vesselType = optionalString(o.vessel_type);
    const flag = optionalString(o.flag);
    if (!vesselId || mmsi === undefined || shipName === undefined || vesselType === undefined || flag === undefined) return null;
    vessels.push({ vesselId, mmsi, shipName, vesselType, flag });
  }
  return vessels;
}
