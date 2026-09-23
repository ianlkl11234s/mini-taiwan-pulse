import { Row, SourceFooter } from "./shared";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
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

const translatedList = (value: unknown, labels: Record<string, string>): string => {
  const raw = text(value).trim();
  if (!raw) return "";
  const values = raw.startsWith("[")
    ? (() => { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.map(String) : [raw]; } catch { return [raw]; } })()
    : raw.split(",").map((item) => item.trim()).filter(Boolean);
  return values.map((item) => labels[item] ?? item).join("、");
};

const displayGeometry = (value: unknown) => value === "source_point_unchanged"
  ? "原始點位"
  : value === "representative_point_for_point_layer"
    ? "由原始線／面取內部代表點（僅供點圖層顯示）"
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
  const accent = osmAccent(props, accessibilityMode);
  const featureType = text(props.feature_type);
  const featureLabel = FEATURE_TYPE_LABELS[featureType] ?? featureType;
  return <>
    <PanelHeader title={text(props.name) || `未命名${featureLabel || " OSM 設施"}`} color={accent} />
    <Row label="資料角色" value="OSM 公共生活設施快照" color={accent} />
    <Row label="設施類型" value={featureLabel} />
    <Row label="據點型態" value={RECYCLING_TYPE_LABELS[text(props.recycling_type)] ?? text(props.recycling_type)} />
    <Row label="營運者" value={text(props.operator)} />
    <Row label="開放時間" value={text(props.opening_hours)} />
    <Row label="無障礙" value={(ACCESSIBILITY_LABELS[text(props.wheelchair)] ?? text(props.wheelchair)) || "未標註／未知（unknown，不等於 no）"} />
    <Row label="無障礙狀態" value={ACCESSIBILITY_LABELS[text(props.accessibility_status)] ?? text(props.accessibility_status)} />
    <Row label="無障礙公廁" value={text(props.toilets_wheelchair)} />
    <Row label="觸覺鋪面" value={text(props.tactile_paving)} />
    <Row label="坡道" value={text(props.ramp)} />
    <Row label="單車補給" value={translatedList(props.categories_text || props.categories, BICYCLE_CATEGORY_LABELS)} />
    <Row label="回收材料" value={text(props.materials_text) || text(props.materials)} />
    <Row label="定位精度" value={text(props.geometry_precision)} />
    <Row label="原始幾何" value={text(props.source_geometry_type)} />
    <Row label="顯示位置" value={displayGeometry(props.display_geometry_method)} />
    <Row label="涵蓋限制" value={text(props.coverage_scope) || "群眾標註且不完整；空白區域不代表沒有設施。"} />
    <SourceFooter props={props} />
  </>;
}

export function PublicLifeOsmPanel({ props }: Props) {
  return <PublicLifeOsmPanelContent props={props} />;
}

export function AccessibleParkFacilitiesPanel({ props }: Props) {
  return <PublicLifeOsmPanelContent props={props} accessibilityMode />;
}

export function DisasterShelterPanel({ props }: Props) {
  return <>
    <PanelHeader title={text(props.name) || "未命名收容處所"} color={PUBLIC_LIFE_COLORS.disasterShelters} />
    <Row label="資料角色" value="預定天災收容處所" color={PUBLIC_LIFE_COLORS.disasterShelters} />
    <Row label="縣市鄉鎮" value={text(props.county_town)} />
    <Row label="地址" value={text(props.address)} />
    <Row label="預計容量" value={text(props.capacity)} />
    <Row label="適用災害" value={text(props.disaster_types_text) || text(props.disaster_types)} />
    <Row label="室內 / 室外" value={`${text(props.indoor) || "unknown"} / ${text(props.outdoor) || "unknown"}`} />
    <Row label="弱勢安置" value={text(props.vulnerable_services) || "unknown"} />
    <Row label="定位精度" value={text(props.geometry_precision)} />
    <Row label="顯示位置" value={displayGeometry(props.display_geometry_method)} />
    <Row label="重要提醒" value="預定收容處所，不代表目前已開設。" />
    <SourceFooter props={{ ...props, source_org: "內政部消防署 data.gov.tw 73242", license: props.license ?? "政府資料開放授權條款第1版" }} />
  </>;
}

export function NationalParkPanel({ props }: Props) {
  return <>
    <PanelHeader title={text(props.name) || "國家公園"} color="#15803d" />
    <Row label="資料角色" value="官方計畫邊界" color="#15803d" />
    <Row label="類型" value={text(props.type)} />
    <Row label="計畫版次" value={text(props.plan_revision)} />
    <Row label="覆蓋語意" value={text(props.coverage_mode)} />
    <Row label="幾何精度" value={text(props.geometry_precision)} />
    <Row label="重要提醒" value="官方計畫邊界；不代表即時開放、封閉或遊客管制狀態。" />
    <SourceFooter props={{ ...props, source_org: "國家公園署 / 海洋國家公園管理處 / TGOS" }} />
  </>;
}

export function PublicLifeOsmCoveragePanel({ props }: Props) {
  return <>
    <PanelHeader title="公共生活 OSM 映射密度" color="#2563eb" />
    <Row label="觀測總數" value={text(props.observed_count)} />
    <Row label="資料集數" value={text(props.dataset_count)} />
    <Row label="飲水點" value={text(props.drinking_count)} />
    <Row label="垃圾桶" value={text(props.waste_basket_count)} />
    <Row label="回收點" value={text(props.recycling_count)} />
    <Row label="遊戲場" value={text(props.playground_count)} />
    <Row label="無障礙 tags" value={text(props.accessibility_tag_count)} />
    <Row label="自行車專屬補給" value={text(props.bicycle_specific_count)} />
    <Row label="遊客中心" value={text(props.visitor_centre_count)} />
    <Row label="快照時間" value={text(props.snapshot_at)} />
    <Row label="重要提醒" value="OSM 映射密度，不是服務品質、人口覆蓋或道路可達性。" />
    <SourceFooter props={props} />
  </>;
}
