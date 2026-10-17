import { useEffect, useMemo, useState, type FC } from "react";
import { Row, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { useLocale, type LocaleSnapshot } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { placeName, placeTown } from "../../i18n/placeText";
import { FONT_DATA, FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { ATLAS_LAYER_COLORS, optionColor } from "../../data/atlasLayerTypes";
import { STATION_TYPE_OPTIONS, contourColorExpr } from "../../data/landSubsidenceTypes";
import { fetchLandSubsidenceTimeseries, type LandSubsidenceRow } from "../../data/landSubsidenceLoader";

/**
 * 地層下陷＋海堤 G19（2026-10-17）popup。規格 SSOT：analytics docs/topic-research/land_subsidence/layer-plan.md。
 * 出典與授權由 FeatureInfoPanel 的 SourceFooter 依每筆 source_org／source_url／license 掛。
 * 日期欄（establish_date、obs_first／obs_last、bucket_start）是上游台灣當地日期字串，原樣顯示，不做 +8。
 */
type Props = { props: Record<string, unknown> };

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const county = (value: unknown, i18n: LocaleSnapshot): string =>
  str(value) === "全台" ? i18n.t("popup.atlas.lsNationwide") : placeName(str(value), i18n);

// ── 趨勢圖：純 SVG、X 軸標年份（TimeseriesSparkline 多日範圍只標 M/D，十年圖會看不出年份）──

interface Point { t: number; v: number }

function TrendChart({ points, color, unit }: { points: Point[]; color: string; unit: string }) {
  const theme = useFeatureTheme();
  const { formatNumber } = useLocale();
  const W = 280, H = 130, L = 40, R = 8, T = 8, B = 20;
  const view = useMemo(() => {
    if (points.length === 0) return null;
    const t0 = points[0]!.t, t1 = points[points.length - 1]!.t;
    let vMin = Math.min(...points.map((p) => p.v)), vMax = Math.max(...points.map((p) => p.v));
    if (vMin === vMax) { vMin -= 1; vMax += 1; }
    const pad = (vMax - vMin) * 0.08;
    vMin -= pad; vMax += pad;
    const x = (t: number) => L + (t1 === t0 ? (W - L - R) / 2 : ((t - t0) / (t1 - t0)) * (W - L - R));
    const y = (v: number) => T + (1 - (v - vMin) / (vMax - vMin)) * (H - T - B);
    const y0 = new Date(t0).getUTCFullYear(), y1 = new Date(t1).getUTCFullYear();
    const span = y1 - y0;
    const step = span <= 4 ? 1 : span <= 10 ? 2 : span <= 20 ? 5 : 10;
    const years: number[] = [];
    for (let yr = y0 + 1; yr <= y1; yr++) if (yr % step === 0) years.push(yr);
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    return { x, y, vMin, vMax, years, path };
  }, [points]);
  if (!view) return null;
  const fmt = (v: number) => formatNumber(v, { maximumFractionDigits: Math.abs(view.vMax - view.vMin) < 10 ? 1 : 0 });
  return (
    <svg width={W} height={H} role="img" aria-label={unit} style={{ display: "block", maxWidth: "100%" }}>
      {[view.vMax, (view.vMax + view.vMin) / 2, view.vMin].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={view.y(v)} y2={view.y(v)} stroke={theme.borderSoft} />
          <text x={L - 4} y={view.y(v) + 3} textAnchor="end" fontSize={9} fill={theme.textMuted} fontFamily={FONT_DATA}>{fmt(v)}</text>
        </g>
      ))}
      {view.vMin < 0 && view.vMax > 0 && <line x1={L} x2={W - R} y1={view.y(0)} y2={view.y(0)} stroke={theme.textDim} strokeDasharray="3 3" />}
      {view.years.map((yr) => {
        const xx = view.x(Date.UTC(yr, 0, 1));
        return <g key={yr}>
          <line x1={xx} x2={xx} y1={T} y2={H - B} stroke={theme.borderSoft} />
          <text x={xx} y={H - 6} textAnchor="middle" fontSize={9} fill={theme.textMuted} fontFamily={FONT_DATA}>{yr}</text>
        </g>;
      })}
      <path d={view.path} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      {points.length <= 3 && points.map((p) => <circle key={p.t} cx={view.x(p.t)} cy={view.y(p.v)} r={2.5} fill={color} />)}
    </svg>
  );
}

const toT = (bucket: string) => Date.parse(`${bucket.slice(0, 10)}T00:00:00Z`);
const ym = (bucket: string) => bucket.slice(0, 7);

function StationTrend({ props }: Props) {
  const theme = useFeatureTheme();
  const i18n = useLocale();
  const { t } = i18n;
  const stationId = str(props.id);
  const type = str(props.station_type);
  const obsCount = num(props.obs_count) ?? 0;
  const color = optionColor(STATION_TYPE_OPTIONS, type);
  const [rows, setRows] = useState<LandSubsidenceRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [ring, setRing] = useState<number | null>(null);

  useEffect(() => {
    if (!stationId || obsCount <= 0) { setRows([]); return; }
    let cancelled = false;
    setRows(null); setFailed(false); setRing(null);
    fetchLandSubsidenceTimeseries(stationId)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((e) => { console.warn("[LandSubsidence] timeseries fetch failed:", e); if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [stationId, obsCount]);

  const rings = useMemo(() => [...new Set((rows ?? []).map((r) => r.depth_layer_m).filter((d): d is number => d != null))].sort((a, b) => a - b), [rows]);
  const activeRing = type === "magnetic_ring" ? (ring ?? rings[rings.length - 1] ?? null) : null;
  const series = useMemo(() => {
    const src = (rows ?? []).filter((r) => type !== "magnetic_ring" || r.depth_layer_m === activeRing);
    if (type === "gnss" && src.length > 0) {
      const base = src[0]!.value;
      return src.map((r) => ({ t: toT(r.bucket_start), v: (r.value - base) * 1000 }));
    }
    return src.map((r) => ({ t: toT(r.bucket_start), v: r.value }));
  }, [rows, type, activeRing]);

  const muted = { fontSize: FONT_SIZE.sm, color: theme.textDim, padding: "6px 4px", textAlign: "center" as const };
  let body;
  if (failed) body = <div style={muted}>{t("popup.atlas.lsLoadFailed")}</div>;
  else if (rows == null) body = <div style={muted}>{t("popup.common.loading")}</div>;
  else if (series.length === 0) body = <div style={muted}>{t("popup.atlas.lsNoData")}</div>;
  else {
    const src = (rows ?? []).filter((r) => type !== "magnetic_ring" || r.depth_layer_m === activeRing);
    const first = ym(src[0]!.bucket_start), last = ym(src[src.length - 1]!.bucket_start);
    const caption = type === "gnss" ? t("popup.atlas.lsChartGnss", { start: first })
      : type === "magnetic_ring" ? t("popup.atlas.lsChartRing", { ring: String(activeRing ?? "") })
        : t("popup.atlas.lsChartPile", { depth: String(src[0]!.depth_layer_m ?? str(props.well_depth_m)) });
    body = <>
      <div style={{ fontSize: FONT_SIZE.xs, color: theme.textMuted, margin: "2px 0 4px" }}>{caption}</div>
      <TrendChart points={series} color={color} unit={caption} />
      <div style={{ fontSize: FONT_SIZE.xs, color: theme.textDim, fontFamily: FONT_DATA }}>{t("popup.atlas.lsRange", { from: first, to: last })}</div>
    </>;
  }
  return (
    <div style={{ marginTop: 8, padding: "6px 6px 4px", border: `1px solid ${theme.borderSoft}`, borderRadius: RADIUS.md }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{ fontSize: FONT_SIZE.xs, color: theme.textMuted, letterSpacing: 0.5 }}>{t("popup.atlas.lsChartTitle")}</span>
        {type === "magnetic_ring" && rings.length > 1 && (
          <label style={{ fontSize: FONT_SIZE.xs, color: theme.textMuted, display: "flex", gap: 4, alignItems: "center" }}>
            {t("popup.atlas.lsRingSelect")}
            <select value={String(activeRing ?? "")} onChange={(e) => setRing(Number(e.target.value))}
              style={{ fontSize: FONT_SIZE.xs, background: "transparent", color: theme.textStrong, border: `1px solid ${theme.border}`, borderRadius: RADIUS.sm }}>
              {rings.map((r) => <option key={r} value={r}>{t("popup.atlas.lsRingOption", { ring: String(r) })}</option>)}
            </select>
          </label>
        )}
      </div>
      {body}
    </div>
  );
}

export function LandSubsidenceStationPanel({ props }: Props) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const type = str(props.station_type);
  const color = optionColor(STATION_TYPE_OPTIONS, type);
  const trend = num(props.trend_per_year);
  const active = props.is_active === true ? t("popup.atlas.lsActive") : props.is_active === false ? t("popup.atlas.lsInactive") : "";
  const coordStatus = str(props.coord_status);
  const period = [str(props.obs_first), str(props.obs_last)].filter(Boolean).join("～");
  const depth = num(props.well_depth_m);
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="type" value={enumLabel("landSubsidenceStationType", type, str(props.station_type_label), i18n)} color={color} />
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Row field="township" value={placeTown(str(props.county), str(props.township), i18n)} />
    <Row label={t("popup.atlas.lsEstablished")} value={str(props.establish_date)} mono />
    <Row field="status" value={active} />
    <Row label={t("popup.atlas.lsObsPeriod")} value={period} mono />
    <Row label={t("popup.atlas.lsObsCount")} value={(num(props.obs_count) ?? 0) > 0 ? formatNumber(num(props.obs_count)!) : t("popup.atlas.lsNoData")} />
    {type === "gnss" && trend != null && <Row label={t("popup.atlas.lsTrend")} value={t("popup.atlas.lsTrendValue", { value: formatNumber(trend, { maximumFractionDigits: 1 }), window: str(props.trend_window).replace("~", "～") })} mono />}
    {type === "magnetic_ring" && num(props.ring_count) != null && <Row label={t("popup.atlas.lsRingCount")} value={formatNumber(num(props.ring_count)!)} />}
    {type === "deep_pile" && depth != null && <Row label={t("popup.atlas.lsPileDepth")} value={`${formatNumber(depth)} m`} mono />}
    {coordStatus && coordStatus !== "valid" && <Row field="coordPrecision" value={enumLabel("landSubsidenceCoord", coordStatus, str(props.coord_status_label), i18n)} />}
    <StationTrend props={props} />
    <Row field="caution" value={t(type === "deep_pile" ? "popup.atlas.lsCautionPile" : "popup.atlas.lsCaution")} />
  </>;
}

function ContourPanel({ props, layer }: Props & { layer: "landSubsidenceCumulative" | "landSubsidenceRate" }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const type = layer === "landSubsidenceCumulative" ? "cumulative" : "rate";
  const value = num(props.level_value);
  const unit = t(type === "cumulative" ? "popup.atlas.lsUnitMm" : "popup.atlas.lsUnitCmYr");
  const color = useMemo(() => contourColor(type, value), [type, value]);
  const from = num(props.year_from), to = num(props.year_to);
  const periodText = from != null && to != null
    ? t("popup.atlas.lsPeriodValue", { from: String(from), to: String(to), fromAd: String(from + 1911), toAd: String(to + 1911) }) : str(props.period_label);
  return <>
    <Title color={ATLAS_LAYER_COLORS[layer]}>{`${county(props.county, i18n)} ${periodText}`}</Title>
    <Row label={t(type === "cumulative" ? "popup.atlas.lsLevelCumulative" : "popup.atlas.lsLevelRate")} value={value == null ? "" : `${formatNumber(value)} ${unit}`} color={color} mono />
    <Row field="county" value={county(props.county, i18n)} />
    <Row label={t("popup.atlas.lsPeriod")} value={periodText} />
    <Row label={t("popup.atlas.lsLatestLabel")} value={props.is_latest === true ? t("popup.atlas.lsLatestYes") : t("popup.atlas.lsLatestNo")} />
    <Row field="code" value={str(props.fname)} mono />
    {props.sign_corrected === true && <Row field="remarks" value={t("popup.atlas.lsSignCorrected")} />}
    <Row field="caution" value={t("popup.atlas.lsNegativeMeans")} />
  </>;
}

/** 與地圖線色一致（interpolate 的 JS 版，僅 popup 數值上色用）。 */
function contourColor(type: "cumulative" | "rate", value: number | null): string | undefined {
  if (value == null) return undefined;
  const expr = contourColorExpr(type) as (string | number | unknown[])[];
  const stops: [number, string][] = [];
  for (let i = 3; i + 1 < expr.length; i += 2) stops.push([expr[i] as number, expr[i + 1] as string]);
  let picked = stops[0]![1];
  for (const [v, c] of stops) if (value >= v) picked = c;
  return picked;
}

export function SeawallZonePanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const org = str(props.org), orgLabel = str(props.org_label);
  return <>
    <Title color={ATLAS_LAYER_COLORS.seawallZones}>{str(props.name) || t("popup.atlas.lsSeawallTitle")}</Title>
    <Row label={t("popup.atlas.lsShore")} value={str(props.shore_name)} />
    <Row label={t("popup.atlas.lsShoreNo")} value={str(props.shore_no)} mono />
    <Row field="managingAgency" value={enumLabel("atlasWraBranch", orgLabel, orgLabel, i18n)} />
    {org && org !== orgLabel && <Row label={t("popup.atlas.lsOrgRaw")} value={org} />}
    <Row label={t("popup.atlas.lsBuilt")} value="2024-06-12" mono />
  </>;
}

export const LAND_SUBSIDENCE_PANELS: Record<"landSubsidenceStations" | "landSubsidenceCumulative" | "landSubsidenceRate" | "seawallZones", FC<Props>> = {
  landSubsidenceStations: LandSubsidenceStationPanel,
  landSubsidenceCumulative: ({ props }) => <ContourPanel props={props} layer="landSubsidenceCumulative" />,
  landSubsidenceRate: ({ props }) => <ContourPanel props={props} layer="landSubsidenceRate" />,
  seawallZones: SeawallZonePanel,
};
