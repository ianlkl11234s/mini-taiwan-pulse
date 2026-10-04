/**
 * §F 變軌前後覆蓋對比 modal（P4：§5.27 置中視窗）
 *
 * - 一張地圖疊兩條軌跡（橘＝變軌前、藍＝變軌後）；手機改底部 sheet＋分段控制切換單一軌道
 * - 主敘事：文字「變軌前 N 次 → 變軌後 M 次」＋增減徽章（不畫柱）
 * - mini-map 統一框到 TW 區域（lng 108–145, lat 5–35），SVG 隨容器寬縮放
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
import { RADIUS, FONT_SIZE, SURFACE, Z_INDEX } from "../../styles/designTokens";
import { chipOutline } from "../intel/intelTokens";
import { PanelHeader } from "../sidebar/PanelHeader";
import { ControlSegmented, layerControlThemeClass } from "../sidebar/LayerParamControls";
import { LegendRow, SwatchDot, SwatchLine, SwatchSquare } from "../legend/legendKit";
import { useIsMobile } from "../../hooks/useIsMobile";
import { SEVERITY_VIEW } from "./maneuverAlertKit";
import { fetchTlePair, type TleHistoryRow, type TlePair } from "../../data/satelliteHistoryLoader";
import { formatManeuverDetail, getManeuverSeverity, type ManeuverRow } from "../../data/satelliteManeuversLoader";
import { computePassDiff } from "../../data/satelliteDataState";

interface Props {
  maneuver: ManeuverRow;
  onClose: () => void;
}

/** 軌跡色（資料色，兩主題不變）：變軌前＝橘（同 statusWarn）、變軌後＝台灣資料色藍 */
const TRACK_BEFORE = COLORS.statusWarn;
const TRACK_AFTER = "#4fc3f7";

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


type MapMode = "before" | "after" | "both";

const MAP_W = 320;
const MAP_H = 260;
const GAINED = { fill: "rgba(34,197,94,0.22)", stroke: "rgba(34,197,94,0.75)" };
const LOST = { fill: "rgba(239,68,68,0.22)", stroke: "rgba(239,68,68,0.75)" };
const SAME = { fill: "rgba(255,255,255,0.04)", stroke: "rgba(255,255,255,0.18)" };

interface MiniMapProps {
  before: GroundTrack;
  after: GroundTrack;
  mode: MapMode;
}

/** 軌跡切成「進框 → 離框」的線段（避免框外無關線段） */
function trackSegments(track: GroundTrack): string[] {
  const inFrame = (lon: number, lat: number) =>
    lon >= TW_FRAME.lngMin && lon <= TW_FRAME.lngMax &&
    lat >= TW_FRAME.latMin && lat <= TW_FRAME.latMax;
  const projX = (lon: number) => ((lon - TW_FRAME.lngMin) / (TW_FRAME.lngMax - TW_FRAME.lngMin)) * MAP_W;
  const projY = (lat: number) => ((TW_FRAME.latMax - lat) / (TW_FRAME.latMax - TW_FRAME.latMin)) * MAP_H;
  const segs: string[] = [];
  let cur = "";
  let prevIn = false;
  for (const p of track.points) {
    if (!inFrame(p.lon, p.lat)) {
      if (cur) { segs.push(cur); cur = ""; }
      prevIn = false;
      continue;
    }
    cur += (prevIn ? "L" : "M") + `${projX(p.lon).toFixed(1)},${projY(p.lat).toFixed(1)}`;
    prevIn = true;
  }
  if (cur) segs.push(cur);
  return segs;
}

function MiniMap({ before, after, mode }: MiniMapProps) {
  const projX = (lon: number) => ((lon - TW_FRAME.lngMin) / (TW_FRAME.lngMax - TW_FRAME.lngMin)) * MAP_W;
  const projY = (lat: number) => ((TW_FRAME.latMax - lat) / (TW_FRAME.latMax - TW_FRAME.latMin)) * MAP_H;

  const beforeSegs = useMemo(() => trackSegments(before), [before]);
  const afterSegs = useMemo(() => trackSegments(after), [after]);

  // region bbox 上色：新增覆蓋（綠）／失去覆蓋（紅）／不變；單側顯示時另一側的變化畫淡
  const regionColors = useMemo(() => {
    const m = new Map<string, { fill: string; stroke: string; faint?: boolean }>();
    for (const r of FRAME_REGIONS) {
      const wasIn = before.coveredRegions.has(r.key);
      const nowIn = after.coveredRegions.has(r.key);
      if (!wasIn && nowIn) m.set(r.key, { ...GAINED, faint: mode === "before" });
      else if (wasIn && !nowIn) m.set(r.key, { ...LOST, faint: mode === "after" });
      else if (wasIn && nowIn) m.set(r.key, SAME);
    }
    return m;
  }, [before, after, mode]);

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      role="img"
      aria-label="台灣周邊衛星軌跡示意地圖"
      style={{ width: "100%", height: "auto", display: "block", background: "#0b0f14", border: `1px solid ${COLORS.borderSoft}`, borderRadius: RADIUS.lg }}
    >
      {/* 經緯線（每 5°） */}
      {Array.from({ length: 8 }).map((_, i) => {
        const lng = TW_FRAME.lngMin + i * 5;
        if (lng > TW_FRAME.lngMax) return null;
        const x = projX(lng);
        return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={MAP_H} stroke="rgba(255,255,255,0.04)" />;
      })}
      {Array.from({ length: 7 }).map((_, i) => {
        const lat = TW_FRAME.latMin + i * 5;
        if (lat > TW_FRAME.latMax) return null;
        const y = projY(lat);
        return <line key={`h${i}`} x1={0} y1={y} x2={MAP_W} y2={y} stroke="rgba(255,255,255,0.04)" />;
      })}

      {/* region bbox */}
      {FRAME_REGIONS.map((r) => {
        const rc = regionColors.get(r.key);
        if (!rc) return null;
        const [w, s, e, n] = r.bbox;
        const x = projX(w);
        const y = projY(n);
        return (
          <rect key={r.key} x={x} y={y} width={Math.max(2, projX(e) - x)} height={Math.max(2, projY(s) - y)}
                fill={rc.fill} stroke={rc.stroke} strokeWidth={1} rx={1.5} opacity={rc.faint ? 0.45 : 1} />
        );
      })}

      {/* TW 中心點 */}
      <circle cx={projX(TW_CENTER.lon)} cy={projY(TW_CENTER.lat)} r={4} fill={TRACK_AFTER} stroke="white" strokeWidth={1} />
      <text x={projX(TW_CENTER.lon) + 7} y={projY(TW_CENTER.lat) + 3} fontFamily={FONT_CJK} fontSize={9} fill={TRACK_AFTER}>台灣</text>

      {/* ground track */}
      {mode !== "after" && beforeSegs.map((d, i) => (
        <path key={`b${i}`} d={d} stroke={TRACK_BEFORE} strokeWidth={1.6} fill="none" opacity={0.85} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {mode !== "before" && afterSegs.map((d, i) => (
        <path key={`a${i}`} d={d} stroke={TRACK_AFTER} strokeWidth={1.6} fill="none" opacity={0.85} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

export function ManeuverCompareModal({ maneuver, onClose }: Props) {
  const isMobile = useIsMobile().isMobile;
  const [pair, setPair] = useState<TlePair>({ prev: null, curr: null, error: null });
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState<"before" | "after">("before");

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

  // §5.27：Esc 關閉
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const eventMs = useMemo(() => new Date(maneuver.curr_fetched_at).getTime(), [maneuver.curr_fetched_at]);
  const prevTrack = useMemo(() => (pair.prev ? computeGroundTrack(pair.prev, eventMs) : null), [pair.prev, eventMs]);
  const currTrack = useMemo(() => (pair.curr ? computeGroundTrack(pair.curr, eventMs) : null), [pair.curr, eventMs]);

  const diff = useMemo(() => {
    if (!prevTrack || !currTrack) return null;
    const gained: Region[] = [];
    const lost: Region[] = [];
    for (const r of TW_RELEVANT_REGIONS) {
      const wasIn = prevTrack.coveredRegions.has(r.key);
      const nowIn = currTrack.coveredRegions.has(r.key);
      if (!wasIn && nowIn) gained.push(r);
      else if (wasIn && !nowIn) lost.push(r);
    }
    const { diff: twDiff, pct } = computePassDiff(prevTrack.twPasses, currTrack.twPasses);
    return { gained, lost, twDiff, twBefore: prevTrack.twPasses, twAfter: currTrack.twPasses, pct };
  }, [prevTrack, currTrack]);

  const token = MANEUVER_TOKEN[maneuver.maneuver_type];
  const sev = SEVERITY_VIEW[getManeuverSeverity(maneuver)];
  const centerState = (color: string, text: string) => (
    <div role="status" style={{ padding: "20px 0", textAlign: "center", color, fontSize: FONT_SIZE.base }}>{text}</div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: Z_INDEX.modal, display: "flex",
        alignItems: isMobile ? "flex-end" : "center", justifyContent: "center",
        background: "rgba(0,0,0,0.8)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${maneuver.name} 變軌覆蓋變化`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? "100vw" : "min(560px, 92vw)",
          maxHeight: isMobile ? "92vh" : "92vh",
          height: isMobile ? "92vh" : undefined,
          background: SURFACE.solid,
          border: isMobile ? "none" : `1px solid ${COLORS.panelBorder}`,
          borderRadius: isMobile ? "16px 16px 0 0" : RADIUS.xl,
          fontFamily: FONT_CJK, color: COLORS.textDefault,
          display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "satConsoleFadeIn .25s ease-out",
        }}
      >
        <PanelHeader
          eyebrow="變軌 · 覆蓋變化"
          title={maneuver.name}
          onClose={onClose}
          borderColor={COLORS.panelBorder}
          mutedColor={COLORS.textDim}
          textColor={COLORS.textStrong}
        />

        <div className="mtp-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 副標：嚴重度、類型、變化量、衛星編號 */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontSize: FONT_SIZE.sm, color: COLORS.textDim }}>
            <span style={{ ...chipOutline(sev.color), padding: "2px 5px", borderRadius: 3, lineHeight: 1.2, whiteSpace: "nowrap" }}>{sev.zh}</span>
            <span style={{ color: COLORS.textMuted }}>{token.zh}</span>
            <span style={{ fontSize: FONT_SIZE.base, color: COLORS.textDefault }}>
              <MonoNums text={formatManeuverDetail(maneuver)} />
            </span>
            <span title="NORAD 編號" style={{ whiteSpace: "nowrap" }}>
              衛星編號 <span style={{ fontFamily: FONT_DATA }}>{maneuver.norad_id}</span>
            </span>
          </div>

          {loading ? centerState(COLORS.textFaint, "載入變軌前後軌道並推算中…")
            : pair.error ? centerState(COLORS.statusErr, pair.error === "unconfigured" ? "資料讀取失敗：未設定資料來源" : "歷史軌道資料讀取失敗，請稍後再試")
            : !pair.prev || !pair.curr ? centerState(COLORS.statusWarn, "歷史軌道資料中找不到這次變軌前／後的紀錄（可能尚未歸檔）")
            : !prevTrack || !currTrack ? centerState(COLORS.statusWarn, "軌道資料無法解析，無法推算過台次數")
            : (
              <>
                {diff && <PassDiffHeadline diff={diff} />}

                {isMobile && (
                  <div className={layerControlThemeClass(true)}>
                    <ControlSegmented
                      label="選擇軌道"
                      value={side}
                      options={[{ label: "變軌前", value: "before" }, { label: "變軌後", value: "after" }]}
                      onChange={(v) => setSide(v === "after" ? "after" : "before")}
                    />
                  </div>
                )}

                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4, fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
                    <span>{isMobile ? (side === "before" ? "變軌前軌道" : "變軌後軌道") : "變軌前、後軌跡疊在同一張"}</span>
                    <span style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
                      {isMobile
                        ? <>過境 <span style={{ fontFamily: FONT_DATA, color: COLORS.textStrong, fontWeight: 600 }}>{side === "before" ? prevTrack.twPasses : currTrack.twPasses}</span> 次</>
                        : <>過境 <span style={{ fontFamily: FONT_DATA, color: COLORS.textStrong, fontWeight: 600 }}>{prevTrack.twPasses} → {currTrack.twPasses}</span> 次</>}
                    </span>
                  </div>
                  <MiniMap before={prevTrack} after={currTrack} mode={isMobile ? side : "both"} />
                </div>

                <MapLegend mode={isMobile ? side : "both"} />

                {diff && <RegionDiffChips gained={diff.gained} lost={diff.lost} />}

                <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, lineHeight: 1.5 }}>
                  顯示範圍：東經 <Mono>{TW_FRAME.lngMin}–{TW_FRAME.lngMax}°</Mono>、北緯 <Mono>{TW_FRAME.latMin}–{TW_FRAME.latMax}°</Mono>
                  {" "}· 以變軌前、後兩組軌道各推算 <Mono>7</Mono> 天（每 <Mono>10</Mono> 分鐘一點），仰角 <Mono>10°</Mono> 以上進入台灣上空算一次過境
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{children}</span>;
}

/** 文字中的數字片段轉等寬（例「傾角 +0.14°」） */
function MonoNums({ text }: { text: string }) {
  return (
    <>
      {text.split(/([+\-−]?\d[\d.]*(?:e[+-]?\d+)?)/i).filter(Boolean).map((part, i) =>
        /\d/.test(part) ? <Mono key={i}>{part}</Mono> : <span key={i}>{part}</span>)}
    </>
  );
}

function MapLegend({ mode }: { mode: MapMode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
      {mode !== "after" && <LegendRow swatch={<SwatchLine color={TRACK_BEFORE} width={2} />}>變軌前軌跡</LegendRow>}
      {mode !== "before" && <LegendRow swatch={<SwatchLine color={TRACK_AFTER} width={2} />}>變軌後軌跡</LegendRow>}
      <LegendRow swatch={<SwatchDot color={TRACK_AFTER} />}>台灣</LegendRow>
      <LegendRow swatch={<SwatchSquare color={COLORS.statusLive} />}>新增覆蓋</LegendRow>
      <LegendRow swatch={<SwatchSquare color={COLORS.statusErr} />}>失去覆蓋</LegendRow>
    </div>
  );
}

/** 過台頻次 headline：只用文字（不畫柱） */
function PassDiffHeadline({ diff }: { diff: { twBefore: number; twAfter: number; twDiff: number; pct: number | null } }) {
  const changed = diff.twDiff !== 0;
  const abs = Math.abs(diff.twDiff);
  const label = !changed
    ? "次數不變"
    : `${diff.twDiff > 0 ? "增加" : "減少"} ${abs} 次`;
  const pctText = changed && diff.pct != null ? `（${diff.pct > 0 ? "+" : "−"}${Math.abs(diff.pct)}%）` : "";
  const big = { fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", fontSize: FONT_SIZE.xl, fontWeight: 700, color: COLORS.textStrong } as const;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: 8 }}>
        台灣上空過境次數 · 以變軌前／後軌道推算未來 7 天
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", fontSize: FONT_SIZE.base, color: COLORS.textMuted }}>
        <span style={{ whiteSpace: "nowrap" }}>變軌前 <span style={big}>{diff.twBefore}</span> 次</span>
        <span style={{ color: COLORS.textDim }}>→</span>
        <span style={{ whiteSpace: "nowrap" }}>變軌後 <span style={big}>{diff.twAfter}</span> 次</span>
        <span style={{
          ...chipOutline(changed ? COLORS.statusWarn : COLORS.textMuted),
          marginLeft: "auto", padding: "2px 5px", borderRadius: 3, fontSize: FONT_SIZE.sm, lineHeight: 1.2, whiteSpace: "nowrap",
        }}>
          {label}{pctText && <Mono>{pctText}</Mono>}
        </span>
      </div>
    </div>
  );
}

/** 區域差異 chips（含 in-frame + off-frame 邊緣提示） */
function RegionDiffChips({ gained, lost }: { gained: Region[]; lost: Region[] }) {
  if (gained.length === 0 && lost.length === 0) {
    return (
      <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim }}>
        7 天內覆蓋區域無實質差異（軌道平面微移，bbox 命中不變）
      </div>
    );
  }
  const label = { fontSize: FONT_SIZE.sm, color: COLORS.textMuted } as const;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      {gained.length > 0 && (
        <>
          <span style={label}>新增覆蓋</span>
          {gained.map((r) => <Chip key={r.key} color={COLORS.statusLive} region={r} prefix="+" />)}
        </>
      )}
      {lost.length > 0 && (
        <>
          {gained.length > 0 && <span style={{ color: COLORS.textFaint }}>·</span>}
          <span style={label}>失去覆蓋</span>
          {lost.map((r) => <Chip key={r.key} color={COLORS.statusErr} region={r} prefix="−" />)}
        </>
      )}
    </div>
  );
}

function Chip({ color, region, prefix }: { color: string; region: Region; prefix: string }) {
  const offFrame = !FRAME_REGIONS.includes(region);
  return (
    <span
      title={offFrame ? "顯示範圍外（北方）" : undefined}
      style={{
        ...chipOutline(color),
        display: "inline-flex", alignItems: "center", gap: 3,
        padding: "2px 5px", borderRadius: 3, fontSize: FONT_SIZE.sm, lineHeight: 1.2,
        opacity: offFrame ? 0.75 : 1,
      }}
    >
      <span style={{ fontWeight: 700 }}>{prefix}</span>
      {region.zh}
      {offFrame && <span style={{ fontSize: FONT_SIZE.xs, opacity: 0.8 }}>（範圍外）</span>}
    </span>
  );
}
