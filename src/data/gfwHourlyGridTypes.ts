export interface GfwHourlyGridVessel {
  vesselId: string;
  mmsi: string | null;
  shipName: string | null;
  vesselType: string | null;
  flag: string | null;
  /** v4 full-member fields. Undefined means the legacy v2/v3 five-field contract. */
  imo?: string | null;
  callsign?: string | null;
  dataset?: string | null;
  geartype?: string | null;
  firstTransmissionDate?: string | null;
  lastTransmissionDate?: string | null;
  hours?: number;
  entryTimestamp?: string;
  exitTimestamp?: string;
}

/** Popup-facing wire contract: the parser intentionally accepts producer-style snake_case only. */
export function serializeGfwHourlyGridVessels(vessels: readonly GfwHourlyGridVessel[]): string {
  return JSON.stringify(vessels.map((vessel) => ({
    vessel_id: vessel.vesselId,
    mmsi: vessel.mmsi,
    ship_name: vessel.shipName,
    vessel_type: vessel.vesselType,
    flag: vessel.flag,
    ...(vessel.imo !== undefined ? { imo: vessel.imo } : {}),
    ...(vessel.callsign !== undefined ? { callsign: vessel.callsign } : {}),
    ...(vessel.dataset !== undefined ? { dataset: vessel.dataset } : {}),
    ...(vessel.geartype !== undefined ? { geartype: vessel.geartype } : {}),
    ...(vessel.firstTransmissionDate !== undefined ? { first_transmission_date: vessel.firstTransmissionDate } : {}),
    ...(vessel.lastTransmissionDate !== undefined ? { last_transmission_date: vessel.lastTransmissionDate } : {}),
    ...(vessel.hours !== undefined ? { hours: vessel.hours } : {}),
    ...(vessel.entryTimestamp !== undefined ? { entry_timestamp: vessel.entryTimestamp } : {}),
    ...(vessel.exitTimestamp !== undefined ? { exit_timestamp: vessel.exitTimestamp } : {}),
  })));
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value : undefined;
}

function utcTimestamp(value: unknown): value is string {
  return typeof value === "string" && /(?:Z|[+]00:00)$/.test(value) && Number.isFinite(Date.parse(value));
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
    const vessel: GfwHourlyGridVessel = { vesselId, mmsi, shipName, vesselType, flag };
    const extendedKeys = [
      "imo", "callsign", "dataset", "geartype", "first_transmission_date",
      "last_transmission_date", "hours", "entry_timestamp", "exit_timestamp",
    ];
    if (extendedKeys.some((key) => key in o)) {
      if (!extendedKeys.every((key) => key in o)) return null;
      const imo = optionalString(o.imo);
      const callsign = optionalString(o.callsign);
      const dataset = optionalString(o.dataset);
      const geartype = optionalString(o.geartype);
      const firstTransmissionDate = optionalString(o.first_transmission_date);
      const lastTransmissionDate = optionalString(o.last_transmission_date);
      if (
        imo === undefined || callsign === undefined || dataset === undefined || geartype === undefined ||
        firstTransmissionDate === undefined || lastTransmissionDate === undefined ||
        typeof o.hours !== "number" || !Number.isFinite(o.hours) || o.hours < 0 ||
        !utcTimestamp(o.entry_timestamp) || !utcTimestamp(o.exit_timestamp) ||
        (firstTransmissionDate !== null && !utcTimestamp(firstTransmissionDate)) ||
        (lastTransmissionDate !== null && !utcTimestamp(lastTransmissionDate))
      ) return null;
      Object.assign(vessel, {
        imo, callsign, dataset, geartype, firstTransmissionDate, lastTransmissionDate,
        hours: o.hours, entryTimestamp: o.entry_timestamp, exitTimestamp: o.exit_timestamp,
      });
    }
    vessels.push(vessel);
  }
  return vessels;
}
