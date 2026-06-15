/**
 * §D 即時統計列
 *
 * - 覆蓋台灣中：N 顆（即時 SGP4 計算每秒掃所有 loaded sat）
 * - 未來 6h 預計通過：M 次（每分鐘步進 12h，避免太短漏判）
 * - 可展開 timeline：橫向 6h 軸，每顆衛星 pass 時刻 tick
 *
 * 計算成本：N=350 顆 × 360 步 = 126k SGP4 呼叫，~150ms 一次
 * 為避免 toggle 一次重算一次，cache 5 min；showAllOrbits 變化才重算
 */
import { useEffect, useMemo, useState } from "react";
import * as satellite from "satellite.js";
import { COLORS, FONT_CJK, FONT_DATA } from "./satelliteConsoleTokens";
import { loadSatellites } from "../../data/satelliteLoader";
import type { SatelliteRecord } from "../../data/satelliteTypes";
import { SATELLITE_COLORS } from "../../data/satelliteTypes";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";

interface Props {
  maneuvers: ManeuverRow[];
}

const TW_CENTER = { lon: 121.0, lat: 23.7 };
const R_EARTH = 6371;
const MU = 398600.4418;
const SCAN_STEP_SEC = 60;
const SCAN_HOURS = 6;

interface ParsedSat {
  rec: SatelliteRecord;
  satrec: satellite.SatRec;
  radiusKm: number;
}

interface PassTick {
  norad: number;
  name: string;
  cat: string;
  startMinFromNow: number; // 相對 now 的分鐘
}

function distanceKm(aLon: number, aLat: number, bLon: number, bLat: number): number {
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLon = (bLon - aLon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

function coverageRadiusKm(altKm: number): number {
  const elev = 10 * Math.PI / 180;
  const ratio = R_EARTH / (R_EARTH + altKm);
  const eta = Math.asin(ratio * Math.cos(elev));
  const lambda = Math.PI / 2 - elev - eta;
  return Math.max(120, R_EARTH * lambda);
}

function subpoint(satrec: satellite.SatRec, t: Date): { lon: number; lat: number } | null {
  try {
    const pv = satellite.propagate(satrec, t);
    if (typeof pv.position === "boolean" || !pv.position) return null;
    const gmst = satellite.gstime(t);
    const geo = satellite.eciToGeodetic(pv.position, gmst);
    return {
      lon: satellite.degreesLong(geo.longitude),
      lat: satellite.degreesLat(geo.latitude),
    };
  } catch {
    return null;
  }
}

export function CoverageStatsSection({ maneuvers }: Props) {
  const [parsed, setParsed] = useState<ParsedSat[]>([]);
  const [coveringNow, setCoveringNow] = useState<ParsedSat[]>([]);
  const [passes, setPasses] = useState<PassTick[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [computingScan, setComputingScan] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSatellites().then((recs) => {
      if (!alive) return;
      const out: ParsedSat[] = [];
      for (const r of recs) {
        try {
          const satrec = satellite.twoline2satrec(r.tleLine1, r.tleLine2);
          const nRadSec = satrec.no / 60;
          if (nRadSec <= 0) continue;
          const a = Math.pow(MU / (nRadSec ** 2), 1 / 3);
          const altKm = a - R_EARTH;
          if (altKm < 100 || altKm > 50000) continue;
          out.push({ rec: r, satrec, radiusKm: coverageRadiusKm(altKm) });
        } catch { /* skip */ }
      }
      setParsed(out);
    });
    return () => { alive = false; };
  }, []);

  // 每 5 秒掃「現在覆蓋中」
  useEffect(() => {
    if (parsed.length === 0) return;
    const tick = () => {
      const now = new Date();
      const out: ParsedSat[] = [];
      for (const p of parsed) {
        const point = subpoint(p.satrec, now);
        if (!point) continue;
        if (distanceKm(point.lon, point.lat, TW_CENTER.lon, TW_CENTER.lat) < p.radiusKm) {
          out.push(p);
        }
      }
      setCoveringNow(out);
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [parsed]);

  // 6h pass scan，5 min 重算（避免 toggle 反覆觸發）
  useEffect(() => {
    if (parsed.length === 0) return;
    let alive = true;
    setComputingScan(true);
    const run = () => {
      const t0Ms = Date.now();
      const nowMs = Date.now();
      const out: PassTick[] = [];
      const totalSteps = (SCAN_HOURS * 3600) / SCAN_STEP_SEC;
      for (const p of parsed) {
        let inPass = false;
        for (let s = 0; s <= totalSteps; s++) {
          const t = new Date(nowMs + s * SCAN_STEP_SEC * 1000);
          const point = subpoint(p.satrec, t);
          if (!point) continue;
          const inside = distanceKm(point.lon, point.lat, TW_CENTER.lon, TW_CENTER.lat) < p.radiusKm;
          if (inside && !inPass) {
            inPass = true;
            out.push({
              norad: p.rec.noradId,
              name: p.rec.name,
              cat: p.rec.category,
              startMinFromNow: Math.round(s * SCAN_STEP_SEC / 60),
            });
          } else if (!inside && inPass) {
            inPass = false;
          }
        }
      }
      if (alive) {
        setPasses(out.sort((a, b) => a.startMinFromNow - b.startMinFromNow));
        setComputingScan(false);
        const ms = Date.now() - t0Ms;
        console.log(`[satconsole] 6h pass scan: ${out.length} passes in ${ms}ms (${parsed.length} sats)`);
      }
    };
    // 用 requestIdleCallback 或 setTimeout 把計算放到下一個 tick，不卡 UI
    const id = window.setTimeout(run, 200);
    const refreshId = window.setInterval(run, 5 * 60 * 1000);
    return () => {
      alive = false;
      window.clearTimeout(id);
      window.clearInterval(refreshId);
    };
  }, [parsed]);

  const maneuverNorads = useMemo(() => {
    const s = new Set<number>();
    for (const m of maneuvers) s.add(m.norad_id);
    return s;
  }, [maneuvers]);

  return (
    <div style={{ padding: "10px 14px 8px", borderBottom: `1px solid ${COLORS.borderSoft}`, fontFamily: FONT_CJK }}>
      {/* 主數字列 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
        <div>
          <span style={{ color: COLORS.textDim }}>覆蓋台灣中</span>
          <span style={{ marginLeft: 6, fontFamily: FONT_DATA, fontSize: 16, fontWeight: 700, color: coveringNow.length > 0 ? "#4fc3f7" : COLORS.textDefault }}>
            {coveringNow.length}
          </span>
          <span style={{ color: COLORS.textDim, marginLeft: 2 }}>顆</span>
        </div>
        <div style={{ width: 1, height: 18, background: COLORS.borderSoft }} />
        <div>
          <span style={{ color: COLORS.textDim }}>未來 6h 通過</span>
          <span style={{ marginLeft: 6, fontFamily: FONT_DATA, fontSize: 16, fontWeight: 700, color: COLORS.textDefault }}>
            {computingScan ? "…" : passes.length}
          </span>
          <span style={{ color: COLORS.textDim, marginLeft: 2 }}>次</span>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginLeft: "auto",
            padding: "3px 8px",
            borderRadius: 4,
            background: "transparent",
            border: `1px solid ${COLORS.borderMid}`,
            color: COLORS.textMuted,
            fontFamily: FONT_CJK,
            fontSize: 10,
            cursor: "pointer",
          }}
        >
          {expanded ? "▾ 收合" : "▸ 看 timeline"}
        </button>
      </div>

      {/* 覆蓋中 sats 縮略 */}
      {coveringNow.length > 0 && (
        <div style={{
          marginTop: 6,
          fontFamily: FONT_DATA,
          fontSize: 10,
          color: COLORS.textMuted,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {coveringNow.slice(0, 6).map((p) => p.rec.name).join(" · ")}
          {coveringNow.length > 6 ? ` … +${coveringNow.length - 6}` : ""}
        </div>
      )}

      {/* 6h timeline 展開 */}
      {expanded && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 6, background: "rgba(0,0,0,0.25)" }}>
          {/* axis */}
          <div style={{ position: "relative", height: 18, marginBottom: 8 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 14, height: 1, background: COLORS.borderMid }} />
            {[0, 1, 2, 3, 4, 5, 6].map((h) => (
              <div key={h} style={{
                position: "absolute",
                left: `${(h / 6) * 100}%`,
                top: 0,
                transform: "translateX(-50%)",
                fontFamily: FONT_DATA,
                fontSize: 9,
                color: COLORS.textFaint,
              }}>
                +{h}h
              </div>
            ))}
          </div>
          {/* tick rows: limit to 12 for readability */}
          <div style={{ position: "relative", maxHeight: 220, overflowY: "auto" }} className="mtp-scroll">
            {passes.length === 0 ? (
              <div style={{ fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textFaint, padding: "8px 0", textAlign: "center" }}>
                {computingScan ? "計算中…" : "未來 6h 無預計通過"}
              </div>
            ) : (
              passes.slice(0, 80).map((p, i) => {
                const left = (p.startMinFromNow / (SCAN_HOURS * 60)) * 100;
                const color = SATELLITE_COLORS[p.cat as keyof typeof SATELLITE_COLORS] || COLORS.textDim;
                const isManeuver = maneuverNorads.has(p.norad);
                return (
                  <div key={i} style={{ position: "relative", height: 18, display: "flex", alignItems: "center" }}>
                    <span style={{
                      position: "absolute",
                      left: `${left}%`,
                      top: 5,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: color,
                      transform: "translateX(-50%)",
                      boxShadow: isManeuver ? `0 0 5px ${COLORS.statusErr}` : "none",
                    }} />
                    <span style={{
                      position: "absolute",
                      left: `min(${left + 1.5}%, calc(100% - 120px))`,
                      top: 1,
                      fontFamily: FONT_DATA,
                      fontSize: 9.5,
                      color: COLORS.textMuted,
                      whiteSpace: "nowrap",
                      maxWidth: 140,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {p.name}{isManeuver ? " ⚡" : ""}
                    </span>
                  </div>
                );
              })
            )}
            {passes.length > 80 && (
              <div style={{ padding: "4px 0", fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint, textAlign: "center" }}>
                共 {passes.length} 次 · 顯示前 80
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
