// G02：CWA 風圈、預報只留最新一版、storm_key 同一颱風只畫一家、NCDR 各國預報版次區間
import { describe, expect, it } from "vitest";
import {
  keepLatestForecast, pickActiveTyphoon, typhoonPointsToGeoJSON, windRadiusRing,
  type TyphoonActiveRow, type TyphoonPoint,
} from "../typhoonTracksLoader";
import {
  AGENCY_FORECAST_STALE_AFTER_SEC, activeAgencyVersions, agencyForecastsToGeoJSON, groupAgencyTracks,
  parseAgencyForecastRows,
} from "../typhoonAgencyForecastsLoader";

const T0 = 1_792_000_000;
const pt = (o: Partial<TyphoonPoint> & { source: string; storm_id: string }): TyphoonPoint => ({
  point_type: "observed", advisory_number: null, valid_ts: T0, name_en: "Champi", name_local: "",
  center_lat: 13.1, center_lon: 144.8, center_pressure: null, max_wind_kt: null, ...o,
});

describe("keepLatestForecast", () => {
  it("每個 storm×source 只留最大 advisory_number 的預報列，觀測列不動", () => {
    const rows = [
      pt({ source: "jtwc", storm_id: "wp2926", point_type: "forecast", advisory_number: 13, valid_ts: T0 + 86400 }),
      pt({ source: "jtwc", storm_id: "wp2926", point_type: "forecast", advisory_number: 14, valid_ts: T0 + 86400 }),
      pt({ source: "jma", storm_id: "TC2636", point_type: "forecast", advisory_number: 7, valid_ts: T0 + 86400 }),
      pt({ source: "jtwc", storm_id: "wp2926", advisory_number: 13 }),
    ];
    const kept = keepLatestForecast(rows);
    expect(kept.filter((p) => p.point_type === "forecast").map((p) => `${p.source}:${p.advisory_number}`).sort())
      .toEqual(["jma:7", "jtwc:14"]);
    expect(kept.some((p) => p.point_type === "observed")).toBe(true);
  });
});

describe("windRadiusRing", () => {
  it("四象限各用自己的半徑；缺象限退回單一半徑；全缺回 null（不當 0）", () => {
    const quad = windRadiusRing(144.8, 13.1, { ne: 200, se: 100, sw: 100, nw: 100 }, 200)!;
    const north = quad[0]!; // 方位 0°（NE 象限起點）
    const south = quad.find((_, i) => i === Math.floor(quad.length / 2))!; // 約 180°
    expect(north[1]! - 13.1).toBeCloseTo(200 / 111.2, 1);
    expect(13.1 - south[1]!).toBeCloseTo(100 / 111.2, 1);
    expect(quad[0]).toEqual(quad[quad.length - 1]);

    const circle = windRadiusRing(144.8, 13.1, { all: 80, ne: 80 }, null)!;
    expect(circle[0]![1]! - 13.1).toBeCloseTo(80 / 111.2, 1);
    expect(windRadiusRing(144.8, 13.1, null, null)).toBeNull();
    expect(windRadiusRing(144.8, 13.1, { all: null }, 0)).toBeNull();
  });
});

describe("typhoonPointsToGeoJSON（G02）", () => {
  const cwa = (ts: number, lon: number) => pt({
    source: "cwa", storm_id: "cwa2633", valid_ts: ts, center_lon: lon, storm_key: "2026:CHAMPI",
    gale_radius_km: 200, storm_radius_km: 80,
    wind_radii: { gale: { all: 200, ne: 200, se: 210, sw: 200, nw: 190 }, storm: { all: 80 } },
  });
  const jma = (ts: number, lon: number) => pt({ source: "jma", storm_id: "TC2636", valid_ts: ts, center_lon: lon, storm_key: "2026:CHAMPI" });
  const jtwcTd = (ts: number, lon: number) => pt({ source: "jtwc", storm_id: "wp2926", valid_ts: ts, center_lon: lon, name_en: "TWENTYNINE" });
  const jtwcNamed = (ts: number, lon: number) => pt({ source: "jtwc", storm_id: "wp2926", valid_ts: ts, center_lon: lon, storm_key: "2026:CHAMPI" });
  const other = (ts: number) => pt({ source: "jtwc", storm_id: "ep1526", valid_ts: ts, center_lon: -164, center_lat: 21, name_en: "Nolo", storm_key: "2026:NOLO" });

  const gj = typhoonPointsToGeoJSON([
    cwa(T0, 145), cwa(T0 + 21600, 144.5),
    jma(T0, 145.1), jma(T0 + 21600, 144.6),
    jtwcTd(T0 - 21600, 145.5), jtwcNamed(T0, 145), jtwcNamed(T0 + 21600, 144.5),
    other(T0), other(T0 + 21600),
  ]);

  it("同 storm_key 只有優先序最高的一家（CWA）是 primary；TD 階段沒 key 的列仍歸到命名後的鍵", () => {
    const primaryBySource = new Map<string, Set<boolean>>();
    for (const f of gj.current.features) {
      const p = f.properties!;
      const k = `${p.storm_id}`;
      if (!primaryBySource.has(k)) primaryBySource.set(k, new Set());
      primaryBySource.get(k)!.add(p.primary as boolean);
    }
    expect([...primaryBySource.get("cwa2633")!]).toEqual([true]);
    expect([...primaryBySource.get("TC2636")!]).toEqual([false]);
    expect([...primaryBySource.get("wp2926")!]).toEqual([false]); // 含 TD 階段那一點
    expect([...primaryBySource.get("ep1526")!]).toEqual([true]); // 別的颱風不受影響
    const primaryLines = gj.lines.features.filter((f) => f.properties!.primary && f.properties!.storm_key === "2026:CHAMPI");
    expect(new Set(primaryLines.map((f) => f.properties!.source))).toEqual(new Set(["cwa"]));
  });

  it("風圈：CWA 每個觀測點 7 級＋10 級各一個 polygon，區間同現在位置光圈", () => {
    expect(gj.radii.features).toHaveLength(4);
    const kinds = gj.radii.features.map((f) => f.properties!.radius_kind).sort();
    expect(kinds).toEqual(["gale", "gale", "storm", "storm"]);
    const first = gj.radii.features.find((f) => f.properties!.valid_ts === T0)!;
    expect(first.properties!.valid_until).toBe(T0 + 21600);
    expect(first.properties!.source).toBe("cwa");
    expect(first.geometry.type).toBe("Polygon");
  });

  it("沒有半徑的來源不產生風圈（JTWC／JMA NULL 不當 0）", () => {
    expect(gj.radii.features.every((f) => f.properties!.source === "cwa")).toBe(true);
  });

  it("70% 機率圈只取最新一版預報點", () => {
    const g = typhoonPointsToGeoJSON([
      pt({ source: "cwa", storm_id: "cwa2633", point_type: "forecast", advisory_number: 1, valid_ts: T0 + 86400, prob70_radius_km: 90 }),
      pt({ source: "cwa", storm_id: "cwa2633", point_type: "forecast", advisory_number: 2, valid_ts: T0 + 86400, prob70_radius_km: 80 }),
      pt({ source: "cwa", storm_id: "cwa2633", point_type: "forecast", advisory_number: 2, valid_ts: T0 + 172800, prob70_radius_km: null }),
    ]);
    expect(g.prob70.features).toHaveLength(1);
    expect(g.prob70.features[0]!.properties!.prob70_radius_km).toBe(80);
    expect(g.points.features.filter((f) => f.properties!.point_type === "forecast")).toHaveLength(2);
  });
});

describe("pickActiveTyphoon 依 storm_key 去重（Monitor 卡只一張）", () => {
  const NOW = T0 + 3600;
  const iso = (s: number) => new Date(s * 1000).toISOString();
  const row = (o: Partial<TyphoonActiveRow> & { source: string; storm_id: string }): TyphoonActiveRow => ({
    valid_at: iso(T0), name_local: null, name_en: null, center_lat: 13.1, center_lon: 144.8,
    center_pressure_hpa: null, max_wind_kt: null, ...o,
  });

  it("三家同 storm_key 名稱不同也只回一張卡，來源徽章列三家、名稱取氣象署中文", () => {
    const s = pickActiveTyphoon([
      row({ source: "jma", storm_id: "TC2636", name_local: "チャンパー", name_en: "", storm_key: "2026:CHAMPI", center_pressure_hpa: 950 }),
      row({ source: "jtwc", storm_id: "wp2926", name_en: "Champi", storm_key: "2026:CHAMPI", max_wind_kt: 115 }),
      row({ source: "cwa", storm_id: "cwa2633", name_local: "薔琵", name_en: "Champi", storm_key: "2026:CHAMPI", max_wind_kt: 103 }),
    ], NOW)!;
    expect(s.sources).toEqual(["CWA", "JMA", "JTWC"]);
    expect(s.name_local).toBe("薔琵");
    expect(s.max_wind_kt).toBe(115);
    expect(s.center_pressure).toBe(950);
  });
});

describe("各國颱風預報（NCDR）版次區間", () => {
  const iso = (s: number) => new Date(s * 1000).toISOString();
  const raw = (agency: string, issued: number, lead: number, lon: number) => ({
    agency, track_index: 0, issued_at: iso(issued), issued_label: "10/18 02", lead_hour: lead,
    valid_at: iso(issued + lead * 3600), center_lat: 13 + lead / 24, center_lon: lon,
    storm_key: "2026:CHAMPI", matched_name_en: "Champi",
  });
  const rows = parseAgencyForecastRows([
    ...[0, 24, 48].map((h) => raw("cwa", T0, h, 145 - h / 24)),
    ...[0, 24, 48].map((h) => raw("cwa", T0 + 21600, h, 144 - h / 24)),
    ...[0, 24].map((h) => raw("kma", T0, h, 145)),
    raw("unknown", T0, 0, 145),
  ]);

  it("未知機構丟掉；每家每版一條，舊版 valid_until＝下一版 issued_at、最新版撐 STALE_AFTER", () => {
    const tracks = groupAgencyTracks(rows);
    expect(tracks).toHaveLength(3);
    const cwa = tracks.filter((t) => t.agency === "cwa");
    expect(cwa[0]!.valid_until).toBe(T0 + 21600);
    expect(cwa[1]!.valid_until).toBe(T0 + 21600 + AGENCY_FORECAST_STALE_AFTER_SEC);
    expect(activeAgencyVersions(tracks, T0 + 3600).map((t) => `${t.agency}@${t.issued_ts}`).sort())
      .toEqual([`cwa@${T0}`, `kma@${T0}`]);
    expect(activeAgencyVersions(tracks, T0 + 21600 + 60).filter((t) => t.agency === "cwa").map((t) => t.issued_ts))
      .toEqual([T0 + 21600]);
    expect(activeAgencyVersions(tracks, T0 - 1)).toHaveLength(0);
  });

  it("GeoJSON：線依 lead_hour 排序、終點帶標籤「機構 發佈時間」", () => {
    const { lines, points } = agencyForecastsToGeoJSON(groupAgencyTracks(rows));
    expect(lines.features).toHaveLength(3);
    const last = points.features.filter((f) => f.properties!.is_last);
    expect(last).toHaveLength(3);
    expect(last[0]!.properties!.label).toMatch(/^(CWA|KMA) 10\/18 02$/);
  });
});
