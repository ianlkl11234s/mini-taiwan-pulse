import { Row, SourceFooter } from "./shared";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { useLocale, type LocaleSnapshot } from "../../state/localeStore";
import { placeName } from "../../i18n/placeText";
import { enumLabel } from "../../i18n/dataText";
import {
  ACCESSIBILITY_STATUS_COLORS, BICYCLE_SUPPORT_COLORS, PUBLIC_LIFE_COLORS,
} from "../../data/publicLifePalette";

type Props = { props: Record<string, unknown> };

const text = (v: unknown) => v == null ? "" : String(v);

const FEATURE_TYPE_LABELS: Record<string, string> = {
  drinking_water: "飲水點",
  waste_basket: "公共垃圾桶",
  recycling: "資源回收點",
  playground: "遊戲場",
  visitor_centre: "遊客中心",
  bicycle_support: "自行車支援設施",
  accessible_poi: "其他無障礙 POI",
  path: "路徑",
  toilet: "公廁",
  park: "公園",
  entrance: "出入口",
};

const ACCESSIBILITY_LABELS: Record<string, string> = {
  yes: "可無障礙使用（yes）",
  limited: "部分可使用（limited）",
  no: "不可無障礙使用（no）",
  unknown: "未標註／未知（unknown，不等於 no）",
};

const RECYCLING_TYPE_LABELS: Record<string, string> = {
  centre: "回收中心",
  container: "回收容器",
  reverse_vending_machine: "逆向販賣機",
};

const BICYCLE_CATEGORY_LABELS: Record<string, string> = {
  repair: "維修",
  air: "打氣",
  parking: "停車",
  water: "飲水",
  toilet: "公廁",
};

const translatedList = (value: unknown, domain: string, labels: Record<string, string>, i18n: LocaleSnapshot): string => {
  const raw = text(value).trim();
  if (!raw) return "";
  const values = raw.startsWith("[")
    ? (() => { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.map(String) : [raw]; } catch { return [raw]; } })()
    : raw.split(",").map((item) => item.trim()).filter(Boolean);
  return values.map((item) => (labels[item] ? enumLabel(domain, item, labels[item], i18n) : item)).join(i18n.t("popup.common.listSeparator"));
};

const displayGeometry = (value: unknown, tr: LocaleSnapshot["t"]) => value === "source_point_unchanged"
  ? tr("popup.publicLife.geometrySourcePoint")
  : value === "representative_point_for_point_layer"
    ? tr("popup.publicLife.geometryRepresentativePoint")
    : text(value);

function PanelHeader({ title, color }: { title: string; color: string }) {
  const t = useFeatureTheme();
  return <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
    <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
    <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>{title}</div>
  </div>;
}

function osmAccent(props: Record<string, unknown>, accessibilityMode = false): string {
  if (accessibilityMode) {
    const status = text(props.accessibility_status) as keyof typeof ACCESSIBILITY_STATUS_COLORS;
    return ACCESSIBILITY_STATUS_COLORS[status] ?? ACCESSIBILITY_STATUS_COLORS.unknown;
  }
  if (props.feature_type === "drinking_water") return PUBLIC_LIFE_COLORS.drinkingWaterPoints;
  if (props.feature_type === "waste_basket") return PUBLIC_LIFE_COLORS.publicWasteBaskets;
  if (props.feature_type === "recycling") return PUBLIC_LIFE_COLORS.materialRecyclingPoints;
  if (props.feature_type === "playground") return PUBLIC_LIFE_COLORS.playgrounds;
  if (props.feature_type === "visitor_centre") return PUBLIC_LIFE_COLORS.visitorCentres;
  if (props.feature_type === "bicycle_support") return BICYCLE_SUPPORT_COLORS.other;
  return ACCESSIBILITY_STATUS_COLORS.unknown;
}

function PublicLifeOsmPanelContent({ props, accessibilityMode = false }: Props & { accessibilityMode?: boolean }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const accent = osmAccent(props, accessibilityMode);
  const featureType = text(props.feature_type);
  const featureLabel = FEATURE_TYPE_LABELS[featureType]
    ? enumLabel("publicLifeFeatureType", featureType, FEATURE_TYPE_LABELS[featureType], i18n)
    : featureType;
  const recyclingType = text(props.recycling_type);
  const accessLabel = (code: string) =>
    ACCESSIBILITY_LABELS[code] ? enumLabel("publicLifeAccessibility", code, ACCESSIBILITY_LABELS[code], i18n) : code;
  return <>
    <PanelHeader
      title={text(props.name) || (featureLabel ? tr("popup.publicLife.unnamedType", { type: featureLabel }) : tr("popup.publicLife.unnamedOsm"))}
      color={accent}
    />
    <Row field="dataRole" value={tr("popup.publicLife.osmRole")} color={accent} />
    <Row field="facilityType" value={featureLabel} />
    <Row
      label={tr("popup.publicLife.recyclingType")}
      value={RECYCLING_TYPE_LABELS[recyclingType] ? enumLabel("publicLifeRecyclingType", recyclingType, RECYCLING_TYPE_LABELS[recyclingType], i18n) : recyclingType}
    />
    <Row field="operator" value={text(props.operator)} />
    <Row field="openingHours" value={text(props.opening_hours)} />
    <Row label={tr("popup.publicLife.accessibility")} value={accessLabel(text(props.wheelchair)) || accessLabel("unknown")} />
    <Row label={tr("popup.publicLife.accessibilityStatus")} value={accessLabel(text(props.accessibility_status))} />
    <Row label={tr("popup.publicLife.accessibleToilet")} value={text(props.toilets_wheelchair)} />
    <Row label={tr("popup.publicLife.tactilePaving")} value={text(props.tactile_paving)} />
    <Row label={tr("popup.publicLife.ramp")} value={text(props.ramp)} />
    <Row label={tr("popup.publicLife.bicycleSupply")} value={translatedList(props.categories_text || props.categories, "publicLifeBicycleCategory", BICYCLE_CATEGORY_LABELS, i18n)} />
    <Row label={tr("popup.publicLife.recyclingMaterials")} value={text(props.materials_text) || text(props.materials)} />
    <Row field="positionAccuracy" value={text(props.geometry_precision)} />
    <Row label={tr("popup.publicLife.sourceGeometry")} value={text(props.source_geometry_type)} />
    <Row label={tr("popup.publicLife.displayPosition")} value={displayGeometry(props.display_geometry_method, tr)} />
    <Row field="coverageLimit" value={text(props.coverage_scope) || tr("popup.publicLife.coverageDefault")} />
  </>;
}

export function PublicLifeOsmPanel({ props }: Props) {
  return <PublicLifeOsmPanelContent props={props} />;
}

export function AccessibleParkFacilitiesPanel({ props }: Props) {
  return <PublicLifeOsmPanelContent props={props} accessibilityMode />;
}

export function DisasterShelterPanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  return <>
    <PanelHeader title={text(props.name) || tr("popup.publicLife.unnamedShelter")} color={PUBLIC_LIFE_COLORS.disasterShelters} />
    <Row field="dataRole" value={tr("popup.publicLife.shelterRole")} color={PUBLIC_LIFE_COLORS.disasterShelters} />
    <Row field="countyTownship" value={placeName(text(props.county_town), i18n)} />
    <Row field="address" value={text(props.address)} />
    <Row label={tr("popup.publicLife.shelterCapacity")} value={text(props.capacity)} />
    <Row label={tr("popup.publicLife.disasterTypes")} value={text(props.disaster_types_text) || text(props.disaster_types)} />
    <Row label={tr("popup.publicLife.indoorOutdoor")} value={`${text(props.indoor) || "unknown"} / ${text(props.outdoor) || "unknown"}`} />
    <Row label={tr("popup.publicLife.vulnerableServices")} value={text(props.vulnerable_services) || "unknown"} />
    <Row field="positionAccuracy" value={text(props.geometry_precision)} />
    <Row label={tr("popup.publicLife.displayPosition")} value={displayGeometry(props.display_geometry_method, tr)} />
    <Row label={tr("popup.publicLife.importantNote")} value={tr("popup.publicLife.shelterNote")} />
    <SourceFooter props={{ ...props, source_org: tr("popup.publicLife.shelterSourceOrg"), license: props.license ?? tr("popup.publicLife.shelterLicense") }} />
  </>;
}

export function NationalParkPanel({ props }: Props) {
  const { t: tr } = useLocale();
  return <>
    <PanelHeader title={text(props.name) || tr("popup.publicLife.nationalPark")} color="#15803d" />
    <Row field="dataRole" value={tr("popup.publicLife.parkRole")} color="#15803d" />
    <Row field="type" value={text(props.type)} />
    <Row label={tr("popup.publicLife.planRevision")} value={text(props.plan_revision)} />
    <Row label={tr("popup.publicLife.coverageMode")} value={text(props.coverage_mode)} />
    <Row label={tr("popup.publicLife.geometryPrecision")} value={text(props.geometry_precision)} />
    <Row label={tr("popup.publicLife.importantNote")} value={tr("popup.publicLife.parkNote")} />
    <SourceFooter props={{ ...props, source_org: tr("popup.publicLife.parkSourceOrg") }} />
  </>;
}

export function PublicLifeOsmCoveragePanel({ props }: Props) {
  const { t: tr } = useLocale();
  return <>
    <PanelHeader title={tr("popup.publicLife.coverageTitle")} color="#2563eb" />
    <Row label={tr("popup.publicLife.observedTotal")} value={text(props.observed_count)} />
    <Row label={tr("popup.publicLife.datasetCount")} value={text(props.dataset_count)} />
    <Row label={tr("popup.publicLife.drinking")} value={text(props.drinking_count)} />
    <Row label={tr("popup.publicLife.wasteBasket")} value={text(props.waste_basket_count)} />
    <Row label={tr("popup.publicLife.recyclingPoint")} value={text(props.recycling_count)} />
    <Row label={tr("popup.publicLife.playground")} value={text(props.playground_count)} />
    <Row label={tr("popup.publicLife.accessibilityTags")} value={text(props.accessibility_tag_count)} />
    <Row label={tr("popup.publicLife.bicycleSpecific")} value={text(props.bicycle_specific_count)} />
    <Row label={tr("popup.publicLife.visitorCentre")} value={text(props.visitor_centre_count)} />
    <Row field="snapshotAt" value={text(props.snapshot_at)} />
    <Row label={tr("popup.publicLife.importantNote")} value={tr("popup.publicLife.coverageNote")} />
  </>;
}
