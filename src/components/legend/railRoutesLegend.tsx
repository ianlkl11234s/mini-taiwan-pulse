// 軌道路線（railRoutes）圖例：每個系統列出實際出現的線色（與 geojson `color` 同源，見 railRoutesTypes）。
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchLine, useLegendTheme } from "./legendKit";
import { RAIL_METRO_LINES, RAIL_ROUTES_SYSTEMS } from "../../data/railRoutesTypes";
import { TRANSFER_STATION, transferRingColor } from "../../map/mapStyleScale";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { localizeLayerName } from "../../i18n/layerText";

export function RailRoutesLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={localizeLayerName("railRoutes", LAYER_MANIFEST.railRoutes.name, i18n).primary} en="Rail Routes" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {RAIL_ROUTES_SYSTEMS.map((s) => (
          <LegendRow
            key={s.value}
            swatch={
              <span style={{ display: "inline-flex", flexDirection: "column", gap: 1 }}>
                {s.colors.slice(0, 4).map((c) => <SwatchLine key={c} color={c} />)}
              </span>
            }
          >
            {enumLabel("railSystem", s.value, s.label, i18n)}
          </LegendRow>
        ))}
      </div>
      <LegendNote>{i18n.t("legend.rail.routesNote")}</LegendNote>
    </div>
  );
}

/** 捷運站圖例：站點依所屬路線線色（與 railRoutes 線色同源），轉乘站白底深描邊。 */
export function MetroStationsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.rail.metroTitle")} en="Metro Stations" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
        {RAIL_METRO_LINES.map((l) => (
          <LegendRow key={`${l.system}-${l.lineId}`} swatch={<SwatchDot color={l.color} opacity={1} />}>{enumLabel("railLine", `${l.system}-${l.lineId}`, l.name, i18n)}</LegendRow>
        ))}
      </div>
      <div style={{ marginTop: 4 }}>
        <LegendRow swatch={<SwatchDot color={TRANSFER_STATION.fill} opacity={1} stroke={transferRingColor(t.isDark)} strokeWidth={TRANSFER_STATION.ringWidth} />}>{i18n.t("legend.rail.transfer")}</LegendRow>
      </div>
      <LegendNote>{i18n.t("legend.rail.metroNote")}</LegendNote>
    </div>
  );
}
