import { useEffect, useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS } from "../../../styles/designTokens";
import { HazardTrendBars, type HazardBar } from "./HazardTrendBars";
import {
  fetchVesselZoneDaily,
  type VesselZoneDay,
  type VesselZoneName,
} from "../../../data/intelLoaders";

/**
 * 特殊船舶接近帶 —— 中國公務船距 24 浬鄰接區外界線的每日態勢。
 *
 * 設計 SSOT：`docs/proposal/vessel-zone-watch.md`（VZ-4）
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

/** 監看名單（2026-08-20 用戶拍板）。漁政／海監等其餘中國類別資料層有算，但不進本卡 */
const WATCH_CLASSES = ["中國海警", "中國海事局", "中國科研船"] as const;

/** 分帶深度：index 即 HazardTrendBars 的 `level`，數字越大越靠近台灣 */
const ZONE_LEVEL: Record<VesselZoneName, number> = {
  approach_12: 0,
  approach_6: 1,
  contiguous: 2,
  territorial: 3,
};

const ZONE_LABEL: Record<VesselZoneName, string> = {
  approach_12: "接近（24 浬線外 6–12 浬）",
  approach_6: "貼線（24 浬線外 0–6 浬）",
  contiguous: "進入鄰接區（12–24 浬）",
  territorial: "進入領海（12 浬內）",
};

/** level → 色。越接近台灣越紅，與海域界線圖層的 12 浬紅／24 浬紫系不衝突 */
const ZONE_COLORS = ["#fbbf24", "#fb923c", "#ef4444", "#b91c1c"];

const CLASS_SHORT: Record<string, string> = {
  中國海警: "海警",
  中國海事局: "海事局",
  中國科研船: "科研船",
};

interface DayAgg {
  day: string;
  /** 該日接近帶總艘數（見下方 mergeDay 的計算與其保守性說明） */
  ships: number;
  /** 該日最深分帶 */
  level: number;
  deepestZone: VesselZoneName;
  /** 該日最近距離（帶符號，負 = 已在 24 浬線內） */
  minDistNm: number | null;
  /** 分類 → 艘數，給 tooltip */
  byClass: Map<string, number>;
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

  for (const r of rows) {
    if (!WATCH_CLASSES.includes(r.vesselClass as (typeof WATCH_CLASSES)[number])) continue;
    const classes = perDay.get(r.day) ?? new Map();
    const zones = classes.get(r.vesselClass) ?? new Map<VesselZoneName, number>();
    zones.set(r.zone, Math.max(zones.get(r.zone) ?? 0, r.ships ?? 0));
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

    for (const [cls, zones] of classes) {
      // 同分類跨分帶取 max（避免同一艘船在多個帶被重複計）
      let clsShips = 0;
      for (const [zone, n] of zones) {
        clsShips = Math.max(clsShips, n);
        if (ZONE_LEVEL[zone] > level) {
          level = ZONE_LEVEL[zone];
          deepest = zone;
        }
      }
      byClass.set(cls, clsShips);
      ships += clsShips; // 跨分類相加是安全的
    }
    out.push({ day, ships, level, deepestZone: deepest, minDistNm: minDist.get(day) ?? null, byClass });
  }
  out.sort((a, b) => a.day.localeCompare(b.day));
  return out;
}

/** 把日期補齊成連續序列 —— 沒有列的日子代表當天沒有船進入接近帶（真的 0，不是缺資料） */
function fillDays(aggs: DayAgg[], windowDays: number): DayAgg[] {
  const lastAgg = aggs[aggs.length - 1];
  if (!lastAgg) return [];
  const byDay = new Map(aggs.map((a) => [a.day, a]));
  const last = new Date(`${lastAgg.day}T00:00:00Z`);
  const out: DayAgg[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(last);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(
      byDay.get(key) ?? {
        day: key,
        ships: 0,
        level: 0,
        deepestZone: "approach_12",
        minDistNm: null,
        byClass: new Map(),
      },
    );
  }
  return out;
}

const fmtDay = (day: string) => `${day.slice(5, 7)}/${day.slice(8, 10)}`;
const fmtDist = (nm: number | null) =>
  nm === null ? "—" : nm < 0 ? `線內 ${Math.abs(nm).toFixed(1)} 浬` : `${nm.toFixed(1)} 浬`;

export function VesselZoneCard({ open = true }: { open?: boolean }) {
  const [rows, setRows] = useState<VesselZoneDay[]>([]);
  const [windowDays, setWindowDays] = useState<WindowDays>(90);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = () => {
      fetchVesselZoneDaily(120)
        .then((r) => { if (!cancelled) setRows(r); })
        .catch((e) => console.warn("[VesselZoneCard] daily", e));
    };
    tick();
    const id = window.setInterval(tick, 30 * 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [open]);

  const aggs = useMemo(() => aggregateByDay(rows), [rows]);
  const windowed = useMemo(() => fillDays(aggs, windowDays), [aggs, windowDays]);

  const bars: HazardBar[] = useMemo(
    () =>
      windowed.map((a) => ({
        label: fmtDay(a.day),
        key: a.day,
        value: a.ships || null, // 0 艘畫成灰樁底線，與有量的日子拉開
        level: a.level,
        note: a.ships
          ? [
              ZONE_LABEL[a.deepestZone],
              `最近 ${fmtDist(a.minDistNm)}`,
              [...a.byClass].map(([c, n]) => `${CLASS_SHORT[c] ?? c} ${n}`).join(" · "),
            ].join("｜")
          : "無船進入接近帶",
      })),
    [windowed],
  );

  // 頭部：最新「有量」的一日
  const latest = useMemo(() => [...aggs].reverse().find((a) => a.ships > 0) ?? null, [aggs]);
  const peak = useMemo(
    () => windowed.reduce((m, a) => (a.ships > m ? a.ships : m), 0),
    [windowed],
  );
  const closest = useMemo(() => {
    const vals = windowed.map((a) => a.minDistNm).filter((v): v is number => v !== null);
    return vals.length ? Math.min(...vals) : null;
  }, [windowed]);
  const enterDays = useMemo(() => windowed.filter((a) => a.level >= 2).length, [windowed]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: FONT_CJK }}>
      {/* 頭 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textStrong }}>
          特殊船舶接近帶
        </span>
        {latest ? (
          <>
            <span
              style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: RADIUS.pill,
                background: `${ZONE_COLORS[latest.level]}22`,
                color: ZONE_COLORS[latest.level],
                border: `1px solid ${ZONE_COLORS[latest.level]}55`,
              }}
            >
              {ZONE_LABEL[latest.deepestZone]}
            </span>
            <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT_DATA }}>
              {fmtDay(latest.day)} · {latest.ships} 艘 · 最近 {fmtDist(latest.minDistNm)}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: COLORS.textDim }}>資料載入中…</span>
        )}
      </div>

      {/* 視窗切換 */}
      <div style={{ display: "flex", gap: 4 }}>
        {WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => setWindowDays(w)}
            style={{
              fontSize: 9,
              padding: "2px 7px",
              borderRadius: RADIUS.sm,
              cursor: "pointer",
              fontFamily: FONT_DATA,
              background: w === windowDays ? COLORS.accentFaint : "transparent",
              color: w === windowDays ? COLORS.textStrong : COLORS.textDim,
              border: `1px solid ${w === windowDays ? COLORS.borderStrong : COLORS.borderSoft}`,
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
        unit="艘"
        caption={`${windowDays}D · 接近帶艘數（柱）／最深分帶（色）`}
        footer={
          peak
            ? `單日最高 ${peak} 艘${closest !== null ? ` · 最近 ${fmtDist(closest)}` : ""}${
                enterDays ? ` · 進入鄰接區 ${enterDays} 天` : ""
              }`
            : undefined
        }
      />

      {/* 分類出現天數 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {WATCH_CLASSES.map((cls) => {
          const days = windowed.filter((a) => (a.byClass.get(cls) ?? 0) > 0).length;
          const pct = windowed.length ? (days / windowed.length) * 100 : 0;
          return (
            <div key={cls} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
              <span style={{ width: 52, color: COLORS.textMuted, flexShrink: 0 }}>
                {CLASS_SHORT[cls]}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: COLORS.borderSoft,
                  borderRadius: RADIUS.sm,
                  overflow: "hidden",
                }}
              >
                <div style={{ width: `${pct}%`, height: "100%", background: COLORS.accent }} />
              </div>
              <span style={{ width: 46, textAlign: "right", color: COLORS.textDim, fontFamily: FONT_DATA }}>
                {days} 天
              </span>
            </div>
          );
        })}
      </div>

      {/*
        誠實限制。與共機卡的關鍵差異：那邊是國防部官方全量通報，這邊是船自願廣播的 AIS。
        不寫清楚會讓讀者把「AIS 看到的」當成「實際發生的」。
      */}
      <div style={{ fontSize: 9, color: COLORS.textFaint, lineHeight: 1.5 }}>
        AIS 自願廣播 · 觀測下限非全量 · 僅臺灣本島（含澎湖）· 金馬烏坵東引無公告基線不可判定
      </div>
    </div>
  );
}

export default VesselZoneCard;
