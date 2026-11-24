// 設施研究 M（站主限定）popup：內容全部讀 feature 屬性（*_label 欄位由私人檔提供），欄位標題用中性字。
import { Row, Title } from "./shared";
import { siteStudyColor } from "../../data/siteStudyMTypes";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";

const str = (value: unknown): string => (value === null || value === undefined ? "" : String(value));

/** `names` 以 | 分隔；去掉與標題相同的那個，其餘用頓號接起來。 */
export function siteStudyOtherNames(names: unknown, title: string): string {
  return [...new Set(str(names).split("|").map((n) => n.trim()).filter((n) => n && n !== title))].join("、");
}

export function SiteStudyMPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const accent = siteStudyColor(props.color);
  const layerName = localizeLayerName("siteStudyM", LAYER_MANIFEST.siteStudyM.name, i18n).primary;
  if (props._part === "overlays") {
    const title = str(props.name) || str(props.overlay_label) || layerName;
    return (
      <>
        <Title color={accent}>{title}</Title>
        <Row field="type" value={str(props.overlay_label)} color={accent} />
        <Row label={t("popup.siteStudy.geometry")} value={str(props.geom_label)} />
        <Row field="source" value={str(props.source_label)} />
        <Row field="date" value={str(props.source_date)} mono />
        <Row field="remarks" value={str(props.note)} />
        <Row label={t("popup.siteStudy.linkedIds")} value={str(props.link_site_ids)} mono />
      </>
    );
  }
  const title = str(props.name) || str(props.kind_label) || layerName;
  const area = typeof props.area_m2 === "number" && Number.isFinite(props.area_m2) ? `${formatNumber(props.area_m2)} m²` : "";
  return (
    <>
      <Title color={accent}>{title}</Title>
      <Row field="type" value={str(props.kind_label)} color={accent} />
      <Row field="status" value={str(props.status_label)} />
      <Row label={t("popup.siteStudy.geometry")} value={str(props.geom_label)} />
      <Row field="source" value={str(props.sources_label)} />
      <Row label={t("popup.siteStudy.otherNames")} value={siteStudyOtherNames(props.names, title)} />
      <Row field="area" value={area} mono />
    </>
  );
}
