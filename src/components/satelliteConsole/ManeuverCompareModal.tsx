/**
 * §F 變軌前後覆蓋對比 modal
 *
 * v2 設計（TW-centric + bbox 上色 + headline 過台頻次）：
 * - 主敘事：過台頻次 N→M (±%) 大字 + 進度條對比
 * - 雙 mini-map 統一框到 TW 區域（lng 108–145, lat 5–35）
 * - 12 個 TW 關聯 region 直接畫 bbox 在地圖上
 *   gained = 綠 / lost = 紅 / 不變 = 微灰
 * - 區域差異縮成一行 chips
 * - out-of-frame 區域改邊緣箭頭 chip
 *
 * 起點 = 變軌事件本身（curr_fetched_at），不跟現實 now 不跟時間軸
 */
import { useEffect, useMemo, useState } from "react";
import * as satellite from "satellite.js";
import { COLORS, FONT_CJK, FONT_DATA, MANEUVER_TOKEN } from "./satelliteConsoleTokens";
import { fetchTlePair, type TleHistoryRow } from "../../data/satelliteHistoryLoader";
import { formatManeuverDetail, type ManeuverRow } from "../../data/satelliteManeuversLoader";

interface Props {
  maneuver: ManeuverRow;
  onClose: () => void;
}

const TW_CENTER = { lon: 121.0, lat: 23.7 };
const R_EARTH = 6371;

/** TW-centric 顯示框（日本九州北界 + 菲律賓呂宋南界） */
const TW_FRAME = { lngMin: 108, lngMax: 145, latMin: 5, latMax: 35 } as const;

interface Region {
  key: string;
  zh: string;
  bbox: [number, number, number, number]; // [west, south, east, north]
}

/** TW 關聯區域（含 frame 內 / 外） */
const TW_RELEVANT_REGIONS: Region[] = [
  // ── frame 內（會畫 bbox） ─────────────────────────────
  { key: "tw",       zh: "台灣本島",       bbox: [120.0, 21.8, 122.0, 25.3] },
  { key: "okinawa",  zh: "日本沖繩",       bbox: [123.0, 24.0, 130.0, 28.5] },
  { key: "kyushu",   zh: "日本九州",       bbox: [129.5, 30.5, 132.5, 34.5] },
  { key: "luzon_n",  zh: "菲律賓呂宋北部", bbox: [119.5, 16.0, 122.5, 18.7] },
  { key: "luzon_s",  zh: "菲律賓呂宋南部", bbox: [120.5, 12.5, 124.5, 16.0] },
  { key: "south_china_sea", zh: "南海北部", bbox: [114.0, 16.0, 120.0, 22.0] },
  { key: "east_china_sea",  zh: "東海", bbox: [122.0, 28.0, 128.0, 33.0] },
  { key: "korea_s",  zh: "朝鮮半島南部",   bbox: [124.5, 33.0, 130.5, 35.0] },
  { key: "dongsha",  zh: "東沙群島",       bbox: [116.5, 20.4, 117.0, 20.9] },
  { key: "bashi",    zh: "巴士海峽",       bbox: [120.5, 20.5, 122.0, 21.7] },
  { key: "lanyu",    zh: "蘭嶼",           bbox: [121.4, 21.9, 121.7, 22.1] },
  // ── frame 外（用邊緣 chip 顯示） ─────────────────────
  { key: "japan_main", zh: "日本本州", bbox: [130.0, 35.0, 142.0, 41.0] },
  { key: "korea_n",  zh: "朝鮮半島北部",   bbox: [124.5, 39.0, 130.5, 41.0] },
];

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

interface GroundTrack {
  points: Array<{ lon: number; lat: number; altKm: number }>;
  twPasses: number;
  coveredRegions: Set<string>;
}

function computeGroundTrack(row: TleHistoryRow, anchorMs: number): GroundTrack | null {
  if (!row.tle_line1 || !row.tle_line2) return null;
  let satrec: satellite.SatRec;
  try {
    satrec = satellite.twoline2satrec(row.tle_line1, row.tle_line2);
  } catch {
    return null;
  }

  const start = anchorMs;
  const STEP_MIN = 10;
  const SPAN_HOURS = 7 * 24;
  const points: Array<{ lon: number; lat: number; altKm: number }> = [];
  const coveredRegions = new Set<string>();
  let twPasses = 0;
  let twIn = false;

  for (let m = 0; m <= SPAN_HOURS * 60; m += STEP_MIN) {
    const t = new Date(start + m * 60 * 1000);
    try {
      const pv = satellite.propagate(satrec, t);
      if (typeof pv.position === "boolean" || !pv.position) continue;
      const gmst = satellite.gstime(t);
      const geo = satellite.eciToGeodetic(pv.position, gmst);
      const lon = satellite.degreesLong(geo.longitude);
      const lat = satellite.degreesLat(geo.latitude);
      const altKm = geo.height;
      points.push({ lon, lat, altKm });

      for (const r of TW_RELEVANT_REGIONS) {
        const [w, s, e, n] = r.bbox;
        const inLon = w <= e ? (lon >= w && lon <= e) : (lon >= w || lon <= e);
        if (inLon && lat >= s && lat <= n) coveredRegions.add(r.key);
      }

      const radius = coverageRadiusKm(altKm);
      const distTW = distanceKm(lon, lat, TW_CENTER.lon, TW_CENTER.lat);
      const inside = distTW < radius;
      if (inside && !twIn) {
        twIn = true;
        twPasses++;
      } else if (!inside && twIn) {
        twIn = false;
      }
    } catch { /* skip */ }
  }

  return { points, twPasses, coveredRegions };
}

/** TW-centric 框內的 region 子集 */
const FRAME_REGIONS = TW_RELEVANT_REGIONS.filter((r) => {
  const [w, s, e, n] = r.bbox;
  return e >= TW_FRAME.lngMin && w <= TW_FRAME.lngMax &&
         n >= TW_FRAME.latMin && s <= TW_FRAME.latMax;
});


interface MiniMapProps {
  track: GroundTrack | null;
  prevTrack: GroundTrack | null;
  label: string;
  color: string;
  width?: number;
  height?: number;
  side: "before" | "after";
}

function MiniMap({
  track, prevTrack, label, color, width = 320, height = 260, side,
}: MiniMapProps) {
  // 投影：lng 線性映射；lat 反向（北上南下）
  const projX = (lon: number) => ((lon - TW_FRAME.lngMin) / (TW_FRAME.lngMax - TW_FRAME.lngMin)) * width;
  const projY = (lat: number) => ((TW_FRAME.latMax - lat) / (TW_FRAME.latMax - TW_FRAME.latMin)) * height;
  const inFrame = (lon: number, lat: number) =>
    lon >= TW_FRAME.lngMin && lon <= TW_FRAME.lngMax &&
    lat >= TW_FRAME.latMin && lat <= TW_FRAME.latMax;

  // 把點切成「進框 → 離框」的線段（避免框外無關線段）
  const segments = useMemo(() => {
    if (!track) return [];
    const segs: string[] = [];
    let cur = "";
    let prevIn = false;
    for (const p of track.points) {
      if (!inFrame(p.lon, p.lat)) {
        if (cur) { segs.push(cur); cur = ""; }
        prevIn = false;
        continue;
      }
      const x = projX(p.lon);
      const y = projY(p.lat);
      cur += (prevIn ? "L" : "M") + `${x.toFixed(1)},${y.toFixed(1)}`;
      prevIn = true;
    }
    if (cur) segs.push(cur);
    return segs;
  }, [track]);

  // region bbox 上色：gained / lost / 不變
  const regionColors = useMemo(() => {
    if (!track || !prevTrack) return new Map<string, { fill: string; stroke: string }>();
    const m = new Map<string, { fill: string; stroke: string }>();
    for (const r of FRAME_REGIONS) {
      const wasIn = prevTrack.coveredRegions.has(r.key);
      const nowIn = track.coveredRegions.has(r.key);
      if (side === "after") {
        if (!wasIn && nowIn) m.set(r.key, { fill: "rgba(34,197,94,0.22)", stroke: "rgba(34,197,94,0.75)" });   // gained 綠
        else if (wasIn && nowIn) m.set(r.key, { fill: "rgba(255,255,255,0.04)", stroke: "rgba(255,255,255,0.18)" }); // 不變
        else if (wasIn && !nowIn) m.set(r.key, { fill: "rgba(239,68,68,0.10)", stroke: "rgba(239,68,68,0.45)" });    // 顯示 lost 但較弱
      } else {
        if (wasIn && !nowIn) m.set(r.key, { fill: "rgba(239,68,68,0.22)", stroke: "rgba(239,68,68,0.75)" });   // lost 紅
        else if (wasIn && nowIn) m.set(r.key, { fill: "rgba(255,255,255,0.04)", stroke: "rgba(255,255,255,0.18)" });
        else if (!wasIn && nowIn) m.set(r.key, { fill: "rgba(34,197,94,0.10)", stroke: "rgba(34,197,94,0.45)" });
      }
    }
    return m;
  }, [track, prevTrack, side]);

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <span style={{ fontFamily: FONT_DATA, fontSize: 9.5, letterSpacing: "1.5px", color: COLORS.textMuted }}>
          {label}
        </span>
        {track && (
          <span style={{ marginLeft: "auto", fontFamily: FONT_DATA, fontSize: 10, color: COLORS.textDefault, fontWeight: 600 }}>
            過台 {track.twPasses} 次 / 7d
          </span>
        )}
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
           style={{ background: "#0b0f14", border: `1px solid ${COLORS.borderSoft}`, borderRadius: 6, display: "block" }}>
        {/* 經緯線（每 5°） */}
        {Array.from({ length: 8 }).map((_, i) => {
          const lng = TW_FRAME.lngMin + i * 5;
          if (lng > TW_FRAME.lngMax) return null;
          const x = projX(lng);
          return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={height} stroke="rgba(255,255,255,0.04)" />;
        })}
        {Array.from({ length: 7 }).map((_, i) => {
          const lat = TW_FRAME.latMin + i * 5;
          if (lat > TW_FRAME.latMax) return null;
          const y = projY(lat);
          return <line key={`h${i}`} x1={0} y1={y} x2={width} y2={y} stroke="rgba(255,255,255,0.04)" />;
        })}

        {/* region bbox */}
        {FRAME_REGIONS.map((r) => {
          const rc = regionColors.get(r.key);
          if (!rc) return null;
          const [w, s, e, n] = r.bbox;
          const x = projX(w);
          const y = projY(n);
          const rw = projX(e) - x;
          const rh = projY(s) - y;
          return (
            <g key={r.key}>
              <rect x={x} y={y} width={Math.max(2, rw)} height={Math.max(2, rh)}
                    fill={rc.fill} stroke={rc.stroke} strokeWidth={1} rx={1.5} />
            </g>
          );
        })}

        {/* TW 中心點 */}
        <circle cx={projX(TW_CENTER.lon)} cy={projY(TW_CENTER.lat)} r={4}
                fill="#4fc3f7" stroke="white" strokeWidth={1} />
        <text x={projX(TW_CENTER.lon) + 6} y={projY(TW_CENTER.lat) + 3}
              fontFamily="ui-monospace, monospace" fontSize={9} fill="#4fc3f7">TW</text>

        {/* ground track */}
        {segments.map((d, i) => (
          <path key={i} d={d} stroke={color} strokeWidth={1.6} fill="none" opacity={0.85}
                strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
    </div>
  );
}

export function ManeuverCompareModal({ maneuver, onClose }: Props) {
  const [pair, setPair] = useState<{ prev: TleHistoryRow | null; curr: TleHistoryRow | null }>({ prev: null, curr: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchTlePair(maneuver.norad_id, maneuver.prev_epoch, maneuver.curr_epoch).then((p) => {
      if (!alive) return;
      setPair(p);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [maneuver.norad_id, maneuver.prev_epoch, maneuver.curr_epoch]);

  const eventMs = useMemo(() => new Date(maneuver.curr_fetched_at).getTime(), [maneuver.curr_fetched_at]);
  const prevTrack = useMemo(() => (pair.prev ? computeGroundTrack(pair.prev, eventMs) : null), [pair.prev, eventMs]);
  const currTrack = useMemo(() => (pair.curr ? computeGroundTrack(pair.curr, eventMs) : null), [pair.curr, eventMs]);

  const diff = useMemo(() => {
    if (!prevTrack || !currTrack) return null;
    const before = prevTrack.coveredRegions;
    const after = currTrack.coveredRegions;
    const gained: Region[] = [];
    const lost: Region[] = [];
    for (const r of TW_RELEVANT_REGIONS) {
      const wasIn = before.has(r.key);
      const nowIn = after.has(r.key);
      if (!wasIn && nowIn) gained.push(r);
      else if (wasIn && !nowIn) lost.push(r);
    }
    const twDiff = currTrack.twPasses - prevTrack.twPasses;
    const pct = prevTrack.twPasses > 0
      ? Math.round((twDiff / prevTrack.twPasses) * 100)
      : (currTrack.twPasses > 0 ? 100 : 0);
    return {
      gained,
      lost,
      twDiff,
      twBefore: prevTrack.twPasses,
      twAfter: currTrack.twPasses,
      pct,
    };
  }, [prevTrack, currTrack]);

  const token = MANEUVER_TOKEN[maneuver.maneuver_type];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 760, maxWidth: "100%", maxHeight: "92vh",
          background: COLORS.panelBg, border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 10, fontFamily: FONT_CJK, color: COLORS.textDefault,
          display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "satConsoleFadeIn .25s ease-out",
        }}
      >
        {/* header */}
        <div style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${COLORS.panelBorder}`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 4,
            background: token.soft, border: `1px solid ${token.color}66`,
            fontFamily: FONT_DATA, fontSize: 10, fontWeight: 700, color: token.color,
            animation: token.pulse ? "satManeuverPulse 1.1s ease-in-out infinite" : "none",
          }}>
            {token.icon} {token.zh}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.textStrong }}>
            {maneuver.name}
          </span>
          <span style={{ fontFamily: FONT_DATA, fontSize: 10, color: COLORS.textDim }}>
            NORAD {maneuver.norad_id}
          </span>
          <span style={{ fontFamily: FONT_DATA, fontSize: 11, color: COLORS.textDefault, marginLeft: 6 }}>
            {formatManeuverDetail(maneuver)}
          </span>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              width: 28, height: 28, borderRadius: 4, border: "none",
              background: "transparent", color: COLORS.textDim, cursor: "pointer",
              fontSize: 20, lineHeight: 1,
            }}
          >×</button>
        </div>

        <div className="mtp-scroll" style={{ flex: 1, overflowY: "auto", padding: "14px 16px 16px" }}>
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: COLORS.textFaint, fontSize: 11 }}>
              載入 TLE pair + 計算 7 天 ground track…
            </div>
          ) : !pair.prev || !pair.curr ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: COLORS.statusWarn, fontSize: 11 }}>
              tle_history 找不到對應的 prev/curr TLE（epoch 可能尚未歸檔）
            </div>
          ) : (
            <>
              {/* ── headline 過台頻次 ── */}
              {diff && <PassDiffHeadline diff={diff} />}

              {/* ── 雙 mini-map（TW-centric） ── */}
              <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
                <MiniMap track={prevTrack} prevTrack={prevTrack} label="BEFORE · 變軌前 7 天" color="#ff9800" side="before" />
                <MiniMap track={currTrack} prevTrack={prevTrack} label="AFTER · 變軌後 7 天" color="#4fc3f7" side="after" />
              </div>

              {/* ── 區域差異 chips ── */}
              {diff && (
                <div style={{ marginTop: 14 }}>
                  <RegionDiffChips gained={diff.gained} lost={diff.lost} />
                </div>
              )}

              <div style={{ marginTop: 10, fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint }}>
                顯示框：經度 {TW_FRAME.lngMin}–{TW_FRAME.lngMax}°E · 緯度 {TW_FRAME.latMin}–{TW_FRAME.latMax}°N
                ｜ 比對方法：前後兩條 TLE 跑 SGP4 7 天（10 min 步進），elevation&gt;10° 入境邊緣 = 1 次過台
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** 過台頻次 headline — 主敘事 */
function PassDiffHeadline({ diff }: { diff: { twBefore: number; twAfter: number; twDiff: number; pct: number } }) {
  const isUp = diff.twDiff > 0;
  const isDown = diff.twDiff < 0;
  const maxPasses = Math.max(diff.twBefore, diff.twAfter, 5);
  const barColor = isUp ? "#4fc3f7" : isDown ? COLORS.statusWarn : COLORS.textMuted;
  const pctColor = isUp ? "#4fc3f7" : isDown ? COLORS.statusErr : COLORS.textMuted;

  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: 8,
      background: "rgba(255,255,255,0.025)",
      border: `1px solid ${COLORS.borderSoft}`,
    }}>
      <div style={{
        fontFamily: FONT_DATA, fontSize: 9, letterSpacing: "2px",
        color: COLORS.textFaint, marginBottom: 8,
      }}>
        OVERHEAD PASSES · 過台頻次 7 天
      </div>
      <div style={{ display: "flex", alignItems: "stretch", gap: 16 }}>
        <PassBar label="BEFORE" value={diff.twBefore} max={maxPasses} color="rgba(255,152,0,0.55)" />
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minWidth: 80, gap: 2,
        }}>
          <span style={{
            fontFamily: FONT_DATA, fontSize: 22, fontWeight: 800, color: pctColor, lineHeight: 1,
          }}>
            {isUp ? "+" : ""}{diff.pct}%
          </span>
          <span style={{ fontFamily: FONT_DATA, fontSize: 10, color: COLORS.textMuted }}>
            {isUp ? "↑ 增加" : isDown ? "↓ 減少" : "持平"}
            {" "}
            {isUp || isDown ? `${Math.abs(diff.twDiff)} 次` : ""}
          </span>
        </div>
        <PassBar label="AFTER" value={diff.twAfter} max={maxPasses} color={barColor} />
      </div>
    </div>
  );
}

function PassBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontFamily: FONT_DATA, fontSize: 9, letterSpacing: "1.5px", color: COLORS.textFaint }}>
          {label}
        </span>
        <span style={{ marginLeft: "auto", fontFamily: FONT_DATA, fontSize: 18, fontWeight: 700, color: COLORS.textStrong, lineHeight: 1 }}>
          {value}
        </span>
        <span style={{ fontFamily: FONT_DATA, fontSize: 10, color: COLORS.textDim }}>次</span>
      </div>
      <div style={{ position: "relative", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.05)" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`,
          background: color, borderRadius: 4, transition: "width 0.3s ease",
        }} />
      </div>
    </div>
  );
}

/** 區域差異 chips（含 in-frame + off-frame 邊緣提示） */
function RegionDiffChips({ gained, lost }: { gained: Region[]; lost: Region[] }) {
  const gainedInFrame = gained.filter((r) => FRAME_REGIONS.includes(r));
  const gainedOff = gained.filter((r) => !FRAME_REGIONS.includes(r));
  const lostInFrame = lost.filter((r) => FRAME_REGIONS.includes(r));
  const lostOff = lost.filter((r) => !FRAME_REGIONS.includes(r));

  if (gained.length === 0 && lost.length === 0) {
    return (
      <div style={{ fontFamily: FONT_CJK, fontSize: 11, color: COLORS.textFaint, padding: "4px 0" }}>
        7 天內覆蓋區域無實質差異（軌道平面微移，bbox 命中不變）
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      {gained.length > 0 && (
        <>
          <span style={{ fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint, letterSpacing: "1.5px" }}>
            新增覆蓋
          </span>
          {gainedInFrame.map((r) => (
            <Chip key={r.key} color="#22c55e" zh={r.zh} prefix="+" />
          ))}
          {gainedOff.map((r) => (
            <Chip key={r.key} color="#22c55e" zh={r.zh} prefix="+" offFrame />
          ))}
        </>
      )}
      {lost.length > 0 && (
        <>
          {gained.length > 0 && <span style={{ color: COLORS.borderMid }}>·</span>}
          <span style={{ fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint, letterSpacing: "1.5px" }}>
            失去覆蓋
          </span>
          {lostInFrame.map((r) => (
            <Chip key={r.key} color={COLORS.statusErr} zh={r.zh} prefix="−" />
          ))}
          {lostOff.map((r) => (
            <Chip key={r.key} color={COLORS.statusErr} zh={r.zh} prefix="−" offFrame />
          ))}
        </>
      )}
    </div>
  );
}

function Chip({ color, zh, prefix, offFrame }: { color: string; zh: string; prefix: string; offFrame?: boolean }) {
  return (
    <span
      title={offFrame ? "顯示框外（北方）" : undefined}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        padding: "2px 7px",
        borderRadius: 4,
        background: `${color}22`,
        border: `1px solid ${color}66`,
        fontFamily: FONT_CJK,
        fontSize: 11,
        color,
        opacity: offFrame ? 0.75 : 1,
      }}
    >
      <span style={{ fontWeight: 700 }}>{prefix}</span>
      {zh}
      {offFrame && <span style={{ fontSize: 9, opacity: 0.8 }}>(框外)</span>}
    </span>
  );
}
