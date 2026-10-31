// 南韓圖層 popup（2026-10-31 第 0 波起）。來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import {
  KR_ADMIN_ATTRIBUTION, KR_ADMIN_COLOR, KR_ADMIN_FETCHED_AT, KR_ADMIN_LICENSE, KR_ADMIN_SOURCE_URL, KR_ADMIN_VERSION,
} from "../../data/krAdminTypes";

const text = (value: unknown) => (value == null ? "" : String(value).trim());

const LEVEL_KEYS = {
  sido: "popup.baseMap.krLevelSido",
  sgg: "popup.baseMap.krLevelSgg",
  emd: "popup.baseMap.krLevelEmd",
} as const;

/**
 * 南韓行政邊界（admdongkor ver20261001）：名稱、層級、所屬上級、行政安全部代碼與統計廳代碼並列。
 * 三個 tile layer 欄位不同：sido（sido_*）、sgg（sgg_*＋sido_*）、emd（emd_*＋sgg_*＋sido_*）。
 */
export function KrAdminBoundariesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const level = text(props.level) as keyof typeof LEVEL_KEYS;
  const sido = [text(props.sido_name), text(props.sido_name_en)].filter(Boolean).join(" · ");
  const name = level === "emd" ? text(props.emd_name) : level === "sgg" ? text(props.sgg_name) : text(props.sido_name);
  const code = level === "emd" ? text(props.emd_code) : level === "sgg" ? text(props.sgg_code) : text(props.sido_code);
  const kostat = level === "emd" ? text(props.emd_code_kostat) : level === "sgg" ? text(props.sgg_code_kostat) : text(props.sido_code_kostat);
  return <>
    <Title color={KR_ADMIN_COLOR}>{name || t("popup.baseMap.krAdmin")}</Title>
    {level in LEVEL_KEYS ? <Row label={t("popup.baseMap.krLevel")} value={t(LEVEL_KEYS[level])} /> : null}
    {level === "sido" && text(props.sido_name_en) ? <Row label={t("popup.baseMap.krNameEnglish")} value={text(props.sido_name_en)} /> : null}
    {level !== "sido" ? <Row label={t("popup.baseMap.krSido")} value={sido} /> : null}
    {level === "emd" ? <Row label={t("popup.baseMap.krSgg")} value={[text(props.sgg_name), text(props.sgg_code)].filter(Boolean).join(" · ")} /> : null}
    <Row label={t("popup.baseMap.krMoisCode")} value={code} />
    {kostat ? <Row label={t("popup.baseMap.krKostatCode")} value={kostat} /> : null}
    <Row label={t("popup.baseMap.gbDataVersion")} value={KR_ADMIN_VERSION} />
    <SourceFooter props={{ source_org: KR_ADMIN_ATTRIBUTION, source_url: KR_ADMIN_SOURCE_URL, license: KR_ADMIN_LICENSE, fetched_at: KR_ADMIN_FETCHED_AT }} />
  </>;
}
