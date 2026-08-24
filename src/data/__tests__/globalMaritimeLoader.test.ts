import { describe, expect, it } from "vitest";
import {
  aisstreamToGeoJSON,
  gfwToGeoJSON,
  type AisstreamVessel,
  type GfwVesselPresence,
} from "../globalMaritimeLoader";

const ais = (patch: Partial<AisstreamVessel> = {}): AisstreamVessel => ({
  provider: "aisstream",
  mmsi: "123456789",
  shipName: "TEST AIS",
  shipType: "cargo",
  imo: "IMO123",
  callSign: "CALL",
  destination: "Naha",
  navStatus: "under_way",
  speedKnots: 12,
  courseOverGround: 90,
  trueHeading: 91,
  longitude: 123.4,
  latitude: 25.1,
  observedAt: "2026-08-24T01:02:03Z",
  receivedAt: "2026-08-24T01:02:04Z",
  ageSeconds: 4,
  positionQuality: "high",
  qualityFlags: { source: "terrestrial" },
  coverageZone: "taiwan-north",
  ...patch,
});

const gfw = (patch: Partial<GfwVesselPresence> = {}): GfwVesselPresence => ({
  provider: "global_fishing_watch",
  vesselId: "gfw-1",
  mmsi: "987654321",
  shipName: "TEST GFW",
  vesselType: "fishing",
  flag: "TW",
  longitude: 123.5,
  latitude: 25.2,
  sourceSnapshotDate: "2026-08-23",
  observedAt: "2026-08-23T00:00:00Z",
  receivedAt: "2026-08-24T01:00:00Z",
  ageHours: 25,
  presenceQuality: "medium",
  qualityFlags: { matched: true },
  sourceDatasetId: "gfw-public-v1",
  ...patch,
});

describe("global maritime loader GeoJSON guards", () => {
  it("跳過 AIS/GFW invalid coordinates，不把來源資料混成一層", () => {
    const aisFc = aisstreamToGeoJSON([ais(), ais({ mmsi: "bad", longitude: Number.NaN })]);
    const gfwFc = gfwToGeoJSON([gfw(), gfw({ vesselId: "bad", latitude: Infinity })]);

    expect(aisFc.features).toHaveLength(1);
    expect(gfwFc.features).toHaveLength(1);
    expect(aisFc.features[0]?.properties?.layer_source).toBe("aisstream");
    expect(gfwFc.features[0]?.properties?.layer_source).toBe("gfw");
    expect(aisFc.features.some((f) => f.properties?.layer_source === "gfw")).toBe(false);
    expect(gfwFc.features.some((f) => f.properties?.layer_source === "aisstream")).toBe(false);
  });

  it("保留各來源的 quality、觀測/接收時間與 freshness 欄位", () => {
    const aisProps = aisstreamToGeoJSON([ais()]).features[0]!.properties!;
    const gfwProps = gfwToGeoJSON([gfw()]).features[0]!.properties!;

    expect(aisProps).toMatchObject({
      quality_flags: { source: "terrestrial" },
      position_quality: "high",
      observed_at: "2026-08-24T01:02:03Z",
      received_at: "2026-08-24T01:02:04Z",
      age_seconds: 4,
    });
    expect(gfwProps).toMatchObject({
      quality_flags: { matched: true },
      presence_quality: "medium",
      source_snapshot_date: "2026-08-23",
      observed_at: "2026-08-23T00:00:00Z",
      received_at: "2026-08-24T01:00:00Z",
      age_hours: 25,
    });
  });
});
