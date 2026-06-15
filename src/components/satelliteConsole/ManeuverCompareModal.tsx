/**
 * §F 變軌前後覆蓋對比 modal
 *
 * 點變軌警報「覆蓋變化」→ 開啟此 modal
 * 左右兩張 SVG mini-map：變軌前 7 天 ground track vs 變軌後 7 天 ground track
 * 下方差異摘要：新增 / 失去覆蓋區域、過台頻次差
 *
 * 資料：
 * - get_satellite_tle_pair(norad, prev_epoch, curr_epoch)
 * - 用 satellite.js SGP4 propagate 7 天（10 min 步進）
 * - 區域命中 = ground track 經過該 bbox 至少 1 次
 * - 過台頻次差 = scan 7 天 elevation>10° 邊緣事件數
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

interface Region {
  key: string;
  zh: string;
  bbox: [number, number, number, number]; // [west, south, east, north]
}

/** TW 關聯區域（給「新增 / 失去覆蓋」比對用） */
const TW_RELEVANT_REGIONS: Region[] = [
  { key: "tw",       zh: "台灣本島",       bbox: [120.0, 21.8, 122.0, 25.3] },
  { key: "okinawa",  zh: "日本沖繩",       bbox: [123.0, 24.0, 130.0, 28.5] },
  { key: "luzon_n",  zh: "菲律賓呂宋北部", bbox: [119.5, 16.0, 122.5, 18.7] },
  { key: "south_china_sea", zh: "南海北部", bbox: [114.0, 16.0, 120.0, 22.0] },
  { key: "east_china_sea",  zh: "東海", bbox: [122.0, 28.0, 128.0, 33.0] },
  { key: "japan_main", zh: "日本本州", bbox: [130.0, 33.0, 142.0, 41.0] },
  { key: "korea",    zh: "朝鮮半島",       bbox: [124.5, 33.0, 130.5, 41.0] },
  { key: "dongsha",  zh: "東沙群島",       bbox: [116.5, 20.4, 117.0, 20.9] },
  { key: "bashi",    zh: "巴士海峽",       bbox: [120.5, 20.5, 122.0, 21.7] },
  { key: "lanyu",    zh: "蘭嶼",           bbox: [121.4, 21.9, 121.7, 22.1] },
  { key: "aleutian", zh: "阿留申群島",     bbox: [170.0, 51.0, 195.0, 55.0] },
  { key: "alaska_w", zh: "阿拉斯加西部",   bbox: [-170.0, 56.0, -150.0, 71.0] },
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

function computeGroundTrack(row: TleHistoryRow): GroundTrack | null {
  if (!row.tle_line1 || !row.tle_line2) return null;
  let satrec: satellite.SatRec;
  try {
    satrec = satellite.twoline2satrec(row.tle_line1, row.tle_line2);
  } catch {
    return null;
  }

  const start = Date.now();
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

      // 區域命中
      for (const r of TW_RELEVANT_REGIONS) {
        const [w, s, e, n] = r.bbox;
        // 處理跨越 antimeridian 的 bbox（w > e）
        const inLon = w <= e ? (lon >= w && lon <= e) : (lon >= w || lon <= e);
        if (inLon && lat >= s && lat <= n) coveredRegions.add(r.key);
      }

      // TW 過境計數（elevation>10°）
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

function MiniMap({
  track, label, color, width = 320, height = 200,
}: { track: GroundTrack | null; label: string; color: string; width?: number; height?: number }) {
  const path = useMemo(() => {
    if (!track) return [];
    // 用簡單 Mercator-ish 投影（lon 直接映射，lat 截斷）
    const segs: string[] = [];
    let cur = "";
    let prevX = -1;
    for (const p of track.points) {
      const x = ((p.lon + 180) / 360) * width;
      const y = ((90 - p.lat) / 180) * height;
      if (prevX >= 0 && Math.abs(x - prevX) > width * 0.5) {
        // antimeridian wrap — 斷開
        if (cur) segs.push(cur);
        cur = `M${x.toFixed(1)},${y.toFixed(1)}`;
      } else {
        cur += (cur ? "L" : "M") + `${x.toFixed(1)},${y.toFixed(1)}`;
      }
      prevX = x;
    }
    if (cur) segs.push(cur);
    return segs;
  }, [track, width, height]);

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <span style={{ fontFamily: FONT_DATA, fontSize: 9.5, letterSpacing: "1.5px", color: COLORS.textMuted }}>
          {label}
        </span>
        {track && (
          <span style={{ marginLeft: "auto", fontFamily: FONT_DATA, fontSize: 9.5, color: COLORS.textFaint }}>
            過台 {track.twPasses} 次 / 7d
          </span>
        )}
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
           style={{ background: "#0b0f14", border: `1px solid ${COLORS.borderSoft}`, borderRadius: 6, display: "block" }}>
        {/* 等高線：簡單赤道 + TW 點 */}
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.05)" />
        <line x1={width / 2} y1={0} x2={width / 2} y2={height} stroke="rgba(255,255,255,0.05)" />
        {/* TW 標記 */}
        <circle
          cx={((TW_CENTER.lon + 180) / 360) * width}
          cy={((90 - TW_CENTER.lat) / 180) * height}
          r={3}
          fill="#4fc3f7"
          stroke="white"
          strokeWidth={0.5}
        />
        {/* ground track */}
        {path.map((d, i) => (
          <path key={i} d={d} stroke={color} strokeWidth={0.9} fill="none" opacity={0.7} />
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

  const prevTrack = useMemo(() => (pair.prev ? computeGroundTrack(pair.prev) : null), [pair.prev]);
  const currTrack = useMemo(() => (pair.curr ? computeGroundTrack(pair.curr) : null), [pair.curr]);

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
    return {
      gained,
      lost,
      twDiff: currTrack.twPasses - prevTrack.twPasses,
      twBefore: prevTrack.twPasses,
      twAfter: currTrack.twPasses,
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
          width: 800, maxWidth: "100%", maxHeight: "92vh",
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

        <div className="mtp-scroll" style={{ flex: 1, overflowY: "auto", padding: 16 }}>
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
              {/* 兩張 mini-map */}
              <div style={{ display: "flex", gap: 14 }}>
                <MiniMap track={prevTrack} label="BEFORE · 變軌前" color="#ff9800" />
                <MiniMap track={currTrack} label="AFTER · 變軌後" color="#4fc3f7" />
              </div>

              {/* diff 摘要 */}
              {diff && (
                <div style={{ marginTop: 18, padding: 12, borderRadius: 6, background: "rgba(0,0,0,0.3)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                    <div>
                      <div style={{ fontFamily: FONT_DATA, fontSize: 9, letterSpacing: "1.5px", color: COLORS.textFaint, marginBottom: 5 }}>
                        新增覆蓋
                      </div>
                      {diff.gained.length === 0 ? (
                        <div style={{ fontSize: 11, color: COLORS.textFaint }}>—</div>
                      ) : diff.gained.map((r) => (
                        <div key={r.key} style={{ fontSize: 11.5, color: "#4fc3f7", padding: "1px 0" }}>+ {r.zh}</div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontFamily: FONT_DATA, fontSize: 9, letterSpacing: "1.5px", color: COLORS.textFaint, marginBottom: 5 }}>
                        失去覆蓋
                      </div>
                      {diff.lost.length === 0 ? (
                        <div style={{ fontSize: 11, color: COLORS.textFaint }}>—</div>
                      ) : diff.lost.map((r) => (
                        <div key={r.key} style={{ fontSize: 11.5, color: COLORS.statusWarn, padding: "1px 0" }}>− {r.zh}</div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontFamily: FONT_DATA, fontSize: 9, letterSpacing: "1.5px", color: COLORS.textFaint, marginBottom: 5 }}>
                        過台頻次（7 天）
                      </div>
                      <div style={{ fontFamily: FONT_DATA, fontSize: 11.5, color: COLORS.textDefault }}>
                        {diff.twBefore} → {diff.twAfter}
                        <span style={{
                          marginLeft: 6,
                          fontWeight: 700,
                          color: diff.twDiff === 0 ? COLORS.textMuted : diff.twDiff > 0 ? "#4fc3f7" : COLORS.statusWarn,
                        }}>
                          ({diff.twDiff > 0 ? "+" : ""}{diff.twDiff})
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint }}>
                    比對方法：前後兩條 TLE 各跑 SGP4 7 天（10 min 步進）→ 命中 {TW_RELEVANT_REGIONS.length} 個 TW 關聯區域 + elevation&gt;10° 入境邊緣 = 1 次過台
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
