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
import { useEffect, useMemo, useState, type ReactNode } from "react";
import * as satellite from "satellite.js";
import { COLORS, FONT_CJK, FONT_DATA } from "./satelliteConsoleTokens";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useSatelliteRecords } from "../../hooks/useSatelliteRecords";
import { deriveFleetView } from "../../data/satelliteDataState";
import type { SatelliteRecord } from "../../data/satelliteTypes";
import { localeForTaiwanSat } from "../../data/satelliteTaiwanLocale";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";
import { LocateFixed, BookOpen } from "lucide-react";
import { chipOutline } from "../intel/intelTokens";
import { SATELLITE_COLORS } from "../../data/satelliteTypes";
import { SubGroupLabel } from "../sidebar/ThemeBanner";
import { DARK_PALETTE, RailThemeContext } from "../sidebar/railTheme";
import { useTimeStoreTime } from "../../hooks/useTimeStoreTime";

interface Props {
  maneuvers: ManeuverRow[];
  onSelectNorad: (n: number) => void;
  onFlyTo?: (lon: number, lat: number) => void;
}

/** 台灣衛星資料色（§3.16：只用在名稱前狀態點與覆蓋中文字） */
const TAIWAN_COLOR = SATELLITE_COLORS.taiwan;

// §5.21 狀態徽章：chipOutline，圓角 3、10px
const CHIP_BASE = {
  display: "inline-flex", alignItems: "center", padding: "2px 5px", borderRadius: 3,
  fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, lineHeight: 1.2, whiteSpace: "nowrap", flexShrink: 0,
} as const;

/** §5.15 小型圖示按鈕：20×20、RADIUS.md、hover 出底；必有 title 與 aria-label */
function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.borderSoft; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      style={{
        width: 20, height: 20, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: "none", borderRadius: RADIUS.md, background: "transparent", color: COLORS.textStrong, cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
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
  const tle = useSatelliteRecords();
  // null = TLE 已到但還沒解析完（仍視為載入中）
  const [parsedRaw, setParsed] = useState<ParsedSat[] | null>(null);
  const parsed = parsedRaw ?? [];
  // TLE 目錄中的台灣衛星總數（含解析失敗者），用來算「N 顆暫無法計算」
  const twTotal = useMemo(() => tle.records.filter((r) => r.category === "taiwan").length, [tle.records]);
  // 訂閱 timeStore — 拉時間軸時整個 panel 重算位置
  const timelineSec = useTimeStoreTime(250);

  // 1 次性載入 + parse
  useEffect(() => {
    if (tle.status !== "ok") return;
    const tw = tle.records.filter((r) => r.category === "taiwan");
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
  }, [tle.status, tle.records]);

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

  const view = deriveFleetView(tle.status === "ok" && parsedRaw == null ? "loading" : tle.status, twTotal, rows.length);
  if (view.kind !== "ready") {
    return (
      <div role="status" style={{
        padding: "12px 14px", borderBottom: `1px solid ${COLORS.borderSoft}`, fontFamily: FONT_CJK, fontSize: FONT_SIZE.base,
        color: view.kind === "error" ? COLORS.statusWarn : COLORS.textFaint,
      }}>
        {view.text}
      </div>
    );
  }

  return (
    <div style={{ borderBottom: `1px solid ${COLORS.borderSoft}` }}>
      <RailThemeContext.Provider value={DARK_PALETTE}>
        <SubGroupLabel>台灣衛星隊</SubGroupLabel>
      </RailThemeContext.Provider>
      {view.skipped > 0 && (
        <div style={{ padding: "0 12px 4px", fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textDim }}>
          <span style={{ fontFamily: FONT_DATA }}>{view.skipped}</span> 顆暫無法計算
        </div>
      )}

      <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column" }}>
        {rows.map((r) => {
          const isCovering = r.nextPassMin === 0;
          const isLegacy = r.tier === "legacy";
          return (
            <div
              key={r.norad}
              style={{
                padding: "7px 2px 8px",
                borderTop: `1px solid ${COLORS.borderSoft}`,
                fontFamily: FONT_CJK,
                cursor: "pointer",
              }}
              onClick={() => onSelectNorad(r.norad)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span
                  title={isCovering ? "正覆蓋台灣" : undefined}
                  style={{
                    width: 7, height: 7, borderRadius: RADIUS.full, flexShrink: 0, boxSizing: "border-box",
                    ...(isCovering ? { background: TAIWAN_COLOR } : { border: `1px solid ${COLORS.textDim}` }),
                  }}
                />
                <span style={{ fontSize: FONT_SIZE.md, fontWeight: 700, color: COLORS.textStrong, whiteSpace: "nowrap" }}>{r.zh}</span>
                <span style={{
                  fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textDim,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
                }}>
                  {r.name}
                </span>
                {isLegacy && <span style={{ ...CHIP_BASE, ...chipOutline(COLORS.statusWarn) }}>超齡服役</span>}
                {r.tier === "research" && <span style={{ ...CHIP_BASE, ...chipOutline(COLORS.textMuted) }}>學研</span>}
                <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4, flexShrink: 0 }}>
                  <IconBtn title="飛到衛星" onClick={() => onFlyTo?.(r.lon, r.lat)}>
                    <LocateFixed size={13} strokeWidth={2} aria-hidden="true" />
                  </IconBtn>
                  <IconBtn title="開啟衛星百科" onClick={() => onSelectNorad(r.norad)}>
                    <BookOpen size={13} strokeWidth={2} aria-hidden="true" />
                  </IconBtn>
                </span>
              </div>

              <div style={{ marginTop: 3, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 8px", fontSize: FONT_SIZE.base, color: COLORS.textMuted }}>
                <span style={{ whiteSpace: "nowrap" }}>{r.use}</span>
                <span style={{ color: COLORS.textFaint }}>·</span>
                <span style={{ whiteSpace: "nowrap" }}><span style={{ fontFamily: FONT_DATA }}>{Math.round(r.altKm)}</span> km</span>
                <span style={{ color: COLORS.textFaint }}>·</span>
                <span style={{ whiteSpace: "nowrap", fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>
                  NORAD 編號 <span style={{ fontFamily: FONT_DATA }}>{r.norad}</span>
                </span>
              </div>

              <div style={{
                marginTop: 2, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 8px",
                fontSize: FONT_SIZE.sm, color: COLORS.textMuted,
              }}>
                <span style={{ fontFamily: FONT_DATA, whiteSpace: "nowrap" }}>{r.lat.toFixed(1)}°{r.lat >= 0 ? "N" : "S"} {Math.abs(r.lon).toFixed(1)}°{r.lon >= 0 ? "E" : "W"}</span>
                <span style={{ color: COLORS.textFaint }}>·</span>
                <span style={{ whiteSpace: "nowrap", color: isCovering ? TAIWAN_COLOR : COLORS.textDefault, fontWeight: isCovering ? 600 : 400 }}>
                  {isCovering
                    ? "正覆蓋台灣"
                    : r.nextPassMin == null
                      ? "12 小時內不會經過"
                      : <><span style={{ fontFamily: FONT_DATA }}>{r.nextPassMin}</span> 分鐘後過台</>}
                </span>
                {r.daysSinceManeuver != null && (
                  <>
                    <span style={{ color: COLORS.textFaint }}>·</span>
                    <span style={{ whiteSpace: "nowrap" }}>距上次變軌 <span style={{ fontFamily: FONT_DATA }}>{r.daysSinceManeuver}</span> 天</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
