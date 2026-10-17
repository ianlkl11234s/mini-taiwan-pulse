import { useEffect, useState } from "react";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { Waves, DoorOpen, Droplets } from "lucide-react";
import { TimeseriesSparkline, type SparklinePoint } from "../TimeseriesSparkline";
import {
  fetchTaipeiSewerTimeseries,
  fetchTaipeiPumbTimeseries,
  fetchTaipeiEvacuateTimeseries,
} from "../../data/wicTaipeiLoader";
import { Row, Badge, formatTaiwanMinute, formatTaiwanShort } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";

// ════════════════════════════════════════════════════════════════
//  北市水利處水情即時三本柱 popup（sewer / evacuate / pumb）
// ════════════════════════════════════════════════════════════════

export function TaipeiSewerPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const stationNo = String(props.station_no ?? "");
  const name = String(props.station_name ?? stationNo);
  const groundFar = props.ground_far == null ? null : Number(props.ground_far);
  const levelOut = props.level_out == null ? null : Number(props.level_out);
  const obs = String(props.observed_at ?? "");

  // 配色：距地面深度越小越危險
  let color = "#3b82f6";
  let level = tr("popup.taipeiWic.levelNormal");
  if (groundFar != null) {
    if (groundFar < 0.5)      { color = "#7f1d1d"; level = tr("popup.taipeiWic.sewerDanger"); }
    else if (groundFar < 1.0) { color = "#ef4444"; level = tr("popup.taipeiWic.sewerWarning"); }
    else if (groundFar < 2.0) { color = "#fb923c"; level = tr("popup.taipeiWic.sewerCaution"); }
    else if (groundFar < 3.0) { color = "#fde047"; level = tr("popup.taipeiWic.sewerElevated"); }
  }

  const [series, setSeries] = useState<SparklinePoint[]>([]);
  const [loadingTs, setLoadingTs] = useState(true);

  useEffect(() => {
    if (!stationNo) { setLoadingTs(false); return; }
    let cancelled = false;
    setLoadingTs(true);
    fetchTaipeiSewerTimeseries(stationNo, 24)
      .then((rows) => {
        if (cancelled) return;
        setSeries(rows.map((r) => ({ t: Date.parse(r.observed_at) / 1000, v: r.level_out ?? 0 })));
      })
      .catch((e) => console.warn("[TaipeiSewer] timeseries fetch failed:", e))
      .finally(() => { if (!cancelled) setLoadingTs(false); });
    return () => { cancelled = true; };
  }, [stationNo]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Waves size={14} color={color} strokeWidth={2.4} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name} <span style={{ opacity: 0.5, fontWeight: 400 }}>#{stationNo}</span>
        </div>
        {groundFar != null && (
          <div style={{ fontSize: FONT_SIZE.sm, padding: "1px 6px", borderRadius: RADIUS.md, background: color, color: "#fff", fontWeight: 600 }}>
            {level}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <div style={{ flex: 1, padding: "6px 8px", background: `${color}1a`, borderRadius: RADIUS.md }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{tr("popup.taipeiWic.groundFar")}</div>
          <div style={{ fontSize: FONT_SIZE.xl, fontWeight: 700, color }}>
            {groundFar != null ? groundFar.toFixed(2) : "—"}
            <span style={{ fontSize: FONT_SIZE.sm, opacity: 0.7, marginLeft: 4 }}>m</span>
          </div>
        </div>
        <div style={{ flex: 1, padding: "6px 8px", background: t.bgSubtle, borderRadius: RADIUS.md }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{tr("popup.taipeiWic.levelOut")}</div>
          <div style={{ fontSize: FONT_SIZE.xl, fontWeight: 700, color: t.textStrong }}>
            {levelOut != null ? levelOut.toFixed(2) : "—"}
            <span style={{ fontSize: FONT_SIZE.sm, opacity: 0.7, marginLeft: 4 }}>m</span>
          </div>
        </div>
      </div>
      {obs && <Row field="observedAt" value={formatTaiwanMinute(obs)} />}
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
        {tr("popup.taipeiWic.sewerTrend")}
      </div>
      {loadingTs ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>{tr("popup.common.loading")}</div>
      ) : (
        <TimeseriesSparkline data={series} unit="m" lineColor={color} height={120} />
      )}
    </>
  );
}

export function TaipeiPumbPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const stnId = String(props.stn_id ?? "");
  const name = String(props.stn_name ?? stnId);
  const inner = props.inner_value == null ? null : Number(props.inner_value);
  const outer = props.outer_value == null ? null : Number(props.outer_value);
  const maxAllow = props.max_allowable == null ? null : Number(props.max_allowable);
  const risk = props.risk_ratio == null ? null : Number(props.risk_ratio);
  const pumbStatus = String(props.pumb_status ?? "");
  const doorStatus = String(props.door_status ?? "");
  const obs = String(props.observed_at ?? "");

  let color = "#06b6d4";
  let level = tr("popup.taipeiWic.levelNormal");
  if (risk != null) {
    if (risk >= 0.9)      { color = "#7f1d1d"; level = tr("popup.taipeiWic.pumpDanger", { pct: (risk * 100).toFixed(0) }); }
    else if (risk >= 0.8) { color = "#ef4444"; level = tr("popup.taipeiWic.pumpWarning", { pct: (risk * 100).toFixed(0) }); }
    else if (risk >= 0.6) { color = "#fb923c"; level = tr("popup.taipeiWic.pumpElevated", { pct: (risk * 100).toFixed(0) }); }
    else if (risk >= 0.4) { color = "#fde047"; level = tr("popup.taipeiWic.pumpCaution", { pct: (risk * 100).toFixed(0) }); }
  }

  const [series, setSeries] = useState<SparklinePoint[]>([]);
  const [loadingTs, setLoadingTs] = useState(true);

  useEffect(() => {
    if (!stnId) { setLoadingTs(false); return; }
    let cancelled = false;
    setLoadingTs(true);
    fetchTaipeiPumbTimeseries(stnId, 24)
      .then((rows) => {
        if (cancelled) return;
        setSeries(rows.map((r) => ({ t: Date.parse(r.observed_at) / 1000, v: r.inner_value ?? 0 })));
      })
      .catch((e) => console.warn("[TaipeiPumb] timeseries fetch failed:", e))
      .finally(() => { if (!cancelled) setLoadingTs(false); });
    return () => { cancelled = true; };
  }, [stnId]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Droplets size={14} color={color} strokeWidth={2.4} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name} <span style={{ opacity: 0.5, fontWeight: 400 }}>#{stnId}</span>
        </div>
        {risk != null && (
          <div style={{ fontSize: FONT_SIZE.sm, padding: "1px 6px", borderRadius: RADIUS.md, background: color, color: "#fff", fontWeight: 600 }}>
            {level}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <div style={{ flex: 1, padding: "6px 8px", background: `${color}1a`, borderRadius: RADIUS.md }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{tr("popup.taipeiWic.inner")}</div>
          <div style={{ fontSize: FONT_SIZE.xl, fontWeight: 700, color }}>
            {inner != null ? inner.toFixed(2) : "—"}
            <span style={{ fontSize: FONT_SIZE.sm, opacity: 0.7, marginLeft: 4 }}>m</span>
          </div>
        </div>
        <div style={{ flex: 1, padding: "6px 8px", background: t.bgSubtle, borderRadius: RADIUS.md }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{tr("popup.taipeiWic.outer")}</div>
          <div style={{ fontSize: FONT_SIZE.xl, fontWeight: 700, color: t.textStrong }}>
            {outer != null ? outer.toFixed(2) : "—"}
            <span style={{ fontSize: FONT_SIZE.sm, opacity: 0.7, marginLeft: 4 }}>m</span>
          </div>
        </div>
      </div>
      {maxAllow != null && <Row label={tr("popup.taipeiWic.warningLine")} value={`${maxAllow.toFixed(2)} m`} />}
      <Row label={tr("popup.taipeiWic.pump")} value={pumbStatus ? enumLabel("taipeiWicPump", pumbStatus, pumbStatus, i18n) : "—"} color={pumbStatus === "運轉" ? "#22d3ee" : undefined} />
      <Row label={tr("popup.taipeiWic.gate")} value={doorStatus || "—"} />
      {obs && <Row field="observedAt" value={formatTaiwanMinute(obs)} />}
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
        {tr("popup.taipeiWic.pumpTrend")}
      </div>
      {loadingTs ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>{tr("popup.common.loading")}</div>
      ) : (
        <TimeseriesSparkline
          data={series}
          unit="m"
          warningValue={maxAllow ?? null}
          warningLabel={maxAllow != null ? tr("popup.taipeiWic.warningShort") : undefined}
          lineColor={color}
          height={120}
        />
      )}
    </>
  );
}

export function TaipeiEvacuatePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const stationNo = String(props.station_no ?? "");
  const name = String(props.station_name ?? stationNo);
  const gateNum = Number(props.gate_num) || 1;
  const state = String(props.gate_state ?? "unknown");
  const obs = String(props.observed_at ?? "");

  const stateColor = state === "closed" ? "#ef4444" : state === "faulted" ? "#fbbf24" : state === "open" ? "#22c55e" : "#6b7280";
  const stateLabel = state === "closed" ? tr("popup.taipeiWic.stateClosed") : state === "faulted" ? tr("popup.taipeiWic.stateFaulted") : state === "open" ? tr("popup.taipeiWic.stateOpen") : tr("popup.common.unknown");

  const renderGate = (idx: 1 | 2) => {
    const fo = String(props[`fo0${idx}`] ?? "");
    const fc = String(props[`fc0${idx}`] ?? "");
    const flt = String(props[`flt0${idx}`] ?? "");
    if (fo === "" && fc === "" && flt === "") return null;
    return (
      <div key={idx} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: FONT_SIZE.base, padding: "3px 6px", background: t.bgSubtle, borderRadius: RADIUS.md }}>
        <span style={{ color: t.textMuted, marginRight: 4 }}>{tr("popup.taipeiWic.gateN", { n: idx })}</span>
        <Badge label={tr("popup.taipeiWic.gateOpenShort")} on={fo === "+"} color="#22c55e" />
        <Badge label={tr("popup.taipeiWic.gateClosedShort")} on={fc === "+"} color="#ef4444" />
        <Badge label={tr("popup.taipeiWic.gateFaultShort")} on={flt === "+"} color="#fbbf24" />
      </div>
    );
  };

  const [history, setHistory] = useState<Array<{ t: string; state: string }>>([]);
  const [loadingTs, setLoadingTs] = useState(true);

  useEffect(() => {
    if (!stationNo) { setLoadingTs(false); return; }
    let cancelled = false;
    setLoadingTs(true);
    fetchTaipeiEvacuateTimeseries(stationNo, 24)
      .then((rows) => {
        if (cancelled) return;
        const any = (...vs: (string | null)[]) => vs.some((v) => v === "+");
        // 只記錄狀態變更點
        let prev = "";
        const changes: Array<{ t: string; state: string }> = [];
        for (const r of rows) {
          let s = "open";
          if (any(r.flt01, r.flt02)) s = "faulted";
          else if (any(r.fc01, r.fc02)) s = "closed";
          else if (any(r.fo01, r.fo02)) s = "open";
          else s = "unknown";
          if (s !== prev) {
            changes.push({ t: r.observed_at, state: s });
            prev = s;
          }
        }
        setHistory(changes);
      })
      .catch((e) => console.warn("[TaipeiEvacuate] timeseries fetch failed:", e))
      .finally(() => { if (!cancelled) setLoadingTs(false); });
    return () => { cancelled = true; };
  }, [stationNo]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <DoorOpen size={14} color={stateColor} strokeWidth={2.4} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name} <span style={{ opacity: 0.5, fontWeight: 400 }}>#{stationNo}</span>
        </div>
        <div style={{ fontSize: FONT_SIZE.sm, padding: "1px 6px", borderRadius: RADIUS.md, background: stateColor, color: "#fff", fontWeight: 600 }}>
          {stateLabel}
        </div>
      </div>
      <Row label={tr("popup.taipeiWic.gateTotal")} value={tr("popup.taipeiWic.gateCount", { count: gateNum })} />
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
        {renderGate(1)}
        {gateNum >= 2 && renderGate(2)}
      </div>
      {obs && <Row field="observedAt" value={formatTaiwanMinute(obs)} />}
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
        {tr("popup.taipeiWic.stateChanges")}
      </div>
      {loadingTs ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>{tr("popup.common.loading")}</div>
      ) : history.length === 0 ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>{tr("popup.taipeiWic.noStateChange")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 140, overflowY: "auto" }}>
          {history.slice().reverse().map((h, i) => {
            const c = h.state === "closed" ? "#ef4444" : h.state === "faulted" ? "#fbbf24" : h.state === "open" ? "#22c55e" : "#6b7280";
            const lbl = h.state === "closed" ? tr("popup.taipeiWic.gateClosedShort") : h.state === "faulted" ? tr("popup.taipeiWic.gateFaultShort") : h.state === "open" ? tr("popup.taipeiWic.gateOpenShort") : "?";
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: FONT_SIZE.sm, padding: "2px 4px" }}>
                <span style={{ color: t.textMuted }}>{formatTaiwanShort(h.t)}</span>
                <span style={{ background: c, color: "#fff", padding: "0 4px", borderRadius: RADIUS.sm, fontWeight: 600 }}>{lbl}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
