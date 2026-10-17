import { Row, Title } from "./shared";
import { FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { placeName } from "../../i18n/placeText";
import { enumLabel } from "../../i18n/dataText";
import {
  facilityTypeColor, facilityTypeLabel, operatorTypeLabel,
  operatorEntityColor, operatorEntityLabel,
  precisionLabel, isApproxPrecision,
  cemeteryZoningColor, cemeteryZoningClassLabel, CEMETERY_ZONING_CLASSES,
  CEMETERY_OSM_ODBL_NOTE, FUNERAL_LAYER_COLORS,
} from "../../data/funeralTypes";

function Note({ children }: { children: React.ReactNode }) {
  const t = useFeatureTheme();
  return (
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));

/**
 * 座標精度誠實標記（A 源兩層共用）。
 * ⚠️ 設施有 42%（parcel_centroid 1,576 + approximate 429）不是實際入口位置 ——
 *    使用者若拿去導航會被誤導，故概略值一律明講；精確段位不佔版面。
 */
function PrecisionNote({ precision }: { precision: string }) {
  const i18n = useLocale();
  if (!precision) return null;
  if (!isApproxPrecision(precision)) return null;
  return <Note>{i18n.t("popup.funeral.approxNote", { label: enumLabel("funeralPrecision", precision, precisionLabel(precision), i18n) })}</Note>;
}

/**
 * A 源 · 殯葬設施（3,707 點）：facility_type 6 類分色。
 * name 上游保證非 null，但可能是空字串 → fallback 用類型名不憑空造名。
 */
export function FuneralFacilityPanel({ props }: { props: Record<string, unknown> }) {
  const type = str(props.facility_type);
  const color = facilityTypeColor(type);
  const district = str(props.district);
  const i18n = useLocale();
  const { t } = i18n;
  const typeLabel = type ? enumLabel("funeralFacilityType", type, facilityTypeLabel(type), i18n) : t("popup.common.unclassified");
  const opType = str(props.operator_type);
  return (
    <>
      <Title color={color}>{str(props.name) || typeLabel}</Title>
      <Row field="type" value={typeLabel} color={color} />
      <Row field="publicPrivate" value={enumLabel("funeralOperatorType", opType, operatorTypeLabel(opType), i18n)} />
      {str(props.eco_type) ? <Row label={t("popup.funeral.ecoType")} value={str(props.eco_type)} /> : null}
      <Row field="district" value={placeName(district ? `${str(props.county)}${district}` : str(props.county), i18n)} />
      <Row field="phone" value={str(props.phone)} />
      <PrecisionNote precision={str(props.precision)} />
    </>
  );
}

/**
 * A 源 · 禮儀業者（6,233 點，圖層預設只畫仍營業的 4,569）：entity_type 2 類分色。
 * capital 僅公司登記有值（獨資合夥為 null）。
 */
export function FuneralOperatorPanel({ props }: { props: Record<string, unknown> }) {
  const entity = str(props.entity_type);
  const color = operatorEntityColor(entity);
  const active = props.is_active === true;
  const capital = typeof props.capital === "number" ? props.capital : null;
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  return (
    <>
      <Title color={color}>{str(props.name) || t("popup.funeral.operatorTitle")}</Title>
      <Row field="registrationType" value={entity ? enumLabel("funeralOperatorEntity", entity, operatorEntityLabel(entity), i18n) : t("popup.common.unclassified")} color={color} />
      <Row
        label={t("popup.funeral.bizStatus")}
        // status 幾乎必有值；fallback 用「已失效」不用「已歇業」——這桶含遷他縣市
        value={str(props.status) || (active ? t("popup.funeral.statusApproved") : t("popup.funeral.statusInactive"))}
        color={active ? undefined : "#9e9e9e"}
      />
      {capital != null ? <Row field="capital" value={t("popup.funeral.yuan", { value: formatNumber(capital) })} /> : null}
      <Row field="businessId" value={str(props.uniform_id)} />
      <Row field="district" value={placeName(`${str(props.county)}${str(props.district)}`, i18n)} />
      <PrecisionNote precision={str(props.precision)} />
    </>
  );
}

/**
 * A 源 · 區級業者密度（325 區）。
 * operatorCount 來自 feature-state（非 baked properties）—— useMapInteraction 已把
 * `f.state` 併進 properties，見該檔 feature-state 白名單。
 */
export function FuneralOperatorDensityPanel({ props }: { props: Record<string, unknown> }) {
  const count = typeof props.operatorCount === "number" ? props.operatorCount : 0;
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  return (
    <>
      <Title color={FUNERAL_LAYER_COLORS.funeralOperatorDensity}>
        {placeName(`${str(props.COUNTYNAME)}${str(props.TOWNNAME)}`, i18n) || t("popup.funeral.townFallback")}
      </Title>
      <Row label={t("popup.funeral.registeredOperators")} value={t("popup.funeral.operatorCount", { count, value: formatNumber(count) })} />
      <Note>
        {t("popup.funeral.densityNote1")}<b>{t("popup.funeral.densityNoteBold")}</b>{t("popup.funeral.densityNote2")}
      </Note>
    </>
  );
}

/**
 * B 源 · OSM 墓區面（3,229 面）。
 * ⚠️ 僅 34.5% 有 name → 標題用 osm_id 兜底，不做以名稱為主的呈現。
 * 🔴 ODbL：本層一律顯示 © OpenStreetMap contributors。
 */
export function CemeteryOsmPanel({ props }: { props: Record<string, unknown> }) {
  const name = str(props.name);
  const area = typeof props.area_ha === "number" ? props.area_ha : null;
  const { t } = useLocale();
  return (
    <>
      <Title color={FUNERAL_LAYER_COLORS.cemeteryOsm}>{name || t("popup.funeral.unnamedCemetery")}</Title>
      {area != null ? <Row field="area" value={t("popup.funeral.hectare", { value: area.toFixed(2) })} /> : null}
      <Row label={t("popup.funeral.osmTag")} value={str(props.landuse) || str(props.amenity)} />
      <Row field="osmId" value={str(props.osm_id)} />
      {name ? null : <Note>{t("popup.funeral.osmNoName")}</Note>}
      <Note>{t("popup.funeral.osmNote", { note: CEMETERY_OSM_ODBL_NOTE })}</Note>
    </>
  );
}

/**
 * C 源 · 都市計畫墓葬類法定用地（114 面 / 702.6 ha）。
 * ⚠️ 僅臺北（12）＋新北（102），且只含都市土地 —— 山區大型公墓多在非都市土地的
 *    「墳墓用地」編定，那份資料尚未取得。
 */
export function CemeteryZoningPanel({ props }: { props: Record<string, unknown> }) {
  const zone = str(props.zone_label);
  const color = cemeteryZoningColor(zone);
  const area = typeof props.area_ha === "number" ? props.area_ha : null;
  const i18n = useLocale();
  const { t } = i18n;
  const classValue = CEMETERY_ZONING_CLASSES.find((c) => c.raw.includes(zone))?.value;
  return (
    <>
      <Title color={color}>{zone || t("popup.funeral.zoningFallback")}</Title>
      <Row label={t("popup.funeral.zoningGroup")} value={!zone ? t("popup.common.unclassified") : classValue ? enumLabel("funeralZoningClass", classValue, cemeteryZoningClassLabel(zone), i18n) : zone} color={color} />
      {area != null ? <Row field="area" value={t("popup.funeral.hectare", { value: area.toFixed(2) })} /> : null}
      <Row field="county" value={placeName(str(props.county), i18n)} />
      <Row label={t("popup.funeral.zoningId")} value={str(props.zoning_id)} />
      <Note>{t("popup.funeral.zoningNote1")}<b>{t("popup.funeral.zoningNoteBold")}</b>{t("popup.funeral.zoningNote2")}</Note>
    </>
  );
}
