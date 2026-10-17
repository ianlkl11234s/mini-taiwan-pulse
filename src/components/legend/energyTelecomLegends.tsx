// Legend sub-components (energyTelecomLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { FACILITY_STATUS_PAINT_COLORS, THEMED_PAINT_COLORS, FOSSIL_PAINT_COLORS } from "../../map/layerPaintColors";
import { LegendNote, LegendSizeRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { type LayerVisibility } from "../../types";
import { FACILITY_FUEL_COLORS, FUEL_COLORS, FUEL_FALLBACK_COLOR, RESERVE_INDICATOR_COLORS, RESERVE_INDICATOR_LABELS, CAPACITY_BREAKS, CAPACITY_RADIUS } from "../../data/energyLoader";
import { IXP_REGIONS, ANFR_OPERATORS, OSM_COMMUNICATION_TYPES, RIPE_ATLAS_NODE_TYPES, ooklaSpeedStops } from "../../data/telecomTypes";
import { POWER_OUTPUT_LEGEND_MW, powerOutputRadius } from "../../map/r6FlatEncodings";
import { DenseHeatmapLegendRow, FireCatRows } from "./legendShared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { localizeLayerName } from "../../i18n/layerText";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import type { LayerName } from "../../data/layerManifest";

/** 標題與圖層名相同時，借 manifest 名稱在目前語系的顯示名 */
type I18n = ReturnType<typeof useLocale>;

function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export function NetworkStructuresLegend({ title, rows, line = false }: { title: string; rows: readonly { label: string; color: string }[]; line?: boolean }) {
  return <div><LegendTitle zh={title} /><FireCatRows cats={[...rows]} line={line} /></div>;
}

// ── OSM crowd 通訊海纜世界概覽；線位來自 OpenInfraMap z2 概化 tiles。──
const SUBMARINE_CABLE_CATS = [
  { color: "#26c6da" },
];

export function SubmarineCableLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.submarineCableTitle")} en="Submarine Cable" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {SUBMARINE_CABLE_CATS.map((c) => (
          <div key={c.color} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchLine color={c.color} width={3} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.energy.submarineCableRoute")}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.35 }}>
        {i18n.t("legend.energy.submarineNote")}
      </LegendNote>
    </div>
  );
}

// ── OSM crowd 海纜登陸站。──
export function LandingStationLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.landingTitle")} en="Landing Station" />
      <FireCatRows cats={[{ color: "#ffb74d", label: i18n.t("legend.energy.landingLabel") }]} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.35 }}>
        {i18n.t("legend.energy.landingNote")}
      </LegendNote>
    </div>
  );
}

export function InternetExchangePointsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("internetExchangePoints", i18n)} en="Internet Exchange" />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {IXP_REGIONS.map((region) => (
          <div key={region.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={region.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("legendEnergyIxp", region.value, region.label, i18n)}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 5 }}>
        {i18n.t("legend.energy.ixpNote")}
      </LegendNote>
    </div>
  );
}

export function AnfrWirelessSitesLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.energy.anfrTitle")} en="Wireless Sites" />
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {ANFR_OPERATORS.map((operator) => <div key={operator.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={operator.color} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("legendEnergyAnfr", operator.value, operator.label, i18n)}</span>
      </div>)}
    </div>
    <LegendNote style={{ marginTop: 5 }}>{i18n.t("legend.energy.anfrNote")}</LegendNote>
  </div>;
}

export function OsmCommunicationSitesLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.energy.osmCommTitle")} en="Communication Candidates" />
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {OSM_COMMUNICATION_TYPES.map((entry) => <div key={entry.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={entry.color} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("legendEnergyOsmComm", entry.value, entry.label, i18n)}</span>
      </div>)}
    </div>
    <LegendNote style={{ marginTop: 5 }}>
      {i18n.t("legend.energy.osmCommNote")}
    </LegendNote>
  </div>;
}

export function RipeAtlasProbesLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("ripeAtlasProbes", i18n)} en="Connected Probes" />
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {RIPE_ATLAS_NODE_TYPES.map((entry) => <div key={entry.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={entry.color} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("legendEnergyRipe", entry.value, entry.label, i18n)}</span>
      </div>)}
    </div>
    <LegendNote style={{ marginTop: 5 }}>
      {i18n.t("legend.energy.ripeNote")}
    </LegendNote>
  </div>;
}

export function OoklaPerformanceGridLegend({ isDark = true, paletteIdx, taiwanOnly = false }: { isDark?: boolean; paletteIdx?: number; taiwanOnly?: boolean }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const stops = ooklaSpeedStops(paletteIdx);
  return <div>
    <LegendTitle zh={i18n.t("legend.energy.ooklaTitle")} en="Speedtest Performance Grid" />
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {stops.map((stop) => <div key={stop.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchSquare color={stop.color} stroke={THEMED_PAINT_COLORS[taiwanOnly ? "ooklaTaiwanOutline" : "ooklaGlobalOutline"][isDark ? "dark" : "light"]} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{stop.label}</span>
      </div>)}
    </div>
    <LegendNote style={{ marginTop: 5, lineHeight: 1.35 }}>
      {i18n.t("legend.energy.ooklaNote1")}<br />
      {i18n.t("legend.energy.ooklaNote2")}
    </LegendNote>
  </div>;
}

// ── Energy: fuel_type 分色 + capacity 半徑 ──

const FUEL_LEGEND_ROWS: { label: string; key: string }[] = [
  { label: "核能 Nuclear", key: "nuclear" },
  { label: "燃煤 Coal", key: "coal" },
  { label: "燃油 Oil", key: "oil" },
  { label: "天然氣 Gas", key: "natural_gas" },
  { label: "水力 Hydro", key: "hydro" },
  { label: "太陽 Solar", key: "solar" },
  { label: "風力 Wind", key: "wind" },
  { label: "地熱 Geothermal", key: "geothermal" },
  { label: "生質 Biomass/Biogas", key: "biomass" },
];

export function EnergyFuelLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  // 同一份燃料色圖例給 legacy 電廠總圖（容量分級）與機組即時出力（R6 段 2：平面圓點大小＝出力 MW）
  const showCapacity = visibility.powerPlants;
  const showOutput = visibility.powerGenerationUnit;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.fuelTitle")} en="Fuel" />
      {FUEL_LEGEND_ROWS.map((row) => (
        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={FUEL_COLORS[row.key] ?? FUEL_FALLBACK_COLOR} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{enumLabel("legendEnergyFuel", row.key, row.label, i18n)}</span>
        </div>
      ))}
      {showCapacity && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            {i18n.t("legend.energy.capacityMw")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {[
              { label: `<${CAPACITY_BREAKS.small}`, r: CAPACITY_RADIUS.tiny },
              { label: `<${CAPACITY_BREAKS.medium}`, r: CAPACITY_RADIUS.small },
              { label: `<${CAPACITY_BREAKS.large}`, r: CAPACITY_RADIUS.medium },
              { label: `≥${CAPACITY_BREAKS.large}`, r: CAPACITY_RADIUS.large },
            ].map((x) => (
              <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div
                  style={{
                    width: x.r * 2,
                    height: x.r * 2,
                    borderRadius: RADIUS.full,
                    background: FUEL_FALLBACK_COLOR,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {showOutput && (
        <LegendSizeRow
          fill={FUEL_FALLBACK_COLOR}
          title={i18n.t("legend.energy.outputTitle")}
          items={POWER_OUTPUT_LEGEND_MW.map((mw) => ({ r: powerOutputRadius(mw), label: `${i18n.formatNumber(mw)} MW` }))}
        />
      )}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        {showOutput && <>{i18n.t("legend.energy.fuelNoteOutput")}<br /></>}
        {i18n.t("legend.energy.fuelNote")}
      </LegendNote>
    </div>
  );
}

// ── Energy: 高壓電網 voltage tier + line_type ──

export function PowerPolesLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  const typeRows = [
    { label: i18n.t("legend.energy.poleConcrete"), color: "#94a3b8" },
    { label: i18n.t("legend.energy.poleConcreteDouble"), color: "#64748b" },
    { label: i18n.t("legend.energy.poleWood"), color: "#a16207" },
    { label: i18n.t("legend.energy.poleH"), color: "#0ea5e9" },
    { label: i18n.t("legend.energy.poleOther"), color: "#f43f5e" },
  ];
  const heatStops = [
    { pct: i18n.t("legend.energy.densitySparse"), color: "#38bdf8" },
    { pct: i18n.t("legend.energy.densityMid"), color: "#22c55e" },
    { pct: i18n.t("legend.energy.densityHigh"), color: "#facc15" },
    { pct: i18n.t("legend.energy.densityVeryHigh"), color: "#f97316" },
    { pct: i18n.t("legend.energy.densityExtreme"), color: "#ef4444" },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.polesTitle")} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        {i18n.t("legend.energy.polesDensity")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
        {heatStops.map((s) => (
          <div key={s.pct} style={{ flex: 1, textAlign: "center" }}>
            <span style={{ display: "block", height: 8, background: s.color, borderRadius: 1 }} />
            <span style={{ fontSize: 9, color: t.textDim }}>{s.pct}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6, marginBottom: 2 }}>
        {i18n.t("legend.energy.polesTypes")}
      </div>
      {typeRows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={r.color} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.label}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        {i18n.t("legend.energy.polesNoteSource")}<br />
        {i18n.t("legend.energy.polesNoteZoom")}<br />
        {i18n.t("legend.energy.polesNoteIslands")}
      </LegendNote>
    </div>
  );
}

export function PowerGridLegend({ visibility }: { visibility?: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const voltageRows = [
    { kv: "345 kV", color: "#1AB6D9" },
    { kv: "161 kV", color: "#62D9AD" },
    { kv: "69 kV",  color: "#468BA6" },
    { kv: i18n.t("legend.energy.voltageUnlabeled"), color: "#DFE0DC" },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.gridTitle")} />
      {voltageRows.map((r) => (
        <div key={r.kv} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchLine color={r.color} width={3} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.kv}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        {i18n.t("legend.energy.lineType")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SwatchLine color={"#62D9AD"} width={3} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.energy.lineTransmission")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 20, height: 1.5, background: "#62D9AD", display: "inline-block", opacity: 0.55 }} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.energy.lineDistribution")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 20,
              height: 2,
              backgroundImage: "linear-gradient(to right, #62D9AD 50%, transparent 0%)",
              backgroundSize: "6px 2px",
              backgroundRepeat: "repeat-x",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.energy.lineUnderground")}</span>
        </div>
      </div>
      {visibility?.osmPowerTowers && <DenseHeatmapLegendRow layers={["osmPowerTowers"]} />}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        {i18n.t("legend.energy.gridNoteTowers")}<br />
        {i18n.t("legend.energy.gridNoteSource")}
      </LegendNote>
    </div>
  );
}

// ── Energy: 變電所（超高壓）2 階（migration 235）──
export function SubstationEhvLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  const rows: { color: string; label: string; sz: number; n: number }[] = [
    { color: "#ef4444", label: i18n.t("legend.energy.ehvSwitching"), sz: 9, n: 5 },
    { color: "#ffffff", label: i18n.t("legend.energy.ehvSubstation"), sz: 8, n: 33 },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.ehvTitle")} />
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ width: r.sz * 2, height: r.sz * 2, borderRadius: "50%", background: r.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault, flex: 1 }}>{r.label}</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.n}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        {i18n.t("legend.energy.ehvNote")}
      </LegendNote>
    </div>
  );
}

// ── Energy: 變電所（區域）5 階（migration 235）──
export function SubstationLocalLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  const rows: { color: string; label: string; sz: number; n: number }[] = [
    { color: "#f97316", label: i18n.t("legend.energy.localPrimary"),     sz: 6.5, n: 129 },
    { color: "#14b8a6", label: i18n.t("legend.energy.localPrimaryDist"), sz: 5.5, n: 90 },
    { color: "#facc15", label: i18n.t("legend.energy.localSecondary"),   sz: 5,   n: 199 },
    { color: "#3b82f6", label: i18n.t("legend.energy.localRail"),        sz: 4.5, n: 11 },
    { color: "#6b7280", label: i18n.t("legend.energy.localUnclassified"), sz: 4,  n: 318 },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.localTitle")} />
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ width: r.sz * 2, height: r.sz * 2, borderRadius: "50%", background: r.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault, flex: 1 }}>{r.label}</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.n}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        {i18n.t("legend.energy.localNote")}
      </LegendNote>
    </div>
  );
}

// ── Energy: Phase 8 SSOT facilities 6-layer ──
export function FacilityFuelLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const fuels: { c: string; code: string; label: string }[] = [
    { c: FACILITY_FUEL_COLORS.coal!, code: "coal", label: "燃煤 coal" },
    { c: FACILITY_FUEL_COLORS.oil_gas!, code: "oil_gas", label: "油氣 oil_gas" },
    { c: FACILITY_FUEL_COLORS.nuclear!, code: "nuclear", label: "核能 nuclear" },
    { c: FACILITY_FUEL_COLORS.hydro!, code: "hydro", label: "水力 hydro" },
    { c: FACILITY_FUEL_COLORS.solar!, code: "solar", label: "光電 solar" },
    { c: FACILITY_FUEL_COLORS.wind!, code: "wind", label: "風力 wind" },
    { c: FACILITY_FUEL_COLORS.bioenergy!, code: "bioenergy", label: "生質 bioenergy" },
    { c: FACILITY_FUEL_COLORS.geothermal!, code: "geothermal", label: "地熱 geothermal" },
    { c: FACILITY_FUEL_COLORS.waste!, code: "waste", label: "焚化 waste" },
  ];
  const showStatus = visibility.facPlanned || visibility.facHistorical;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.facFuelTitle")} />
      {fuels.map((f) => (
        <div key={f.code} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={f.c} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{enumLabel("legendEnergyFacFuel", f.code, f.label, i18n)}</span>
        </div>
      ))}
      {showStatus && (
        <>
          <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.energy.status")}</div>
          {visibility.facPlanned && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <SwatchDot color={FACILITY_STATUS_PAINT_COLORS.fallback} stroke={FACILITY_STATUS_PAINT_COLORS.construction} strokeWidth={1.5} opacity={1} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.energy.facConstruction")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <SwatchDot color={FACILITY_STATUS_PAINT_COLORS.fallback} stroke={FACILITY_STATUS_PAINT_COLORS.preConstruction} strokeWidth={1.5} opacity={.55} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.energy.facPlanned")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <SwatchDot color={FACILITY_STATUS_PAINT_COLORS.fallback} stroke={FACILITY_STATUS_PAINT_COLORS.announced} strokeWidth={1.5} opacity={.35} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.energy.facAnnounced")}</span>
              </div>
            </>
          )}
          {visibility.facHistorical && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <SwatchDot color={FACILITY_STATUS_PAINT_COLORS.historical} stroke={FACILITY_STATUS_PAINT_COLORS.historicalStroke} strokeWidth={1} opacity={.45} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.energy.facHistorical")}</span>
            </div>
          )}
        </>
      )}
      <LegendNote style={{ marginTop: 8, lineHeight: 1.35 }}>
        {i18n.t("legend.energy.facNote")}
      </LegendNote>
    </div>
  );
}

// ── Energy: 化石燃料 14 layer（Phase B） ──

const FOSSIL_FUEL_LEGEND: { key: keyof LayerVisibility; color: string; label: string; shape: "circle" | "line" | "square" }[] = [
  { key: "gasStationCpc",         color: FOSSIL_PAINT_COLORS.gasStationCpc, label: "加油站 中油 (1,971)",          shape: "circle" },
  { key: "gasStationFpcc",        color: FOSSIL_PAINT_COLORS.gasStationFpcc, label: "加油站 台塑系 (348)",          shape: "circle" },
  { key: "gasStationTaisugar",    color: FOSSIL_PAINT_COLORS.gasStationTaisugar, label: "加油站 台糖 (73)",             shape: "circle" },
  { key: "gasStationOther",       color: FOSSIL_PAINT_COLORS.gasStationOther, label: "加油站 其他 (1,179)",          shape: "circle" },
  { key: "gasStationCanonical",   color: FOSSIL_PAINT_COLORS.gasStationCanonical, label: "加油站 SSOT (3,053)",         shape: "circle" },
  { key: "lpgSubpackaging",       color: FOSSIL_PAINT_COLORS.lpgSubpackaging, label: "LPG 分裝/儲存 (113)",          shape: "circle" },
  { key: "lpgRetailers",          color: FOSSIL_PAINT_COLORS.lpgRetailers, label: "LPG 加氣站/瓦斯行 (1,292)",    shape: "circle" },
  { key: "lngTerminal",           color: FOSSIL_PAINT_COLORS.lngTerminal, label: "LNG 接收站 (7)",               shape: "circle" },
  { key: "pipelineGas",           color: FOSSIL_PAINT_COLORS.pipelineGas, label: "天然氣主幹線 (11)",            shape: "line" },
  { key: "pipelineOilGas",        color: FOSSIL_PAINT_COLORS.pipelineOilGas, label: "油氣管線 OSM (10)",            shape: "line" },
  { key: "industrialRefinery",    color: FOSSIL_PAINT_COLORS.industrialRefinery, label: "煉油/化工廠（精選）",         shape: "square" },
  { key: "industrialStorageTank", color: FOSSIL_PAINT_COLORS.industrialStorageTank, label: "油氣儲槽 (72)",                shape: "square" },
  { key: "industrialPowerPlant",  color: FOSSIL_PAINT_COLORS.industrialPowerPlant, label: "火力廠 polygon (26)",          shape: "square" },
  { key: "coalTerminal",          color: FOSSIL_PAINT_COLORS.coalTerminal, label: "煤炭碼頭 (4)",                 shape: "circle" },
];

export function FossilFuelLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const active = FOSSIL_FUEL_LEGEND.filter((r) => visibility[r.key]);
  if (active.length === 0) return null;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.fossilTitle")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {active.map((r) => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {r.shape === "line" ? <SwatchLine color={r.color} width={3} dash={r.key === "pipelineOilGas" ? [2, 2] : undefined} /> : r.shape === "square" ? <SwatchSquare color={r.color} /> : <SwatchDot color={r.color} />}
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("legendEnergyFossil", r.key, r.label, i18n)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 雲林 POC 覆蓋分析（PMTiles × OSM edge nearest distance）──
export function CoverageLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const anyGas = visibility.gasCoverageAll || visibility.gasCoverageCpc
    || visibility.gasCoverageFpcc || visibility.gasCoverageTaisugar;
  const anyEv = visibility.evIsland;
  if (!anyGas && !anyEv) return null;

  const GAS_BANDS: { c: string; l: string }[] = [
    { c: "#16A34A",   l: "0–5 km" },
    { c: "#84CC16",   l: "5–10 km" },
    { c: "#F2D64B",   l: "10–20 km" },
    { c: "#F2A516",   l: "20–30 km" },
    { c: "#F23535",   l: "30 km+" },
  ];
  const EV_BANDS = GAS_BANDS;  // 跟加油站同色階

  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.coverageTitle")} />
      {anyGas && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 4 }}>
            {i18n.t("legend.energy.covGas")}
          </div>
          {GAS_BANDS.map((s) => (
            <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <SwatchLine color={s.c} width={4} />
              <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{s.l}</span>
            </div>
          ))}
        </>
      )}
      {anyEv && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>
            {i18n.t("legend.energy.covEv")}
          </div>
          {EV_BANDS.map((s) => (
            <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <SwatchLine color={s.c} width={4} />
              <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{s.l}</span>
            </div>
          ))}
        </>
      )}
      <LegendNote style={{ marginTop: 6 }}>
        {i18n.t("legend.energy.covNote")}
      </LegendNote>
    </div>
  );
}

export function FacOffshoreLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.offshoreTitle")} />
      {[
        { c: "#3C92A6", label: i18n.t("legend.energy.offOperating"), dash: false },
        { c: "#7AAEC0", label: i18n.t("legend.energy.offConstruction"), dash: true },
        { c: "#7AAEC0", label: i18n.t("legend.energy.offPlanned"), dash: true },
        { c: "#A8C5D0", label: i18n.t("legend.energy.offAnnounced"), dash: true },
      ].map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span
            style={{
              width: 24, height: 8,
              background: r.dash
                ? `repeating-linear-gradient(to right, ${r.c} 0 4px, transparent 4px 7px)`
                : r.c,
              opacity: 0.7,
            }}
          />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.label}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 8, lineHeight: 1.35 }}>
        {i18n.t("legend.energy.offNote")}
      </LegendNote>
    </div>
  );
}

// ── Energy: OSM 風光電 POI（風機 offshore/onshore + 光電 + OSM 電廠 fuel） ──

export function RenewablePoiLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.renewableTitle")} />
      {visibility.osmWindTurbines && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 4 }}>{i18n.t("legend.energy.rWind")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <SwatchDot color={"#67e8f9"} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{i18n.t("legend.energy.rOffshore")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <SwatchDot color={"#2dd4bf"} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{i18n.t("legend.energy.rOnshore")}</span>
          </div>
        </>
      )}
      {visibility.osmSolarFarms && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>{i18n.t("legend.energy.rSolar")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <SwatchDot color={"#fbbf24"} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{i18n.t("legend.energy.rPoiCenter")}</span>
          </div>
        </>
      )}
      {visibility.osmPowerPlantsStatic && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>{i18n.t("legend.energy.rPlants")}</div>
          {[
            { k: "solar", c: "#fbbf24", l: i18n.t("legend.energy.fuelSolar") },
            { k: "wind", c: "#22d3ee", l: i18n.t("legend.energy.fuelWind") },
            { k: "hydro", c: "#3b82f6", l: i18n.t("legend.energy.fuelHydro") },
            { k: "coal", c: "#374151", l: i18n.t("legend.energy.fuelCoal") },
            { k: "gas", c: "#94a3b8", l: i18n.t("legend.energy.fuelGas") },
            { k: "nuclear", c: "#facc15", l: i18n.t("legend.energy.fuelNuclear") },
            { k: "waste", c: "#a3a300", l: i18n.t("legend.energy.fuelWaste") },
            { k: "other", c: "#9ca3af", l: i18n.t("legend.energy.fuelOtherUnlabeled") },
          ].map((x) => (
            <div key={x.k} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <SwatchDot color={x.c} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.l}</span>
            </div>
          ))}
          <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
            {i18n.t("legend.energy.rOverlap")}
          </div>
        </>
      )}
    </div>
  );
}

// ── Energy: 特殊能源 5 layer 共用（offshore / island / fossil / geothermal / 北市再生） ──

export function EnergySpecialtyLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.specialtyTitle")} />
      {visibility.offshoreWindZones && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 4 }}>{i18n.t("legend.energy.spOffshoreZones")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <SwatchSquare color={"#22d3ee"} opacity={0.4} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{i18n.t("legend.energy.spPotentialZone")}</span>
          </div>
        </>
      )}
      {visibility.islandPowerGrid && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>{i18n.t("legend.energy.spIslandGrid")}</div>
          {[
            { c: "#f97316", l: i18n.t("legend.energy.fuelDiesel") },
            { c: "#94a3b8", l: i18n.t("legend.energy.fuelGas") },
            { c: "#fbbf24", l: i18n.t("legend.energy.fuelSolar") },
            { c: "#22d3ee", l: i18n.t("legend.energy.fuelWind") },
            { c: "#3b82f6", l: i18n.t("legend.energy.fuelHydro") },
            { c: "#a78bfa", l: i18n.t("legend.energy.fuelOther") },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <SwatchDot color={x.c} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.l}</span>
            </div>
          ))}
        </>
      )}
      {visibility.fossilFuelInfra && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>{i18n.t("legend.energy.spFossil")}</div>
          {[
            { c: "#22d3ee", l: enumLabel("fossilFacilityType", "lng_terminal", "LNG 接收站", i18n) },
            { c: "#F97316", l: enumLabel("fossilFacilityType", "oil_refinery", "煉油廠", i18n) },
            { c: "#94a3b8", l: enumLabel("fossilFacilityType", "gas_power_plant", "燃氣電廠", i18n) },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <SwatchDot color={x.c} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.l}</span>
            </div>
          ))}
        </>
      )}
      {visibility.geothermalWells && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>{i18n.t("legend.energy.spGeothermal")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <SwatchDot color={"#ef4444"} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{i18n.t("legend.energy.spWellReport")}</span>
          </div>
        </>
      )}
      {visibility.renewablePermitsTaipei && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>{i18n.t("legend.energy.spTaipeiRenew")}</div>
          {[
            { c: "#fbbf24", l: i18n.t("legend.energy.spSchool") },
            { c: "#94a3b8", l: i18n.t("legend.energy.spStateProperty") },
            { c: "#a78bfa", l: i18n.t("legend.energy.spAgency") },
            { c: "#ef4444", l: i18n.t("legend.energy.spIncineration") },
            { c: "#a3a300", l: i18n.t("legend.energy.spBiogas") },
            { c: "#3b82f6", l: i18n.t("legend.energy.spHydropower") },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <SwatchDot color={x.c} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.l}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Energy: 燈號 G/Y/O/R ──

export function EnergyReserveLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.energy.reserveTitle")} />
      {(["G", "Y", "O", "R"] as const).map((k) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={RESERVE_INDICATOR_COLORS[k]!} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>
            {k} · {enumLabel("legendEnergyReserve", k, RESERVE_INDICATOR_LABELS[k]!, i18n)}
          </span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        {i18n.t("legend.energy.reserveNoteBars")}<br />
        {i18n.t("legend.energy.reserveNoteColor")}
      </LegendNote>
    </div>
  );
}
