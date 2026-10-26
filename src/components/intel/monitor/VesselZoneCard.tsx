import { useCallback, useMemo, useState } from "react";
import { FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { MONITOR_DENSE_CARD_ZOOM } from "./monitorLayout";
import { HazardTrendBars, type HazardBar } from "./HazardTrendBars";
import {
  fetchVesselZoneDaily,
  type VesselZoneDay,
  type VesselZoneName,
} from "../../../data/intelLoaders";
import { useMonitorResource } from "../../../hooks/useMonitorResource";
import { MonitorDataStatus } from "./MonitorDataStatus";
import { useMonitorV2 } from "./monitorStyle";
import { fs } from "./monitorFont";
import { useMonitorTheme } from "./monitorTheme";
import { useMonitorFreshness } from "./monitorFreshness";
import { MonitorMetric, MonitorSub, MonitorNote, MonitorRows } from "./MonitorMetric";
import { MF } from "./monitorFont";
import { useLocale, type LocaleSnapshot } from "../../../state/localeStore";
import type { MessageKey } from "../../../i18n/keys";

/**
 * 特殊船舶接近帶 —— 中國公務船距 24 浬鄰接區外界線的每日態勢。
 *
 * 設計 SSOT：`docs/features/vessel-watch/zone-watch-design.md`（VZ-4）
 *
 * **為什麼主視覺是「接近帶」而不是「進入鄰接區」**（POC 實測後改的方向）：
 * 174 天裡真正進入 24 浬只有 8 天，近 60 天更是 59 天為 0 —— 畫成連續趨勢圖
 * 會是一整片空白。有連續性、有趨勢的是 24 浬線外 0~12 浬這條接近帶
 * （中國海警 3,018 筆／26 艘／79 天）。所以柱高是接近帶艘數，
 * 真正進入鄰接區的日子用柱色標出來當稀疏事件。
 *
 * ⚠️ 誠實限制（AIS 與共機通報的本質差異）：共機數字來自國防部每日通報（官方全量），
 * 這張卡的數字來自船自己廣播 AIS —— 是**觀測下限不是全量**。關掉 AIS 的船直接消失，
 * 同一時刻岸基只看得到 20~33 艘。金門／馬祖／烏坵／東引無公告領海基線，該海域無法判定。
 */

const WINDOWS = [30, 90, 120] as const;
type WindowDays = (typeof WINDOWS)[number];
const EMPTY_VESSEL_ZONE: VesselZoneDay[] = [];

/** 監看名單（2026-08-20 用戶拍板）。漁政／海監等其餘中國類別資料層有算，但不進本卡 */
const WATCH_CLASSES = ["中國海警", "中國海事局", "中國科研船"] as const;

/** 分帶深度：index 即 HazardTrendBars 的 `level`，數字越大越靠近台灣 */
const ZONE_LEVEL: Record<VesselZoneName, number> = {
  approach_12: 0,
  approach_6: 1,
  contiguous: 2,
  territorial: 3,
};

const ZONE_LABEL: Record<VesselZoneName, MessageKey> = {
  approach_12: "monitor.vessel.zoneApproach12",
  approach_6: "monitor.vessel.zoneApproach6",
  contiguous: "monitor.vessel.zoneContiguous",
  territorial: "monitor.vessel.zoneTerritorial",
};

/** v2 小倍數列的分帶名（四列並排，用短名） */
const ZONE_SHORT: Record<VesselZoneName, MessageKey> = {
  approach_12: "monitor.vessel.shortApproach12",
  approach_6: "monitor.vessel.shortApproach6",
  contiguous: "monitor.vessel.shortContiguous",
  territorial: "monitor.vessel.shortTerritorial",
};

/** 分帶時間軸的排序：由深到淺（越危險的帶排越前面） */
const ZONE_ORDER: VesselZoneName[] = ["territorial", "contiguous", "approach_6", "approach_12"];

/** level → 色。越接近台灣越紅，與海域界線圖層的 12 浬紅／24 浬紫系不衝突 */
const ZONE_COLORS = ["#fbbf24", "#fb923c", "#ef4444", "#b91c1c"];

const CLASS_SHORT: Record<string, MessageKey> = {
  中國海警: "monitor.vessel.classCoastGuard",
  中國海事局: "monitor.vessel.classMsa",
  中國科研船: "monitor.vessel.classResearch",
};

interface DayAgg {
  day: string;
  /** 該日接近帶總艘數（見下方 mergeDay 的計算與其保守性說明） */
  ships: number;
  /**
   * 該日艘數缺值：RPC 有列但 ships 全是 NULL（09-26~29 實際發生），或停更後補的尾段。
   * `ships` 仍是 0（舊版沿用），v2 畫成灰樁（缺值）而不是 0 底線。
   */
  unknown: boolean;
  /** 該日最深分帶 */
  level: number;
  deepestZone: VesselZoneName;
  /** 該日最近距離（帶符號，負 = 已在 24 浬線內） */
  minDistNm: number | null;
  /** 分類 → 艘數，給 tooltip */
  byClass: Map<string, number>;
  /**
   * 分帶 → 該日該帶艘數（給「分帶時間軸」用）。
   *
   * ⚠️ 與 `ships` 的加總規則不同，而且**只有分帶維度可以直接加**：
   * RPC 的一列 = 一天 × 一分類 × 一分帶，同一格不會重複，所以「某帶當日艘數」
   * = 該帶各分類直接相加。反過來若把四個帶的數字相加就會重複計
   * （一艘船一天可能先在 approach_12 再進 approach_6），所以 `ships` 才要跨帶取 max。
   * 也因此四條分帶時間軸的柱高**加起來不會等於**合併圖的柱高，這是正確的。
   */
  byZone: Map<VesselZoneName, number>;
}

/**
 * 把 RPC 的「每日 × 分類 × 分帶」多列摺成「每日一根柱」。
 *
 * ⚠️ 艘數的加總規則（不能亂加）：
 * - **同一分類跨分帶取 max，不是 sum** —— 一艘船一天內可能先在 approach_12
 *   再進 approach_6，兩列都會算到它，相加就重複計了。
 * - **跨分類才 sum** —— 一艘船不可能同時是海警又是科研船，這樣加是安全的。
 *
 * 結果是**保守的下限**（同分類內若真的有多艘船分佈在不同帶，會被低估），
 * 寧可低估也不要虛報態勢數字。
 */
function aggregateByDay(rows: VesselZoneDay[]): DayAgg[] {
  const perDay = new Map<string, Map<string, Map<VesselZoneName, number>>>();
  const minDist = new Map<string, number>();
  // 每日 ships 缺值統計：有列但全部 ships 為 NULL → 該日缺值
  const rowCount = new Map<string, number>();
  const knownCount = new Map<string, number>();

  for (const r of rows) {
    if (!WATCH_CLASSES.includes(r.vesselClass as (typeof WATCH_CLASSES)[number])) continue;
    const classes = perDay.get(r.day) ?? new Map();
    const zones = classes.get(r.vesselClass) ?? new Map<VesselZoneName, number>();
    rowCount.set(r.day, (rowCount.get(r.day) ?? 0) + 1);
    if (r.ships !== null) {
      knownCount.set(r.day, (knownCount.get(r.day) ?? 0) + 1);
      zones.set(r.zone, Math.max(zones.get(r.zone) ?? 0, r.ships));
    }
    classes.set(r.vesselClass, zones);
    perDay.set(r.day, classes);

    if (r.minDistNm !== null) {
      const cur = minDist.get(r.day);
      if (cur === undefined || r.minDistNm < cur) minDist.set(r.day, r.minDistNm);
    }
  }

  const out: DayAgg[] = [];
  for (const [day, classes] of perDay) {
    let ships = 0;
    let level = 0;
    let deepest: VesselZoneName = "approach_12";
    const byClass = new Map<string, number>();
    const byZone = new Map<VesselZoneName, number>();

    for (const [cls, zones] of classes) {
      // 同分類跨分帶取 max（避免同一艘船在多個帶被重複計）
      let clsShips = 0;
      for (const [zone, n] of zones) {
        clsShips = Math.max(clsShips, n);
        byZone.set(zone, (byZone.get(zone) ?? 0) + n); // 同帶跨分類相加（見 byZone 註解）
        if (ZONE_LEVEL[zone] > level) {
          level = ZONE_LEVEL[zone];
          deepest = zone;
        }
      }
      byClass.set(cls, clsShips);
      ships += clsShips; // 跨分類相加是安全的
    }
    out.push({
      day, ships, // 任一列 ships 缺值 → 當日總數不完整，視為未知（不把子集當完整總數）
      unknown: (rowCount.get(day) ?? 0) > 0 && (knownCount.get(day) ?? 0) < (rowCount.get(day) ?? 0),
      level, deepestZone: deepest, minDistNm: minDist.get(day) ?? null, byClass, byZone,
    });
  }
  out.sort((a, b) => a.day.localeCompare(b.day));
  return out;
}

/** 把日期補齊成連續序列 —— 沒有列的日子代表當天沒有船進入接近帶（真的 0，不是缺資料） */
function fillDays(aggs: DayAgg[], windowDays: number, tail?: { toDay: string }): DayAgg[] {
  const lastAgg = aggs[aggs.length - 1];
  if (!lastAgg) return [];
  const byDay = new Map(aggs.map((a) => [a.day, a]));
  // v2 來源過期／停更時，視窗錨在今天：最後一列之後的日子是「不知道」（缺值），不是「真的沒船」
  const anchorDay = tail && tail.toDay > lastAgg.day ? tail.toDay : lastAgg.day;
  const last = new Date(`${anchorDay}T00:00:00Z`);
  const out: DayAgg[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(last);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(
      byDay.get(key) ?? {
        day: key,
        ships: 0,
        unknown: key > lastAgg.day,
        level: 0,
        deepestZone: "approach_12",
        minDistNm: null,
        byClass: new Map(),
        byZone: new Map(),
      },
    );
  }
  return out;
}

const fmtDay = (day: string) => `${day.slice(5, 7)}/${day.slice(8, 10)}`;
const fmtDist = (nm: number | null, t: LocaleSnapshot["t"]) =>
  nm === null ? "—" : nm < 0 ? t("monitor.vessel.distInside", { nm: Math.abs(nm).toFixed(1) }) : t("monitor.vessel.dist", { nm: nm.toFixed(1) });

export function VesselZoneCard({ open = true }: { open?: boolean }) {
  const theme = useMonitorTheme();
  const i18n = useLocale();
  const { t } = i18n;
  const classShort = (c: string) => (CLASS_SHORT[c] ? t(CLASS_SHORT[c]) : c);
  const [windowDays, setWindowDays] = useState<WindowDays>(90);
  const loadRows = useCallback(() => fetchVesselZoneDaily(120), []);
  const rowsQuery = useMonitorResource({ open, queryKey: "vessel-zone", intervalMs: 30 * 60_000, emptyData: EMPTY_VESSEL_ZONE, load: loadRows });
  const rows = rowsQuery.data;
  const hasReadableData = rowsQuery.status === "ready" || rowsQuery.lastSuccessAt !== null;

  const v2 = useMonitorV2();
  const aggs = useMemo(() => aggregateByDay(rows), [rows]);

  // 資料期別＝RPC 最新一日（含 0 艘日不在列內，取有列的最後一天）；資料日期＝該日台灣 00:00
  const lastAggDay = aggs.length ? aggs[aggs.length - 1]!.day : null;
  const lastAggMs = lastAggDay ? Date.parse(`${lastAggDay}T00:00:00+08:00`) : NaN;
  const fresh = useMonitorFreshness("vesselZone", {
    timeText: lastAggDay ? fmtDay(lastAggDay) : null,
    dataMs: Number.isNaN(lastAggMs) ? null : lastAggMs,
  });
  const freshStale = fresh.state === "stale" || fresh.state === "stopped";
  const windowed = useMemo(
    () => fillDays(aggs, windowDays, v2 && freshStale ? { toDay: new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10) } : undefined),
    [aggs, windowDays, v2, freshStale],
  );

  const bars: HazardBar[] = useMemo(
    () =>
      windowed.map((a) => ({
        label: fmtDay(a.day),
        key: a.day,
        // v2：0 艘＝底線（真的沒船），缺值（unknown）才是灰樁；舊版維持 0 艘畫成灰樁
        value: v2 ? (a.unknown ? null : a.ships) : a.ships || null,
        level: a.level,
        note: a.ships
          ? [
              t(ZONE_LABEL[a.deepestZone]),
              t("monitor.vessel.nearest", { dist: fmtDist(a.minDistNm, t) }),
              [...a.byClass].map(([c, n]) => `${classShort(c)} ${n}`).join(" · "),
            ].join("｜")
          : v2 && a.unknown ? t("monitor.vessel.noteUnknown") : t("monitor.vessel.noteNone"),
      })),
    [windowed, v2, i18n],
  );

  // 頭部：最新「有量」的一日。unknown 日（ships 部分為 NULL）只剩已知子集，不能當精確值顯示
  const latest = useMemo(() => [...aggs].reverse().find((a) => a.ships > 0 && !a.unknown) ?? null, [aggs]);
  const peak = useMemo(
    () => windowed.reduce((m, a) => (!a.unknown && a.ships > m ? a.ships : m), 0),
    [windowed],
  );
  const closest = useMemo(() => {
    const vals = windowed.map((a) => a.minDistNm).filter((v): v is number => v !== null);
    return vals.length ? Math.min(...vals) : null;
  }, [windowed]);
  const enterDays = useMemo(() => windowed.filter((a) => a.level >= 2).length, [windowed]);

  if (v2) {
    const statusText = rowsQuery.status === "unknown" ? t("monitor.vessel.loading") : rowsQuery.status === "ready" ? t("monitor.vessel.noObservation", { days: windowDays }) : t("monitor.vessel.unavailable");
    const deepestShips = latest ? latest.byZone.get(latest.deepestZone) ?? 0 : 0;
    const latestColor = latest ? ZONE_COLORS[latest.level] : undefined;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: FONT_CJK }}>
        <MonitorDataStatus label={t("monitor.vessel.dataLabel")} query={rowsQuery} />
        {latest && latestColor && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: MF.label, padding: "1px 8px", borderRadius: RADIUS.pill, whiteSpace: "nowrap",
                  background: `${theme.fill(latestColor)}22`, color: theme.text(latestColor), border: `1px solid ${theme.fill(latestColor)}55`,
                }}
              >
                {t(ZONE_LABEL[latest.deepestZone])}
              </span>
            </div>
            <MonitorMetric
              value={deepestShips}
              unit={t("monitor.vessel.unitShips")}
              color={latestColor}
              muted={fresh.muted}
              delta={`${fmtDay(latest.day)} · ${t("monitor.vessel.nearest", { dist: fmtDist(latest.minDistNm, t) })}`}
            />
          </>
        )}
        {!latest && <MonitorNote>{statusText}</MonitorNote>}

        {hasReadableData ? (
          <>
            <div style={{ display: "flex", gap: 4 }}>
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  onClick={() => setWindowDays(w)}
                  style={{
                    fontSize: MF.label, padding: "2px 8px", borderRadius: RADIUS.sm, cursor: "pointer", fontFamily: FONT_DATA,
                    background: w === windowDays ? theme.p.accentFaint : "transparent",
                    color: w === windowDays ? theme.p.textStrong : theme.p.textDim,
                    border: `1px solid ${w === windowDays ? theme.p.borderStrong : theme.p.borderSoft}`,
                  }}
                >
                  {w}D
                </button>
              ))}
            </div>
            <HazardTrendBars
              bars={bars}
              levelColors={ZONE_COLORS}
              heightTier="lg"
              unit={t("monitor.vessel.unitShips")}
              caption={t("monitor.vessel.captionV2", { days: windowDays })}
              footer={
                peak
                  ? `${t("monitor.vessel.footerPeak", { count: peak })}${closest !== null ? t("monitor.vessel.footerNearest", { dist: fmtDist(closest, t) }) : ""}${enterDays ? t("monitor.vessel.footerEnter", { count: enterDays }) : ""}`
                  : undefined
              }
            />
            <MonitorRows
              rows={ZONE_ORDER.map((zone) => {
                // 四列同一把尺：取所有分帶在視窗內的單日最高
                const sharedMax = Math.max(1, ...windowed.flatMap((a) => ZONE_ORDER.map((z) => a.byZone.get(z) ?? 0)));
                const zBars: HazardBar[] = windowed.map((a) => {
                  const n = a.byZone.get(zone) ?? 0;
                  return {
                    label: fmtDay(a.day),
                    key: a.day,
                    // fillDays 補的是「當天該帶真的沒有船」→ 0（底線）；當日艘數缺值／停更尾段才是缺值（灰樁）
                    value: a.unknown ? null : n,
                    level: 0,
                    note: n ? t("monitor.vessel.zoneNote", { zone: t(ZONE_LABEL[zone]), count: n }) : t("monitor.vessel.zoneNoShips"),
                  };
                });
                const zDays = windowed.filter((a) => (a.byZone.get(zone) ?? 0) > 0).length;
                return {
                  label: t(ZONE_SHORT[zone]),
                  title: t(ZONE_LABEL[zone]),
                  chart: <HazardTrendBars bars={zBars} levelColors={[ZONE_COLORS[ZONE_LEVEL[zone]]!]} heightTier="mini" unit={t("monitor.vessel.unitShips")} bare maxValue={sharedMax} />,
                  value: zDays,
                  unit: t("monitor.vessel.rowUnit"),
                };
              })}
            />
            <MonitorSub
              items={WATCH_CLASSES.map((cls) => {
                const days = windowed.filter((a) => (a.byClass.get(cls) ?? 0) > 0).length;
                return t("monitor.vessel.classDays", { cls: classShort(cls), days });
              })}
            />
          </>
        ) : (
          <MonitorNote>{t("monitor.vessel.noInference")}</MonitorNote>
        )}
        {fresh.reason && fresh.state !== "none" && (
          <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>
        )}
        <MonitorNote>
          {t("monitor.vessel.limits")}
        </MonitorNote>
      </div>
    );
  }

  return (
    // zoom：同 PlaBoard —— 本卡內文是 9~12px 字面值（含 HazardTrendBars 的 8~8.5px 軸標），
    // 疊在 MonitorPanel 的全域縮放之上補齊（見 MONITOR_DENSE_CARD_ZOOM 註解）
    <div style={{ zoom: v2 ? undefined : MONITOR_DENSE_CARD_ZOOM, display: "flex", flexDirection: "column", gap: 8, fontFamily: FONT_CJK }}>
      <MonitorDataStatus label={t("monitor.vessel.dataLabel")} query={rowsQuery} />
      {/* 頭 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        {!v2 && (
          <span style={{ fontSize: fs(v2, FONT_SIZE.md), fontWeight: 600, color: theme.p.textStrong }}>
            {t("monitor.vessel.dataLabel")}
          </span>
        )}
        {latest ? (
          <>
            <span
              style={{
                fontSize: fs(v2, FONT_SIZE.sm),
                padding: "1px 6px",
                borderRadius: RADIUS.pill,
                background: `${ZONE_COLORS[latest.level]}22`,
                color: ZONE_COLORS[latest.level],
                border: `1px solid ${ZONE_COLORS[latest.level]}55`,
              }}
            >
              {t(ZONE_LABEL[latest.deepestZone])}
            </span>
            <span style={{ fontSize: fs(v2, FONT_SIZE.base), color: theme.p.textMuted, fontFamily: FONT_DATA }}>
              {t("monitor.vessel.legacyHead", { day: fmtDay(latest.day), ships: latest.ships, dist: fmtDist(latest.minDistNm, t) })}
            </span>
          </>
        ) : (
          <span style={{ fontSize: fs(v2, FONT_SIZE.base), color: theme.p.textDim }}>
            {rowsQuery.status === "unknown" ? t("monitor.vessel.loading") : rowsQuery.status === "ready" ? t("monitor.vessel.noObservation", { days: windowDays }) : t("monitor.vessel.unavailable")}
          </span>
        )}
      </div>

      {hasReadableData ? <>
      {/* 視窗切換 */}
      <div style={{ display: "flex", gap: 4 }}>
        {WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => setWindowDays(w)}
            style={{
              fontSize: fs(v2, FONT_SIZE.xs),
              padding: "2px 7px",
              borderRadius: RADIUS.sm,
              cursor: "pointer",
              fontFamily: FONT_DATA,
              background: w === windowDays ? theme.p.accentFaint : "transparent",
              color: w === windowDays ? theme.p.textStrong : theme.p.textDim,
              border: `1px solid ${w === windowDays ? theme.p.borderStrong : theme.p.borderSoft}`,
            }}
          >
            {w}D
          </button>
        ))}
      </div>

      <HazardTrendBars
        bars={bars}
        levelColors={ZONE_COLORS}
        height={52}
        unit={t("monitor.vessel.unitShips")}
        caption={t("monitor.vessel.captionLegacy", { days: windowDays })}
        footer={
          peak
            ? `${t("monitor.vessel.footerPeak", { count: peak })}${closest !== null ? t("monitor.vessel.footerNearest", { dist: fmtDist(closest, t) }) : ""}${
                enterDays ? t("monitor.vessel.footerEnter", { count: enterDays }) : ""
              }`
            : undefined
        }
      />

      {/*
        分帶時間軸（2026-08-20 用戶要求「拆細項看不同接近程度的時間軸」）。
        合併圖只畫得出「當日最深的那一帶」的顏色，看不出各帶各自的消長；
        四條各自獨立的時間軸才看得到「貼線變多但沒進鄰接區」這種形狀差異。

        由深到淺排（領海在最上面）—— 越危險的帶越先被看到。
        柱高各帶自己算比例尺（HazardTrendBars 的既有行為），所以**跨帶不可比高度**，
        每條的 footer 都印出該帶自己的單日最高值當基準。
      */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ZONE_ORDER.map((zone) => {
          const lv = ZONE_LEVEL[zone];
          const zBars: HazardBar[] = windowed.map((a) => {
            const n = a.byZone.get(zone) ?? 0;
            return {
              label: fmtDay(a.day),
              key: a.day,
              value: n || null,
              // 單色盤只有 index 0，這裡不能傳 zone 的 level（會超出範圍取到最後一色，
              // 剛好也是同一色所以看不出來，但語意錯了）
              level: 0,
              note: n ? t("monitor.vessel.zoneNote", { zone: t(ZONE_LABEL[zone]), count: n }) : t("monitor.vessel.zoneNoShips"),
            };
          });
          const zDays = windowed.filter((a) => (a.byZone.get(zone) ?? 0) > 0).length;
          const zPeak = windowed.reduce((m, a) => Math.max(m, a.byZone.get(zone) ?? 0), 0);
          return (
            <HazardTrendBars
              key={zone}
              bars={zBars}
              // 單色盤：這條線只畫這一帶，柱色不該再變動
              levelColors={[ZONE_COLORS[lv]!]}
              height={34}
              unit={t("monitor.vessel.unitShips")}
              caption={t(ZONE_LABEL[zone])}
              footer={zDays ? t("monitor.vessel.zoneFooter", { days: zDays, peak: zPeak }) : t("monitor.vessel.zoneAbsent", { days: windowDays })}
            />
          );
        })}
      </div>

      {/* 分類出現天數 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {WATCH_CLASSES.map((cls) => {
          const days = windowed.filter((a) => (a.byClass.get(cls) ?? 0) > 0).length;
          const pct = windowed.length ? (days / windowed.length) * 100 : 0;
          return (
            <div key={cls} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fs(v2, FONT_SIZE.sm) }}>
              <span style={{ width: v2 ? 64 : 52, color: theme.p.textMuted, flexShrink: 0 }}>
                {classShort(cls)}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: theme.p.borderSoft,
                  borderRadius: RADIUS.sm,
                  overflow: "hidden",
                }}
              >
                <div style={{ width: `${pct}%`, height: "100%", background: theme.p.accent }} />
              </div>
              <span style={{ width: v2 ? 58 : 46, textAlign: "right", whiteSpace: v2 ? "nowrap" : undefined, color: theme.p.textDim, fontFamily: FONT_DATA }}>
                {t("monitor.vessel.daysCount", { days })}
              </span>
            </div>
          );
        })}
      </div>
      </> : (
        <div style={{ fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textDim }}>{t("monitor.vessel.noInference")}</div>
      )}

      {/*
        誠實限制。與共機卡的關鍵差異：那邊是國防部官方全量通報，這邊是船自願廣播的 AIS。
        不寫清楚會讓讀者把「AIS 看到的」當成「實際發生的」。
      */}
      <div style={{ fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint, lineHeight: 1.5 }}>
        {t("monitor.vessel.limits")}
      </div>
    </div>
  );
}

export default VesselZoneCard;
