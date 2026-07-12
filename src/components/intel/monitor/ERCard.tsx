import { useEffect, useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import { TimeseriesSparkline, type SparklinePoint } from "../../TimeseriesSparkline";
import {
  fetchErHospitalLatest, fetchErHospital24h, type ErHospitalLatest,
} from "../../../data/erHospitalLoader";
import {
  classifyErCongestion, erCongestionColor, ER_LEVEL_LABELS, ER_CONGESTION_THRESHOLDS,
} from "../../../data/erCongestionTypes";

interface Props { open: boolean }

const ALL = "all";
const TOP_N = 6;

export function ERCard({ open }: Props) {
  const [latest, setLatest] = useState<ErHospitalLatest[]>([]);
  const [area, setArea] = useState(ALL);
  const [activeHospId, setActiveHospId] = useState<string | null>(null);
  const [series, setSeries] = useState<SparklinePoint[]>([]);
  const [loading24h, setLoading24h] = useState(false);

  // ── latest 快照（全 59 家），open 時載入 + 5min poll ──
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = () => {
      fetchErHospitalLatest()
        .then((rows) => { if (!cancelled) setLatest(rows); })
        .catch((e) => console.warn("[ERCard] latest", e));
    };
    tick();
    const id = window.setInterval(tick, 5 * 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [open]);

  // 區域下拉選項（distinct area_name，依 area_no 排序）+ 全台
  const areaOptions = useMemo(() => {
    const seen = new Map<string, string>(); // area_name → area_no
    for (const r of latest) {
      if (r.area_name && !seen.has(r.area_name)) seen.set(r.area_name, r.area_no ?? "");
    }
    const opts = [...seen.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([name]) => ({ value: name, label: name }));
    return [{ value: ALL, label: "全台" }, ...opts];
  }, [latest]);

  // 顯示的醫院 tab：全台 → 壅塞 top-6；選區 → 該區全部（壅塞排序）
  const displayed = useMemo(() => {
    const pool = area === ALL ? latest : latest.filter((r) => r.area_name === area);
    const sorted = [...pool].sort(
      (a, b) => (b.wait_general_cnt ?? -1) - (a.wait_general_cnt ?? -1),
    );
    return area === ALL ? sorted.slice(0, TOP_N) : sorted;
  }, [latest, area]);

  // 有效選中醫院：activeHospId 仍在清單則沿用，否則退回清單首位
  const effectiveHospId = useMemo(() => {
    if (activeHospId && displayed.some((h) => h.hosp_id === activeHospId)) return activeHospId;
    return displayed[0]?.hosp_id ?? null;
  }, [activeHospId, displayed]);

  const activeHosp = useMemo(
    () => latest.find((h) => h.hosp_id === effectiveHospId) ?? null,
    [latest, effectiveHospId],
  );

  // 選中醫院 24h 折線（等一般病床）
  useEffect(() => {
    if (!open || !effectiveHospId) { setSeries([]); return; }
    let cancelled = false;
    setLoading24h(true);
    fetchErHospital24h(effectiveHospId)
      .then((rows) => {
        if (cancelled) return;
        setSeries(rows
          .filter((r) => r.wait_general_cnt != null)
          .map((r) => ({ t: Number(r.observed_ts), v: Number(r.wait_general_cnt) })));
      })
      .catch((e) => console.warn("[ERCard] 24h", e))
      .finally(() => { if (!cancelled) setLoading24h(false); });
    return () => { cancelled = true; };
  }, [open, effectiveHospId]);

  const curWait = activeHosp?.wait_general_cnt ?? null;
  const curLevel = classifyErCongestion(curWait);
  const dotColor = erCongestionColor(curWait);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel color={COLORS.accent}>急診壅塞 · ER CONGESTION 24H</SectionLabel>
      <div
        style={{
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: "linear-gradient(160deg, rgba(239,68,68,0.06), rgba(255,255,255,0.012))",
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 8,
        }}
      >
        {/* 區域下拉（原生 select，19 區 + 全台） */}
        <select
          value={area}
          onChange={(e) => { setArea(e.target.value); setActiveHospId(null); }}
          style={{
            fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm,
            padding: "4px 8px", borderRadius: RADIUS.sm,
            border: `1px solid ${COLORS.panelBorder}`,
            background: "rgba(255,255,255,0.04)", color: COLORS.textStrong,
            cursor: "pointer", width: "100%",
          }}
        >
          {areaOptions.map((o) => (
            <option key={o.value} value={o.value} style={{ background: "#111827" }}>{o.label}</option>
          ))}
        </select>

        {/* 醫院 tab（全台=壅塞 top6 / 選區=該區） */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {displayed.length === 0 ? (
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>資料載入中…</span>
          ) : displayed.map((h) => {
            const on = h.hosp_id === effectiveHospId;
            const c = erCongestionColor(h.wait_general_cnt);
            return (
              <button
                key={h.hosp_id}
                onClick={() => setActiveHospId(h.hosp_id)}
                style={{
                  fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm,
                  padding: "3px 8px", borderRadius: RADIUS.sm,
                  border: `1px solid ${on ? c : COLORS.panelBorder}`,
                  background: on ? "rgba(239,68,68,0.14)" : "transparent",
                  color: on ? COLORS.textStrong : COLORS.textMuted,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: RADIUS.full, background: c, flexShrink: 0 }} />
                {h.hosp_name}
              </button>
            );
          })}
        </div>

        {/* 當前壅塞燈 + 數值 */}
        {activeHosp && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 11, height: 11, borderRadius: RADIUS.full, background: dotColor,
              boxShadow: `0 0 7px ${dotColor}`, flexShrink: 0,
            }} />
            <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, fontWeight: 700, color: COLORS.textStrong }}>
              {activeHosp.hosp_name}
            </span>
            <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
              {ER_LEVEL_LABELS[curLevel]} · 等一般病床
              <span style={{ fontFamily: FONT_DATA, fontWeight: 700, color: dotColor, marginLeft: 4 }}>
                {curWait == null ? "—" : curWait}
              </span>
            </span>
          </div>
        )}

        {loading24h ? (
          <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, textAlign: "center", padding: "8px 0" }}>
            載入中…
          </div>
        ) : (
          <TimeseriesSparkline
            data={series}
            unit="等一般病床"
            lineColor={dotColor}
            warningValue={ER_CONGESTION_THRESHOLDS.congested}
            warningLabel="嚴重"
            height={80}
          />
        )}
        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>
          來源：衛福部 急診即時訂閱（get_er_hospital_latest / 24h）
        </div>
      </div>
    </div>
  );
}
