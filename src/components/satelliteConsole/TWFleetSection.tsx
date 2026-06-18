/**
 * §C 台灣衛星專區
 *
 * 15 hero 卡（FORMOSAT 3/5/7/8 + TRITON + YUSHAN + IRIS-A/C）
 * 每顆顯示：zh 名 + use + alt + 現在位置 + 下次過台 + 距上次變軌 + 飛到/詳情
 *
 * 資料：
 * - 衛星列表 ← loadSatellites() (category=taiwan)
 * - i18n (zh, use, tier) ← satelliteTaiwanLocale
 * - 即時位置 ← satellite.js SGP4 直接算（每 5s 更新顯示）
 * - 下次過台灣 ← scan 12h
 * - 距上次變軌 ← maneuvers prop
 */
import { useEffect, useMemo, useState } from "react";
import * as satellite from "satellite.js";
import { COLORS, FONT_CJK, FONT_DATA } from "./satelliteConsoleTokens";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { loadSatellites } from "../../data/satelliteLoader";
import type { SatelliteRecord } from "../../data/satelliteTypes";
import { localeForTaiwanSat } from "../../data/satelliteTaiwanLocale";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";
import { useTimeStoreTime } from "../../hooks/useTimeStoreTime";

interface Props {
  maneuvers: ManeuverRow[];
  onSelectNorad: (n: number) => void;
  onFlyTo?: (lon: number, lat: number) => void;
}

const TW_CENTER = { lon: 121.0, lat: 23.7 };
const R_EARTH = 6371;
const MU = 398600.4418;

interface ParsedSat {
  rec: SatelliteRecord;
  satrec: satellite.SatRec;
  altKm: number;
}

interface LiveRow {
  norad: number;
  name: string;
  zh: string;
  use: string;
  tier: "core" | "research" | "legacy";
  launch: string; // YYYY-MM 給排序用
  altKm: number;
  lat: number;
  lon: number;
  nextPassMin: number | null;
  daysSinceManeuver: number | null;
}

function distanceKm(aLon: number, aLat: number, bLon: number, bLat: number): number {
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLon = (bLon - aLon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

function coverageRadiusKm(altKm: number): number {
  // elevation 10° 覆蓋半徑
  const elev = 10 * Math.PI / 180;
  const ratio = R_EARTH / (R_EARTH + altKm);
  const eta = Math.asin(ratio * Math.cos(elev));
  const lambda = Math.PI / 2 - elev - eta;
  return Math.max(120, R_EARTH * lambda);
}

function subpoint(satrec: satellite.SatRec, t: Date): { lon: number; lat: number; altKm: number } | null {
  try {
    const pv = satellite.propagate(satrec, t);
    if (typeof pv.position === "boolean" || !pv.position) return null;
    const gmst = satellite.gstime(t);
    const geo = satellite.eciToGeodetic(pv.position, gmst);
    return {
      lon: satellite.degreesLong(geo.longitude),
      lat: satellite.degreesLat(geo.latitude),
      altKm: geo.height,
    };
  } catch {
    return null;
  }
}

function nextPassMin(satrec: satellite.SatRec, nowSec: number, altHint: number): number | null {
  const radius = coverageRadiusKm(altHint);
  // 先檢查現在
  const t0 = new Date(nowSec * 1000);
  const p0 = subpoint(satrec, t0);
  if (p0 && distanceKm(p0.lon, p0.lat, TW_CENTER.lon, TW_CENTER.lat) < radius) return 0;
  for (let dt = 60; dt <= 12 * 3600; dt += 60) {
    const p = subpoint(satrec, new Date((nowSec + dt) * 1000));
    if (!p) continue;
    if (distanceKm(p.lon, p.lat, TW_CENTER.lon, TW_CENTER.lat) < radius) {
      return Math.round(dt / 60);
    }
  }
  return null;
}

export function TWFleetSection({ maneuvers, onSelectNorad, onFlyTo }: Props) {
  const [parsed, setParsed] = useState<ParsedSat[]>([]);
  // 訂閱 timeStore — 拉時間軸時整個 panel 重算位置
  const timelineSec = useTimeStoreTime(250);

  // 1 次性載入 + parse
  useEffect(() => {
    let alive = true;
    loadSatellites().then((recs) => {
      if (!alive) return;
      const tw = recs.filter((r) => r.category === "taiwan");
      const out: ParsedSat[] = [];
      for (const r of tw) {
        try {
          const satrec = satellite.twoline2satrec(r.tleLine1, r.tleLine2);
          let altKm = 0;
          const nRadSec = satrec.no / 60;
          if (nRadSec > 0) {
            const a = Math.pow(MU / (nRadSec ** 2), 1 / 3);
            altKm = a - R_EARTH;
          }
          out.push({ rec: r, satrec, altKm });
        } catch { /* skip bad TLE */ }
      }
      setParsed(out);
    });
    return () => { alive = false; };
  }, []);

  const rows: LiveRow[] = useMemo(() => {
    const now = new Date(timelineSec * 1000);
    const nowSec = Math.floor(timelineSec);
    const lastManeuverByNorad = new Map<number, string>();
    for (const m of maneuvers) {
      if (m.country_operator !== "Taiwan" && m.cn_group !== "TAIWAN") continue;
      const prev = lastManeuverByNorad.get(m.norad_id);
      if (!prev || new Date(m.curr_fetched_at) > new Date(prev)) {
        lastManeuverByNorad.set(m.norad_id, m.curr_fetched_at);
      }
    }
    const out: LiveRow[] = [];
    for (const p of parsed) {
      const point = subpoint(p.satrec, now);
      if (!point) continue;
      const locale = localeForTaiwanSat(p.rec.noradId);
      const nextMin = nextPassMin(p.satrec, nowSec, p.altKm);
      const lastMan = lastManeuverByNorad.get(p.rec.noradId);
      const daysSince = lastMan
        ? Math.round((timelineSec * 1000 - new Date(lastMan).getTime()) / (86400 * 1000))
        : null;
      out.push({
        norad: p.rec.noradId,
        name: p.rec.name,
        zh: locale?.zh ?? p.rec.name,
        use: locale?.use ?? "—",
        tier: locale?.tier ?? "core",
        launch: locale?.launch ?? "0000-00",
        altKm: point.altKm,
        lat: point.lat,
        lon: point.lon,
        nextPassMin: nextMin,
        daysSinceManeuver: daysSince,
      });
    }
    // 依發射日 DESC（新的在前），無 launch 的擺最後
    return out.sort((a, b) => {
      if (a.launch === b.launch) return a.norad - b.norad;
      return b.launch.localeCompare(a.launch);
    });
  }, [parsed, maneuvers, timelineSec]);

  if (rows.length === 0) {
    return (
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.borderSoft}`, fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, color: COLORS.textFaint }}>
        台灣衛星 — 載入中…
      </div>
    );
  }

  return (
    <div style={{ borderBottom: `1px solid ${COLORS.borderSoft}` }}>
      <div style={{
        padding: "9px 14px 6px",
        fontFamily: FONT_DATA,
        fontSize: FONT_SIZE.xs,
        letterSpacing: "2px",
        color: COLORS.textFaint,
        display: "flex",
        alignItems: "center",
      }}>
        <span>TAIWAN · {rows.length} SATS</span>
        <span style={{ marginLeft: "auto", color: "#4fc3f7" }}>
          覆蓋中：{rows.filter((r) => r.nextPassMin === 0).length}
        </span>
      </div>

      <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => {
          const isCovering = r.nextPassMin === 0;
          const isLegacy = r.tier === "legacy";
          return (
            <div
              key={r.norad}
              style={{
                padding: "8px 11px",
                borderRadius: RADIUS.xl,
                background: isCovering ? "rgba(79,195,247,0.10)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${isCovering ? "rgba(79,195,247,0.45)" : COLORS.borderSoft}`,
                fontFamily: FONT_CJK,
                cursor: "pointer",
                transition: "background 0.12s ease",
              }}
              onClick={() => onSelectNorad(r.norad)}
              onMouseEnter={(e) => { if (!isCovering) e.currentTarget.style.background = "rgba(100,170,255,0.06)"; }}
              onMouseLeave={(e) => { if (!isCovering) e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.textStrong }}>{r.zh}</span>
                <span style={{ fontFamily: FONT_DATA, fontSize: 9.5, color: COLORS.textDim }}>
                  {r.name}
                </span>
                {isLegacy && (
                  <span style={{
                    padding: "0 5px",
                    borderRadius: RADIUS.md,
                    background: "rgba(255,152,0,0.16)",
                    border: "1px solid rgba(255,152,0,0.45)",
                    fontSize: 9.5,
                    color: COLORS.statusWarn,
                  }}>
                    ⚠ 超齡服役
                  </span>
                )}
                {r.tier === "research" && (
                  <span style={{
                    padding: "0 5px",
                    borderRadius: RADIUS.md,
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${COLORS.borderMid}`,
                    fontSize: 9.5,
                    color: COLORS.textMuted,
                  }}>
                    學研
                  </span>
                )}
                <span style={{ marginLeft: "auto", fontFamily: FONT_DATA, fontSize: 9.5, color: COLORS.textDim }}>
                  NORAD {r.norad}
                </span>
              </div>

              <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: COLORS.textMuted }}>
                <span>{r.use}</span>
                <span style={{ color: COLORS.textFaint }}>·</span>
                <span style={{ fontFamily: FONT_DATA }}>{Math.round(r.altKm)} km</span>
              </div>

              <div style={{
                marginTop: 5,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontFamily: FONT_DATA,
                fontSize: FONT_SIZE.sm,
                color: COLORS.textMuted,
              }}>
                <span>{r.lat.toFixed(1)}°{r.lat >= 0 ? "N" : "S"} {Math.abs(r.lon).toFixed(1)}°{r.lon >= 0 ? "E" : "W"}</span>
                <span style={{ color: COLORS.textFaint }}>·</span>
                <span style={{ color: isCovering ? "#4fc3f7" : COLORS.textDefault }}>
                  {isCovering
                    ? "正覆蓋台灣"
                    : r.nextPassMin == null
                      ? "12h 內無通過"
                      : `下次過台 ${r.nextPassMin} 分`}
                </span>
                {r.daysSinceManeuver != null && (
                  <>
                    <span style={{ color: COLORS.textFaint }}>·</span>
                    <span>距上次變軌 {r.daysSinceManeuver}d</span>
                  </>
                )}
              </div>

              <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onFlyTo?.(r.lon, r.lat); }}
                  style={{
                    flex: 1,
                    padding: "4px 0",
                    borderRadius: RADIUS.md,
                    border: `1px solid ${COLORS.borderMid}`,
                    background: "transparent",
                    color: COLORS.textDefault,
                    fontFamily: FONT_CJK,
                    fontSize: 10.5,
                    cursor: "pointer",
                  }}
                >
                  飛到衛星
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectNorad(r.norad); }}
                  style={{
                    flex: 1,
                    padding: "4px 0",
                    borderRadius: RADIUS.md,
                    border: "1px solid rgba(100,170,255,0.55)",
                    background: "rgba(100,170,255,0.16)",
                    color: "#cfe4ff",
                    fontFamily: FONT_CJK,
                    fontSize: 10.5,
                    cursor: "pointer",
                  }}
                >
                  百科
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
