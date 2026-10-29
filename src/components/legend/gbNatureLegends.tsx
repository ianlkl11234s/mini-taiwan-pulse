// 英國第 5 波自然與林業圖例（2026-10-29）：保護區、海洋保護區、林地、森林遊憩、步道、開放進入地、樹木保護。
// 色票與署名 SSOT 在 data/gbNatureTypes.ts；每層標「未涵蓋」或「制度不適用」地區與來源署名。
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import {
  GB_ACCESS_TYPES, GB_DESIGNATIONS, GB_LANDSCAPE_FILL_FACTOR, GB_MPA_SOURCES, GB_MPA_TYPES, GB_NATIONAL_TRAIL_COLOR,
  GB_OPEN_ACCESS_SOURCES, GB_PROTECTED_SOURCES, GB_RECREATION_CATEGORIES, GB_RECREATION_SOURCES, GB_RECREATION_UNCLASSIFIED_COLOR,
  GB_TPO_TREE_ORGS, GB_TPO_ZONE_ORGS, GB_TRAIL_CATEGORIES, GB_TRAIL_SOURCES, GB_TRAIL_UNCLASSIFIED_COLOR, GB_TREE_CATEGORIES,
  GB_TREE_SOURCES, GB_WOODLAND_FC_ATTRIBUTION, GB_WOODLAND_GROUPS, GB_WOODLAND_NI_ATTRIBUTION, GB_WOODLAND_NI_COLOR,
  type GbAccessType, type GbDesignation, type GbDesignationGroup, type GbMpaType, type GbRecreationCategory, type GbTrailCategory,
  type GbTreeCategory, type GbWoodlandGroup,
} from "../../data/gbNatureTypes";
import { LINE_WIDTH } from "../../map/mapStyleScale";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import type { MessageKey } from "../../i18n/keys";

type I18n = ReturnType<typeof useLocale>;
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}
function Attributions({ items }: { items: readonly string[] }) {
  return <>{items.map((a) => <LegendNote key={a}>{a}</LegendNote>)}</>;
}

export const GB_DESIGNATION_KEYS: Record<GbDesignation, MessageKey> = {
  national_park: "legend.environment.gbPaNationalPark", aonb: "legend.environment.gbPaAonb", nsa: "legend.environment.gbPaNsa",
  sssi: "legend.environment.gbPaSssi", nnr: "legend.environment.gbPaNnr",
  sac: "legend.environment.gbPaSac", spa: "legend.environment.gbPaSpa", ramsar: "legend.environment.gbPaRamsar",
};
const DESIGNATION_GROUP_KEYS: Record<GbDesignationGroup, MessageKey> = {
  landscape: "legend.environment.gbPaLandscapeHeading", domestic: "legend.environment.gbPaDomesticHeading", international: "legend.environment.gbPaInternationalHeading",
};

/** 英國保護區：三組（景觀／國內法／國際），景觀類淡填色；北愛無國家公園、蘇格蘭以 NSA 代替 AONB。 */
export function GbProtectedAreasLegend() {
  const i18n = useLocale();
  const groups: GbDesignationGroup[] = ["landscape", "domestic", "international"];
  return <div>
    <LegendTitle zh={layerTitle("gbProtectedAreas", i18n)} en="Protected Areas" />
    {groups.map((g) => <div key={g}>
      <LegendNote>{i18n.t(DESIGNATION_GROUP_KEYS[g])}</LegendNote>
      {GB_DESIGNATIONS.filter((d) => d.group === g).map((d) => (
        <LegendRow key={d.value} swatch={<SwatchSquare color={d.color} stroke={d.color} opacity={g === "landscape" ? 0.9 * GB_LANDSCAPE_FILL_FACTOR : 0.9} />}>
          {i18n.t(GB_DESIGNATION_KEYS[d.value])}
        </LegendRow>
      ))}
    </div>)}
    <LegendNote>{i18n.t("legend.environment.gbPaOverlap")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbPaNiNoPark")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbPaScotlandNsa")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbPaZoom")}</LegendNote>
    <Attributions items={Object.values(GB_PROTECTED_SOURCES)} />
  </div>;
}

export const GB_MPA_TYPE_KEYS: Record<GbMpaType, MessageKey> = {
  mcz: "legend.maritime.gbMpaMcz", ncmpa: "legend.maritime.gbMpaNcmpa", drmpa: "legend.maritime.gbMpaDrmpa",
};

/** 英國海洋保護區：三類；威爾斯未涵蓋、英格蘭 HPMA 授權 HOLD 未收、不可航行。 */
export function GbMarineProtectedAreasLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbMarineProtectedAreas", i18n)} en="Marine Protected Areas" />
    {GB_MPA_TYPES.map((m) => <LegendRow key={m.value} swatch={<SwatchSquare color={m.color} stroke={m.color} />}>{i18n.t(GB_MPA_TYPE_KEYS[m.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.maritime.gbMpaWales")}</LegendNote>
    <LegendNote>{i18n.t("legend.maritime.gbMpaHpma")}</LegendNote>
    <LegendNote>{i18n.t("legend.maritime.gbMpaSacSpa")}</LegendNote>
    <LegendNote>{i18n.t("legend.maritime.gbMpaNav")}</LegendNote>
    <Attributions items={Object.values(GB_MPA_SOURCES).map((s) => s.attribution)} />
  </div>;
}

export const GB_WOODLAND_GROUP_KEYS: Record<GbWoodlandGroup, MessageKey> = {
  broadleaved: "legend.environment.gbWoodBroadleaved", conifer: "legend.environment.gbWoodConifer",
  young: "legend.environment.gbWoodYoung", cleared: "legend.environment.gbWoodCleared",
};

/** 英國林地：大不列顛 NFI 四組；北愛優先棲地林地獨立一項（非 NFI）。 */
export function GbWoodlandLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbWoodland", i18n)} en="Woodland" />
    <LegendNote>{i18n.t("legend.environment.gbWoodHeading")}</LegendNote>
    {GB_WOODLAND_GROUPS.map((g) => <LegendRow key={g.value} swatch={<SwatchSquare color={g.color} stroke={g.color} />}>{i18n.t(GB_WOODLAND_GROUP_KEYS[g.value])}</LegendRow>)}
    <LegendRow swatch={<SwatchSquare color={GB_WOODLAND_NI_COLOR} stroke={GB_WOODLAND_NI_COLOR} />}>{i18n.t("legend.environment.gbWoodNi")}</LegendRow>
    <LegendNote>{i18n.t("legend.environment.gbWoodNiNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbWoodZoom")}</LegendNote>
    <Attributions items={[GB_WOODLAND_FC_ATTRIBUTION, GB_WOODLAND_NI_ATTRIBUTION]} />
  </div>;
}

export const GB_RECREATION_KEYS: Record<GbRecreationCategory, MessageKey> = {
  furniture: "legend.environment.gbRecFurniture", built: "legend.environment.gbRecBuilt", play: "legend.environment.gbRecPlay",
  art: "legend.environment.gbRecArt", misc: "legend.environment.gbRecMisc", signage: "legend.environment.gbRecSignage",
};

/** 英國森林遊憩設施：6 類＋威爾斯未分類；蘇格蘭、北愛未涵蓋。 */
export function GbForestRecreationLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbForestRecreation", i18n)} en="Forest Recreation" />
    {GB_RECREATION_CATEGORIES.map((c) => <LegendRow key={c.value} swatch={<SwatchDot color={c.color} />}>{i18n.t(GB_RECREATION_KEYS[c.value])}</LegendRow>)}
    <LegendRow swatch={<SwatchDot color={GB_RECREATION_UNCLASSIFIED_COLOR} />}>{i18n.t("legend.environment.gbRecUnclassified")}</LegendRow>
    <LegendNote>{i18n.t("legend.environment.gbRecNotCovered")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbRecZoom")}</LegendNote>
    <Attributions items={Object.values(GB_RECREATION_SOURCES).map((s) => s.attribution)} />
  </div>;
}

export const GB_TRAIL_CATEGORY_KEYS: Record<GbTrailCategory, MessageKey> = {
  walking: "legend.environment.gbTrailWalking", cycling: "legend.environment.gbTrailCycling", equestrian: "legend.environment.gbTrailEquestrian",
  multi: "legend.environment.gbTrailMulti", other: "legend.environment.gbTrailOther",
};

/** 英國步道：國家步道（粗線）＋公有林步道依類別；北愛未涵蓋、蘇格蘭只有國有林步道。 */
export function GbTrailsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbTrails", i18n)} en="Trails" />
    <LegendRow swatch={<SwatchLine color={GB_NATIONAL_TRAIL_COLOR} width={LINE_WIDTH.emphasis[1]} />}>{i18n.t("legend.environment.gbTrailNational")}</LegendRow>
    <LegendNote>{i18n.t("legend.environment.gbTrailForestHeading")}</LegendNote>
    {GB_TRAIL_CATEGORIES.map((c) => <LegendRow key={c.value} swatch={<SwatchLine color={c.color} width={LINE_WIDTH.standard[1]} />}>{i18n.t(GB_TRAIL_CATEGORY_KEYS[c.value])}</LegendRow>)}
    <LegendRow swatch={<SwatchLine color={GB_TRAIL_UNCLASSIFIED_COLOR} width={LINE_WIDTH.standard[1]} />}>{i18n.t("legend.environment.gbTrailUnclassified")}</LegendRow>
    <LegendNote>{i18n.t("legend.environment.gbTrailNi")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbTrailScotland")}</LegendNote>
    <Attributions items={Object.values(GB_TRAIL_SOURCES).map((s) => s.attribution)} />
  </div>;
}

export const GB_ACCESS_TYPE_KEYS: Record<GbAccessType, MessageKey> = {
  open_country: "legend.environment.gbOaOpenCountry", common_land: "legend.environment.gbOaCommonLand", dedicated: "legend.environment.gbOaDedicated",
};

/** 英國開放進入地（CRoW）：三類；蘇格蘭、北愛制度不適用（不是未涵蓋）。 */
export function GbOpenAccessLandLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbOpenAccessLand", i18n)} en="Open Access Land" />
    {GB_ACCESS_TYPES.map((a) => <LegendRow key={a.value} swatch={<SwatchSquare color={a.color} stroke={a.color} />}>{i18n.t(GB_ACCESS_TYPE_KEYS[a.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.environment.gbOaNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbOaScotland")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbOaNi")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbOaZoom")}</LegendNote>
    <Attributions items={Object.values(GB_OPEN_ACCESS_SOURCES).map((s) => s.attribution)} />
  </div>;
}

export const GB_TREE_CATEGORY_KEYS: Record<GbTreeCategory, MessageKey> = {
  tpo_zone: "legend.environment.gbTreeZone", tpo_tree: "legend.environment.gbTreeTree", ancient_woodland: "legend.environment.gbTreeAncient",
};

/** 英國樹木保護：TPO 範圍／單株＋古老林地；TPO 只涵蓋英格蘭試辦機關（空白≠無 TPO）。 */
export function GbTreeProtectionLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbTreeProtection", i18n)} en="Tree Protection" />
    {GB_TREE_CATEGORIES.map((c) => (
      <LegendRow key={c.value} swatch={c.value === "tpo_tree" ? <SwatchDot color={c.color} /> : <SwatchSquare color={c.color} stroke={c.color} />}>
        {i18n.t(GB_TREE_CATEGORY_KEYS[c.value])}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.environment.gbTreeTpoCoverage", { zones: GB_TPO_ZONE_ORGS, trees: GB_TPO_TREE_ORGS })}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbTreeAncientCoverage")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbTreeZoom")}</LegendNote>
    <Attributions items={Object.values(GB_TREE_SOURCES).map((s) => s.attribution)} />
  </div>;
}
