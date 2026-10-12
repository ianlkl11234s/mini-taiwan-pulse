import { enumLabel } from "../../i18n/dataText";
import { FONT_SIZE } from "../../styles/designTokens";
import { Row, Title } from "./shared";
import { useLocale, type LocaleSnapshot } from "../../state/localeStore";

type I18n = Pick<LocaleSnapshot, "t">;

function areaHa(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ha` : "";
}

export function AquaculturePondsPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  return (
    <>
      <Title color="#26c6da">{String(props.name ?? tr("popup.fishery.pond"))}</Title>
      <Row label={tr("popup.fishery.produce")} value={String(props.produce ?? "")} />
      <Row field="area" value={areaHa(props.area_ha)} />
    </>
  );
}

export function AquacultureZonePanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  return (
    <>
      <Title color="#66bb6a">{String(props.zone_name ?? tr("popup.fishery.zone"))}</Title>
      <Row field="county" value={String(props.county ?? "")} />
      <Row field="township" value={String(props.township ?? "")} />
      <Row field="area" value={areaHa(props.area_ha)} />
    </>
  );
}

export function AquacultureCageNetPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  return (
    <>
      <Title color="#5c6bc0">{String(props.public_no ?? tr("popup.fishery.cageNet"))}</Title>
      <Row field="township" value={String(props.township ?? "")} />
      <Row field="location" value={String(props.location ?? "")} />
    </>
  );
}

/** nlsc_name + nlsc_code → 「水產養殖（0102）」；缺 name 退回純 code，皆空回空字串（Row 自動隱藏） */
function nlscLandUse(props: Record<string, unknown>): string {
  const name = typeof props.nlsc_name === "string" ? props.nlsc_name : "";
  const code = typeof props.nlsc_code === "string" ? props.nlsc_code : "";
  if (name && code) return `${name}（${code}）`;
  return name || code;
}

export function AquacultureWaterSatellitePanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  const inOsm = props.in_osm === true;
  const solarSymbiotic = props.solar_symbiotic === true;
  const nlscCode = typeof props.nlsc_code === "string" ? props.nlsc_code : "";
  const tier =
    inOsm || nlscCode === "0102" || solarSymbiotic
      ? { color: "#26c6da", label: tr("popup.fishery.tierSure") }
      : nlscCode === "0402" || nlscCode === "0104"
        ? { color: "#90a4ae", label: tr("popup.fishery.tierReservoir") }
        : { color: "#cfd8dc", label: tr("popup.fishery.tierUnsure") };
  return (
    <>
      <Title color={tier.color}>{tr("popup.fishery.satelliteTitle")}</Title>
      <Row field="area" value={areaHa(props.area_ha)} />
      <Row field="county" value={String(props.county ?? "")} />
      <Row label={tr("popup.fishery.confidence")} value={tier.label} color={tier.color} />
      <Row label={tr("popup.fishery.landUse113")} value={nlscLandUse(props)} />
      {solarSymbiotic && (
        <Row label={tr("popup.fishery.solarSymbiotic")} value={tr("popup.fishery.solarSymbioticValue")} color="#fbbf24" />
      )}
      <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5, marginTop: 6 }}>
        {tr("popup.fishery.satelliteNote")}
      </div>
    </>
  );
}

/** display_class 5 值 → 代表色（3 級視覺：確認綠/漁電共生藍/其他灰）+ 標籤 */
const MOA_TIER: Record<string, { color: string; label: string }> = {
  confirmed: { color: "#26c6da", label: "確認 Confirmed" },
  solar_symbiotic: { color: "#1e88e5", label: "漁電共生 Solar Symbiotic" },
  unverified: { color: "#9e9e9e", label: "未確認 Unverified" },
  ambiguous: { color: "#9e9e9e", label: "有疑慮 Ambiguous" },
  mountain_suspect: { color: "#9e9e9e", label: "疑山影 Mountain Suspect" },
};

/** display_class + solar_suspect/overlaps_lake 旗標 → 白話說明「為何這樣分類/為何有疑慮」 */
function moaReasonText(props: Record<string, unknown>, tr: I18n["t"]): string {
  switch (props.display_class) {
    case "confirmed":
      return tr("popup.fishery.moaConfirmed");
    case "unverified":
      return tr("popup.fishery.moaUnverified");
    case "ambiguous": {
      const hits: string[] = [];
      if (props.solar_suspect === true) hits.push(tr("popup.fishery.hitSolar"));
      if (props.overlaps_lake === true) hits.push(tr("popup.fishery.hitLake"));
      return tr("popup.fishery.moaAmbiguous", { hits: hits.length > 0 ? hits.join("/") : tr("popup.fishery.hitRule") });
    }
    case "solar_symbiotic":
      return tr("popup.fishery.moaSolar");
    case "mountain_suspect":
      return tr("popup.fishery.moaMountain");
    default:
      return "";
  }
}

export function AquacultureWaterSatelliteMoaPanel({ props }: { props: Record<string, unknown> }) {
  const displayClass = typeof props.display_class === "string" ? props.display_class : "";
  const i18n = useLocale();
  const { t: tr } = i18n;
  const moa = MOA_TIER[displayClass];
  const tier = moa ? { color: moa.color, label: enumLabel("fisheryMoaTier", displayClass, moa.label, i18n) } : { color: "#9e9e9e", label: displayClass || tr("popup.fishery.unknown") };
  const reason = moaReasonText(props, tr);
  return (
    <>
      <Title color={tier.color}>{tr("popup.fishery.moaTitle")}</Title>
      <Row field="classification" value={tier.label} color={tier.color} />
      {reason && (
        <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5, marginTop: 4 }}>
          ⓘ {reason}
        </div>
      )}
      <Row field="area" value={areaHa(props.area_ha)} />
      <Row field="county" value={String(props.county ?? "")} />
      <Row label={tr("popup.fishery.landUse")} value={nlscLandUse(props)} />
    </>
  );
}

/** union_class 3 值 → 代表色（同地圖分色）+ 標籤 */
const UNION_TIER: Record<string, { color: string; label: string }> = {
  both: { color: "#26c6da", label: "兩版都有 Both" },
  moa_only: { color: "#43a047", label: "只官方 MOA Only" },
  osm_only: { color: "#fb8c00", label: "只舊版 OSM Only" },
};

/** source 值 → 中文標籤（moa=官方標籤版 / osm_satellite=舊衛星偵測版） */
const UNION_SOURCE_LABEL: Record<string, string> = {
  moa: "官方標籤版 MOA",
  osm_satellite: "舊衛星偵測版 OSM",
};

/** union_class → 白話說明「這塊面是哪一版偵測到的、信心如何」 */
function unionReasonText(props: Record<string, unknown>, tr: I18n["t"]): string {
  switch (props.union_class) {
    case "both":
      return tr("popup.fishery.unionBoth");
    case "moa_only":
      return tr("popup.fishery.unionMoaOnly");
    case "osm_only":
      return tr("popup.fishery.unionOsmOnly");
    default:
      return "";
  }
}

export function AquacultureWaterUnionPanel({ props }: { props: Record<string, unknown> }) {
  const unionClass = typeof props.union_class === "string" ? props.union_class : "";
  const i18n = useLocale();
  const { t: tr } = i18n;
  const union = UNION_TIER[unionClass];
  const tier = union ? { color: union.color, label: enumLabel("fisheryUnionTier", unionClass, union.label, i18n) } : { color: "#9e9e9e", label: unionClass || tr("popup.fishery.unknown") };
  const reason = unionReasonText(props, tr);
  const sourceRaw = typeof props.source === "string" ? props.source : "";
  const sourceLabel = sourceRaw ? (UNION_SOURCE_LABEL[sourceRaw] ? enumLabel("fisheryUnionSource", sourceRaw, UNION_SOURCE_LABEL[sourceRaw], i18n) : sourceRaw) : "";
  return (
    <>
      <Title color={tier.color}>{tr("popup.fishery.unionTitle")}</Title>
      <Row field="classification" value={tier.label} color={tier.color} />
      {reason && (
        <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5, marginTop: 4 }}>
          ⓘ {reason}
        </div>
      )}
      <Row field="area" value={areaHa(props.area_ha)} />
      <Row field="county" value={String(props.county ?? "")} />
      <Row label={tr("popup.fishery.sourceVersion")} value={sourceLabel} />
    </>
  );
}

/** source 三值 → 中文標籤 + 代表色（ponds 青 / satellite 綠 / production 橙） */
const INTEGRATED_SOURCE: Record<string, { label: string; color: string }> = {
  ponds: { label: "逐口魚塭（OSM）", color: "#26c6da" },
  satellite: { label: "衛星偵測補充", color: "#66bb6a" },
  production: { label: "生產區", color: "#ffa726" },
};

export function AquacultureIntegratedPanel({ props }: { props: Record<string, unknown> }) {
  const src = typeof props.source === "string" ? props.source : "";
  const i18n = useLocale();
  const { t: tr } = i18n;
  const integ = INTEGRATED_SOURCE[src];
  const tier = integ ? { label: enumLabel("fisheryIntegratedSource", src, integ.label, i18n), color: integ.color } : { label: src || tr("popup.fishery.unknown"), color: "#9e9e9e" };
  return (
    <>
      <Title color={tier.color}>{tr("popup.fishery.integratedTitle")}</Title>
      <Row field="source" value={tier.label} color={tier.color} />
      <Row field="area" value={areaHa(props.area_ha)} />
    </>
  );
}
