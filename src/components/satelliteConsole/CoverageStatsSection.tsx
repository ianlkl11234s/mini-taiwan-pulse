/**
 * §D 即時統計列
 *
 * - 覆蓋台灣中：N 顆（即時 SGP4 計算每秒掃所有 loaded sat）
 * - 未來 6h 預計通過：M 次（每分鐘步進 12h，避免太短漏判）
 * - 可展開通過時間：橫向 6h 軸，每顆衛星 pass 時刻 tick
 *
 * 計算成本：N=350 顆 × 360 步 = 126k SGP4 呼叫，~150ms 一次
 * 為避免 toggle 一次重算一次，cache 5 min；showAllOrbits 變化才重算
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import * as satellite from "satellite.js";
import { FONT_CJK, FONT_DATA } from "./satelliteConsoleTokens";
import { useSatelliteTheme } from "./satelliteTheme";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useSatelliteRecords } from "../../hooks/useSatelliteRecords";
import type { SatelliteRecord } from "../../data/satelliteTypes";
import { SATELLITE_COLORS } from "../../data/satelliteTypes";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";
import { ChevronRight } from "lucide-react";
import { chipOutline } from "../intel/intelTokens";
import { ControlSegmented, layerControlThemeClass } from "../sidebar/LayerParamControls";
import { SubGroupLabel } from "../sidebar/ThemeBanner";
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
/** 台灣衛星資料色（§3.16：只用在覆蓋台灣的數字與細項） */
const TAIWAN_COLOR = SATELLITE_COLORS.taiwan;
const AXIS_LABELS = ["現在", "+1", "+2", "+3", "+4", "+5", "+6 小時"];
// §5.21 狀態徽章：chipOutline，圓角 3、10px
const MANEUVER_CHIP = {
  display: "inline-flex", alignItems: "center", padding: "0 4px", borderRadius: 3,
  fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, lineHeight: 1.4, flexShrink: 0,
} as const;

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
  // null = 尚未算出（顯示「—」／「…」，不可當 0）
  const tle = useSatelliteRecords();
  const { p, fill, text } = useSatelliteTheme();
  const [parsed, setParsed] = useState<ParsedSat[] | null>(null);
  const [coveringRaw, setCoveringNow] = useState<ParsedSat[] | null>(null);
  const [passesRaw, setPasses] = useState<PassTick[] | null>(null);
  const coveringNow = coveringRaw ?? [];
  const passes = passesRaw ?? [];
  const [expanded, setExpanded] = useState(false);
  const [computingScan, setComputingScan] = useState(false);
  // 預設只看「遙測偵察」（Yaogan/Jilin/Gaofen + TW）
  const [reconOnly, setReconOnly] = useState(true);
  // 訂閱時間軸 — 「現在覆蓋」與 6h scan 起點都跟著走
  const timelineSec = useTimeStoreTime(500);

  useEffect(() => {
    if (tle.status !== "ok") return;
    const out: ParsedSat[] = [];
    for (const r of tle.records) {
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
  }, [tle.status, tle.records]);

  // 依時間軸算「該時刻覆蓋中」— timelineSec 變動就重算
  useEffect(() => {
    if (!parsed) return;
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
    if (!parsed) return;
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

  // TLE 讀取失敗：不顯示 0，改顯示失敗文字
  if (tle.status === "error") {
    return (
      <div role="status" style={{ padding: "10px 14px 8px", borderBottom: `1px solid ${p.borderSoft}`, fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, color: p.statusWarn }}>
        衛星資料讀取失敗，無法計算覆蓋統計
      </div>
    );
  }
  const tleLoading = tle.status === "loading";
  const coverReady = !tleLoading && coveringRaw != null;
  const passReady = !tleLoading && !computingScan && passesRaw != null;

  // X1：讀取中／計算中在數字位置顯示文字（不可顯示 0）
  const wait = (t: string) => (
    <span style={{ fontSize: FONT_SIZE.base, color: p.textMuted, lineHeight: "22px", whiteSpace: "nowrap" }}>{t}</span>
  );
  const big = (v: number, unit: string, color: string) => (
    <span style={{ whiteSpace: "nowrap" }}>
      <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xl, fontWeight: 700, color }}>{v}</span>
      <span style={{ marginLeft: 3, fontSize: FONT_SIZE.sm, color: p.textDim }}>{unit}</span>
    </span>
  );
  const bdItem = (label: string, n: number, unit = "", color: string = p.textDefault) => (
    <span style={{ whiteSpace: "nowrap" }}>
      {label} <span style={{ fontFamily: FONT_DATA, color, fontWeight: 600 }}>{n}</span>{unit}
    </span>
  );
  const bdBox: CSSProperties = { marginTop: 2, display: "flex", flexWrap: "wrap", gap: "2px 8px", fontSize: FONT_SIZE.sm, color: p.textMuted };

  return (
    <div style={{ borderBottom: `1px solid ${p.borderSoft}`, fontFamily: FONT_CJK }}>
      <SubGroupLabel>覆蓋統計</SubGroupLabel>
      <div style={{ padding: "2px 14px 9px" }}>
        {/* 主數字：兩欄，上小標籤、下大數字＋單位、細項放數字下方 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: FONT_SIZE.sm, color: p.textDim }}>覆蓋台灣中</div>
            <div style={{ marginTop: 1, minHeight: 22 }}>
              {tleLoading ? wait("讀取中…") : coveringRaw == null ? wait("計算中…") : big(coveringNow.length, "顆", coveringNow.length > 0 ? text(TAIWAN_COLOR) : p.textDefault)}
            </div>
            {coverReady && coveringNow.length > 0 && (
              <div style={bdBox}>
                {bdItem("台灣", coverageBreakdown.tw, "", text(TAIWAN_COLOR))}
                {bdItem("其他國家", coverageBreakdown.cn)}
                <span title="Yaogan／Jilin／Gaofen／台灣與各國遙測衛星" style={{ whiteSpace: "nowrap" }}>
                  遙測偵察 <span style={{ fontFamily: FONT_DATA, fontWeight: 600, color: coverageBreakdown.recon > 0 ? p.statusLive : p.textMuted }}>{coverageBreakdown.recon}</span>
                </span>
              </div>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: FONT_SIZE.sm, color: p.textDim }}>未來 6 小時通過</div>
            <div style={{ marginTop: 1, minHeight: 22 }}>
              {tleLoading ? wait("讀取中…") : !passReady ? wait("計算中…") : big(passes.length, "次", p.textDefault)}
            </div>
            {passReady && passes.length > 0 && (
              <div style={bdBox}>
                <span style={{ whiteSpace: "nowrap" }}>
                  遙測偵察 <span style={{ fontFamily: FONT_DATA, fontWeight: 600, color: passBreakdown.recon > 0 ? p.statusLive : p.textMuted }}>{passBreakdown.recon}</span> 次
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 覆蓋中 sats 縮略 */}
        {coverReady && coveringNow.length > 0 && (
          <div
            title="目前覆蓋台灣的衛星"
            style={{ marginTop: 5, fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: p.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {coveringNow.slice(0, 6).map((p) => p.rec.name).join(" · ")}
            {coveringNow.length > 6 ? ` … +${coveringNow.length - 6}` : ""}
          </div>
        )}

        {/* Y2：整列可點展開 */}
        {!tleLoading && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginTop: 8, width: "100%", display: "flex", alignItems: "center", gap: 6,
              padding: "6px 0 0", border: "none", borderTop: `1px solid ${p.borderSoft}`, background: "transparent",
              color: p.textMuted, fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, cursor: "pointer", textAlign: "left",
            }}
          >
            <ChevronRight
              size={12}
              aria-hidden="true"
              style={{ flexShrink: 0, transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }}
            />
            <span style={{ whiteSpace: "nowrap" }}>未來 6 小時通過時間</span>
            <span style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
              {passReady ? <><span style={{ fontFamily: FONT_DATA }}>{passes.length}</span> 次</> : "計算中…"}
            </span>
          </button>
        )}

        {/* 6 小時通過時間展開 */}
        {expanded && !tleLoading && (
          <div style={{ marginTop: 8, padding: 8, borderRadius: RADIUS.lg, background: p.controlBg, border: `1px solid ${p.borderSoft}` }}>
            <div className={layerControlThemeClass(p.isDark)} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <ControlSegmented
                label="通過時間篩選"
                value={reconOnly ? "recon" : "all"}
                options={[{ label: "遙測偵察", value: "recon" }, { label: "全部", value: "all" }]}
                onChange={(v) => setReconOnly(v === "recon")}
              />
              <span style={{ marginLeft: "auto", whiteSpace: "nowrap", fontSize: FONT_SIZE.sm, color: p.textDim }}>
                <span style={{ fontFamily: FONT_DATA }}>{filteredPasses.length} / {passes.length}</span> 次
              </span>
            </div>
            {/* 時間軸刻度 */}
            <div style={{ position: "relative", height: 18, margin: "0 6px 8px" }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 14, height: 1, background: p.borderMid }} />
              {AXIS_LABELS.map((t, h) => (
                <span key={h} style={{
                  position: "absolute", left: `${(h / 6) * 100}%`, top: 0, whiteSpace: "nowrap",
                  transform: `translateX(${h === 0 ? "0" : h === 6 ? "-100%" : "-50%"})`,
                  fontSize: FONT_SIZE.xs, color: p.textFaint,
                }}>
                  {t}
                </span>
              ))}
            </div>
            {/* tick rows */}
            <div style={{ position: "relative", maxHeight: 220, overflowY: "auto", margin: "0 6px" }} className="mtp-scroll">
              {filteredPasses.length === 0 ? (
                <div style={{ fontSize: FONT_SIZE.sm, color: p.textFaint, padding: "8px 0", textAlign: "center" }}>
                  {computingScan ? "計算中…" : reconOnly ? "未來 6 小時無遙測偵察類通過" : "未來 6 小時無預計通過"}
                </div>
              ) : (
                filteredPasses.slice(0, 80).map((tick, i) => {
                  const left = (tick.startMinFromNow / (SCAN_HOURS * 60)) * 100;
                  const raw = SATELLITE_COLORS[tick.cat as keyof typeof SATELLITE_COLORS];
                  // SC2：通過時間圓點＝資料色，淡色補到對白 3:1
                  const color = raw ? fill(raw) : p.textDim;
                  const isManeuver = maneuverNorads.has(tick.norad);
                  return (
                    <div key={i} style={{ position: "relative", height: 18, display: "flex", alignItems: "center" }}>
                      <span style={{
                        position: "absolute", left: `${left}%`, top: 5, width: 8, height: 8, borderRadius: RADIUS.full,
                        background: color, transform: "translateX(-50%)",
                        outline: isManeuver ? `1.5px solid ${p.statusErr}` : "none", outlineOffset: 1,
                      }} />
                      <span style={{
                        position: "absolute", left: `min(${left + 2}%, calc(100% - 150px))`, top: 1,
                        display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                        fontSize: FONT_SIZE.sm, color: p.textMuted,
                      }}>
                        <span style={{ fontFamily: FONT_DATA, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{tick.name}</span>
                        {isManeuver && <span style={{ ...MANEUVER_CHIP, ...chipOutline(p.statusErr) }}>變軌</span>}
                      </span>
                    </div>
                  );
                })
              )}
              {filteredPasses.length > 80 && (
                <div style={{ padding: "4px 0", fontSize: FONT_SIZE.xs, color: p.textFaint, textAlign: "center" }}>
                  共 <span style={{ fontFamily: FONT_DATA }}>{filteredPasses.length}</span> 次 · 顯示前 80 次
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
