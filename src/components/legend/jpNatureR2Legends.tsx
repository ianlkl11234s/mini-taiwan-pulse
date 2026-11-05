/**
 * 日本第二輪（2026-11-06）四層圖例：自然公園地域 2015、国立公園（環境省）、国指定鳥獣保護区、人口集中地区 DID。
 * 色、類別、級距全部讀 `data/jpNatureR2Types.ts`；i18n key 寫成字面值（localeParity 靠字面值判斷 key 有沒有人用）。
 */
import { LegendNote, LegendNum, LegendRow, LegendTitle, SwatchSquare, useLegendTheme } from "./legendKit";
import { paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import { useLocale } from "../../state/localeStore";
import {
  JP_NATURAL_PARK_LEVELS, JP_NATURAL_PARK_AREAS_ATTRIBUTION, JP_NATIONAL_PARK_ZONES, JP_NATIONAL_PARKS_MOE_ATTRIBUTION,
  JP_WILDLIFE_CATEGORIES, JP_WILDLIFE_MOE_ATTRIBUTION, JP_DID_DEFAULT_YEAR, JP_DID_DENSITY_LABELS, JP_DID_COUNTS, JP_DID_YEARS,
  jpDidAttribution, jpDidRamp,
} from "../../data/jpNatureR2Types";

export const JP_NATURAL_PARK_LEVEL_KEYS = {
  "1": "legend.jpNature.level.1",
  "2": "legend.jpNature.level.2",
  "3": "legend.jpNature.level.3",
} as const;
export const JP_NATIONAL_PARK_ZONE_KEYS = {
  特別保護地区: "legend.jpNature.zone.specialProtection",
  第1種特別地域: "legend.jpNature.zone.special1",
  第2種特別地域: "legend.jpNature.zone.special2",
  第3種特別地域: "legend.jpNature.zone.special3",
  普通地域: "legend.jpNature.zone.ordinary",
  海域公園地区: "legend.jpNature.zone.marine",
  区分未定: "legend.jpNature.zone.undetermined",
} as const satisfies Record<(typeof JP_NATIONAL_PARK_ZONES)[number]["value"], string>;
export const JP_WILDLIFE_CATEGORY_KEYS = {
  集団渡来地: "legend.jpNature.wildlife.migration",
  集団繁殖地: "legend.jpNature.wildlife.breeding",
  希少鳥獣生息地: "legend.jpNature.wildlife.rare",
  大規模生息地: "legend.jpNature.wildlife.large",
} as const satisfies Record<(typeof JP_WILDLIFE_CATEGORIES)[number]["value"], string>;

export function JpNaturalParkAreas2015Legend() {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.jpNature.parkAreasTitle")} />
    {JP_NATURAL_PARK_LEVELS.map((l) => <LegendRow key={l.value} swatch={<SwatchSquare color={l.color} />}>{t(JP_NATURAL_PARK_LEVEL_KEYS[l.value])}</LegendRow>)}
    <LegendNote>{t("legend.jpNature.parkAreasScope")}</LegendNote>
    <LegendNote>{t("legend.jpNature.parkAreasAccuracy")}</LegendNote>
    <LegendNote>{t("legend.jpNature.okayama")}</LegendNote>
    <LegendNote>{JP_NATURAL_PARK_AREAS_ATTRIBUTION}</LegendNote>
  </div>;
}

export function JpNationalParksMoeLegend() {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.jpNature.nationalParksTitle")} />
    {JP_NATIONAL_PARK_ZONES.map((z) => <LegendRow key={z.value} swatch={<SwatchSquare color={z.color} />}>{t(JP_NATIONAL_PARK_ZONE_KEYS[z.value])}</LegendRow>)}
    <LegendNote>{t("legend.jpNature.nationalParksScope")}</LegendNote>
    <LegendNote>{t("legend.jpNature.moeLicense")}</LegendNote>
    <LegendNote>{JP_NATIONAL_PARKS_MOE_ATTRIBUTION}</LegendNote>
  </div>;
}

export function JpWildlifeProtectionMoeLegend() {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.jpNature.wildlifeTitle")} />
    {JP_WILDLIFE_CATEGORIES.map((c) => <LegendRow key={c.value} swatch={<SwatchSquare color={c.color} />}>{t(JP_WILDLIFE_CATEGORY_KEYS[c.value])}</LegendRow>)}
    <LegendNote>{t("legend.jpNature.wildlifeScope")}</LegendNote>
    <LegendNote>{t("legend.jpNature.moeLicense")}</LegendNote>
    <LegendNote>{JP_WILDLIFE_MOE_ATTRIBUTION}</LegendNote>
  </div>;
}

export function JpDidLegend() {
  const { t, formatNumber } = useLocale();
  const theme = useLegendTheme();
  const values = useLayerParams("jpDid");
  const year = paramStr(values, "jpDid", "jpDidYear");
  const y = (JP_DID_YEARS as readonly string[]).includes(year) ? (year as (typeof JP_DID_YEARS)[number]) : JP_DID_DEFAULT_YEAR;
  const colors = jpDidRamp(theme.isDark);
  return <div>
    <LegendTitle zh={t("legend.jpNature.didTitle", { year: y })} />
    {JP_DID_DENSITY_LABELS.map((label, i) => <LegendRow key={label} swatch={<SwatchSquare color={colors[i]!} />}><LegendNum>{label}</LegendNum></LegendRow>)}
    <LegendNote>{t("legend.jpNature.didCount", { n: formatNumber(JP_DID_COUNTS[y]) })}</LegendNote>
    <LegendNote>{t("legend.jpNature.didDefinition")}</LegendNote>
    <LegendNote>{t("legend.jpNature.didScope")}</LegendNote>
    <LegendNote>{jpDidAttribution(y)}</LegendNote>
  </div>;
}
