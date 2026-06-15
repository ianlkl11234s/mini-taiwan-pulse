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
import { useTimeStoreTime } from "../../hooks/useTimeStoreTime";
import { timeStore } from "../../state/timeStore";

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

/** 遙測偵察類 — 主要會「拍照」的衛星群（CN 三大群 + TW + 9 國 LEO recon）*/
const RECON_CATS = new Set([
  // CN（中國本來就有 6 群，但這三個是遙測核心）
  "china_yaogan", "china_jilin", "china_gaofen",
  // TW
  "taiwan",
  // 9 國（loader 已用 purpose=earth_obs 篩過，全 recon）
  "usa", "japan", "russia", "india", "korea",
  "france", "germany", "italy", "israel",
]);

function isRecon(cat: string): boolean {
  return RECON_CATS.has(cat);
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
  // 預設只看「遙測偵察」（Yaogan/Jilin/Gaofen + TW）
  const [reconOnly, setReconOnly] = useState(true);
  // 訂閱時間軸 — 「現在覆蓋」與 6h scan 起點都跟著走
  const timelineSec = useTimeStoreTime(500);

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

  // 依時間軸算「該時刻覆蓋中」— timelineSec 變動就重算
  useEffect(() => {
    if (parsed.length === 0) return;
    const t = new Date(timeStore.getTime() * 1000);
    const out: ParsedSat[] = [];
    for (const p of parsed) {
      const point = subpoint(p.satrec, t);
      if (!point) continue;
      if (distanceKm(point.lon, point.lat, TW_CENTER.lon, TW_CENTER.lat) < p.radiusKm) {
        out.push(p);
      }
    }
    setCoveringNow(out);
  }, [parsed, timelineSec]);

  // 6h pass scan — 起點是「時間軸當下」，每分鐘級別變動才重算（拉時間軸防抖）
  useEffect(() => {
    if (parsed.length === 0) return;
    let alive = true;
    setComputingScan(true);
    const run = () => {
      const t0Ms = Date.now();
      // 從時間軸當下開始往後掃 6h（不再用現實 now）
      const nowMs = timeStore.getTime() * 1000;
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
    // 用 setTimeout 把計算放到下一個 tick，不卡 UI
    const id = window.setTimeout(run, 200);
    // 拉時間軸 → 用 timeStore 的訂閱來重抓，60s 一次節流避免拖曳時瘋狂重算
    const unsub = timeStore.subscribeThrottled(60_000, () => { if (alive) run(); });
    return () => {
      alive = false;
      window.clearTimeout(id);
      unsub();
    };
  }, [parsed]);

  const maneuverNorads = useMemo(() => {
    const s = new Set<number>();
    for (const m of maneuvers) s.add(m.norad_id);
    return s;
  }, [maneuvers]);

  // 覆蓋台灣中 — 按 cat 分群算 breakdown
  const coverageBreakdown = useMemo(() => {
    let cn = 0, tw = 0, recon = 0;
    for (const p of coveringNow) {
      const cat = p.rec.category;
      if (cat === "taiwan") tw++;
      else cn++;
      if (RECON_CATS.has(cat)) recon++;
    }
    return { total: coveringNow.length, cn, tw, recon };
  }, [coveringNow]);

  // 6h 通過 — 按 cat 分群算 breakdown + 過濾顯示
  const passBreakdown = useMemo(() => {
    let cn = 0, tw = 0, recon = 0;
    for (const p of passes) {
      if (p.cat === "taiwan") tw++;
      else cn++;
      if (RECON_CATS.has(p.cat)) recon++;
    }
    return { total: passes.length, cn, tw, recon };
  }, [passes]);

  // 依 toggle 過濾的 timeline tick 清單
  const filteredPasses = useMemo(() => {
    return reconOnly ? passes.filter((p) => isRecon(p.cat)) : passes;
  }, [passes, reconOnly]);

  return (
    <div style={{ padding: "10px 14px 8px", borderBottom: `1px solid ${COLORS.borderSoft}`, fontFamily: FONT_CJK }}>
      {/* 主數字列 — 覆蓋中 + 6h 通過 + breakdown */}
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

      {/* breakdown 細項 — CN/TW + 遙測類 */}
      {coveringNow.length > 0 && (
        <div style={{
          marginTop: 5,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          fontFamily: FONT_DATA, fontSize: 10, color: COLORS.textMuted,
        }}>
          <span>CN <span style={{ color: COLORS.textDefault, fontWeight: 600 }}>{coverageBreakdown.cn}</span></span>
          <span>/ TW <span style={{ color: "#4fc3f7", fontWeight: 600 }}>{coverageBreakdown.tw}</span></span>
          <span style={{ color: COLORS.textFaint }}>·</span>
          <span title="Yaogan/Jilin/Gaofen + Taiwan 整體遙測偵察">
            遙測類 <span style={{ color: coverageBreakdown.recon > 0 ? "#22c55e" : COLORS.textMuted, fontWeight: 700 }}>
              {coverageBreakdown.recon}
            </span> 顆
          </span>
          {!computingScan && passes.length > 0 && (
            <>
              <span style={{ marginLeft: "auto", color: COLORS.textFaint }}>6h 內</span>
              <span>遙測 <span style={{ color: passBreakdown.recon > 0 ? "#22c55e" : COLORS.textMuted, fontWeight: 600 }}>{passBreakdown.recon}</span> 次</span>
            </>
          )}
        </div>
      )}

      {/* 覆蓋中 sats 縮略 */}
      {coveringNow.length > 0 && (
        <div style={{
          marginTop: 4,
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
          {/* 過濾 toggle */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
            fontFamily: FONT_CJK, fontSize: 10.5,
          }}>
            <span style={{ color: COLORS.textMuted }}>顯示</span>
            <button
              onClick={() => setReconOnly(true)}
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                background: reconOnly ? "rgba(34,197,94,0.16)" : "transparent",
                border: `1px solid ${reconOnly ? "rgba(34,197,94,0.55)" : COLORS.borderMid}`,
                color: reconOnly ? "#22c55e" : COLORS.textMuted,
                fontFamily: FONT_CJK, fontSize: 10.5, fontWeight: reconOnly ? 600 : 400, cursor: "pointer",
              }}
            >
              只看遙測偵察
            </button>
            <button
              onClick={() => setReconOnly(false)}
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                background: !reconOnly ? COLORS.accentFaint : "transparent",
                border: `1px solid ${!reconOnly ? COLORS.borderAccent : COLORS.borderMid}`,
                color: !reconOnly ? "#cfe4ff" : COLORS.textMuted,
                fontFamily: FONT_CJK, fontSize: 10.5, fontWeight: !reconOnly ? 600 : 400, cursor: "pointer",
              }}
            >
              全部
            </button>
            <span style={{ marginLeft: "auto", fontFamily: FONT_DATA, fontSize: 9.5, color: COLORS.textFaint }}>
              {filteredPasses.length} / {passes.length} 次
            </span>
          </div>
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
          {/* tick rows */}
          <div style={{ position: "relative", maxHeight: 220, overflowY: "auto" }} className="mtp-scroll">
            {filteredPasses.length === 0 ? (
              <div style={{ fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textFaint, padding: "8px 0", textAlign: "center" }}>
                {computingScan ? "計算中…" : reconOnly ? "未來 6h 無遙測偵察類通過" : "未來 6h 無預計通過"}
              </div>
            ) : (
              filteredPasses.slice(0, 80).map((p, i) => {
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
            {filteredPasses.length > 80 && (
              <div style={{ padding: "4px 0", fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint, textAlign: "center" }}>
                共 {filteredPasses.length} 次 · 顯示前 80
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
