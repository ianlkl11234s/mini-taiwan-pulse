import { Row, Title } from "./shared";
import { FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import type { I18nContext } from "../../i18n/layerText";
import {
  deityFamilyColor, deityFamilyLabel, ancestralHallTypeLabel,
  ANCESTRAL_HALL_TYPES, ANCESTRAL_HALL_MISSING_COLOR, RELIGION_LAYER_COLORS,
} from "../../data/religionTypes";
import {
  JP_RELIGION_COLORS, jpReligionLabel, religionNameFallback,
} from "../../data/jpReligionTypes";

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));

/** in_moi_registry → 中文（三層共用；ancestral_halls 的 false 語意是文資祠堂另外處理） */
function registryLabel(v: unknown, i18n: I18nContext): string {
  if (v === true) return enumLabel("religionRegistry", "official", "官方登記", i18n);
  if (v === false) return enumLabel("religionRegistry", "outside", "登記制度外（OSM 群眾標註）", i18n);
  return "";
}

/** OSM 來源才顯示的 ODbL 標示（source / source_tier 判斷） */
function OdblNote({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  if (String(props.source ?? "") !== "osm_overpass") return null;
  return (
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
      {tr("popup.religion.osmNote")}
    </div>
  );
}

/** geocode_precision 誠實標記 → 中文（original 原生座標最可信） */
const GEOCODE_LABEL: Record<string, string> = {
  original: "原始座標",
  offline: "離線地址比對",
  osm_match: "OSM 名稱比對",
  google: "Google Geocoding",
};

/**
 * 寺廟（19,201）：主祀神祇族分色標題 + 原始 main_deity + 教別 / 登記別 / 登記狀態。
 * ⚠️ name 可為 null（443 筆，多為 OSM 無名宮壇）→ 顯示「無名宮廟」不憑空造名。
 */
export function TemplePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const family = str(props.deity_family) || "unknown";
  const familyLabel = enumLabel("religionDeityFamily", family, deityFamilyLabel(family), i18n);
  const color = deityFamilyColor(family);
  const deity = str(props.main_deity);
  const precisionCode = str(props.geocode_precision);
  const precision = precisionCode ? enumLabel("religionGeocode", precisionCode, GEOCODE_LABEL[precisionCode] ?? precisionCode, i18n) : "";
  return (
    <>
      <Title color={color}>{str(props.name) || tr("popup.religion.unnamedTemple")}</Title>
      <Row label={tr("popup.religion.mainDeity")} value={deity || familyLabel} color={color} />
      {deity ? <Row label={tr("popup.religion.deityFamily")} value={familyLabel} /> : null}
      <Row label={tr("popup.religion.religionType")} value={str(props.religion_type)} />
      <Row label={tr("popup.religion.registrationType")} value={str(props.registration_type)} />
      <Row label={tr("popup.religion.registryStatus")} value={registryLabel(props.in_moi_registry, i18n)} />
      {props.heritage_flag === true ? <Row label={tr("popup.religion.heritage")} value={tr("popup.religion.yes")} color="#d4a017" /> : null}
      {props.is_top100 === true ? <Row label={tr("popup.religion.top100")} value={tr("popup.religion.yes")} color={RELIGION_LAYER_COLORS.religionTop100} /> : null}
      <Row field="county" value={str(props.county)} />
      <Row field="address" value={str(props.address)} />
      {precision && precisionCode !== "original" ? (
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
          {tr("popup.religion.coordSource", { value: precision })}
        </div>
      ) : null}
      <OdblNote props={props} />
    </>
  );
}

/** 教會（2,116；OSM 補 1,066 聚會點）：name 可為 null 46 筆 */
export function ChurchPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const color = RELIGION_LAYER_COLORS.religionChurches;
  return (
    <>
      <Title color={color}>{str(props.name) || tr("popup.religion.unnamedChurch")}</Title>
      {str(props.name_en) ? <Row field="englishName" value={str(props.name_en)} /> : null}
      <Row label={tr("popup.religion.registryStatus")} value={registryLabel(props.in_moi_registry, i18n)} />
      {props.heritage_flag === true ? <Row label={tr("popup.religion.heritage")} value={tr("popup.religion.yes")} color="#d4a017" /> : null}
      <Row field="county" value={str(props.county)} />
      <Row field="address" value={str(props.address)} />
      <OdblNote props={props} />
    </>
  );
}

/** 宗祠（173）：facility_type 3 類（登記宗祠 69 / 宗祠基金會 8 / 文資祠堂 96） */
export function AncestralHallPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const type = str(props.facility_type);
  const color = ANCESTRAL_HALL_TYPES.find((x) => x.value === type)?.color ?? ANCESTRAL_HALL_MISSING_COLOR;
  return (
    <>
      <Title color={color}>{str(props.name) || tr("popup.religion.ancestralHall")}</Title>
      <Row field="type" value={enumLabel("religionAncestralType", type, ancestralHallTypeLabel(type), i18n)} color={color} />
      {str(props.heritage_grade) ? <Row label={tr("popup.religion.heritageGrade")} value={str(props.heritage_grade)} /> : null}
      <Row field="county" value={str(props.county)} />
      <Row field="address" value={str(props.address)} />
    </>
  );
}

/** 宗教基金會（165；單一源，無 trust chain 欄） */
export function FoundationPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  return (
    <>
      <Title color={RELIGION_LAYER_COLORS.religionFoundations}>{str(props.name) || tr("popup.religion.foundation")}</Title>
      <Row field="county" value={str(props.county)} />
      <Row field="address" value={str(props.address)} />
    </>
  );
}

/**
 * 其他宗教場所（1,319；全 OSM）：清真寺 / 印度教 / 神社遺構 / 風獅爺 / 原民祭場…
 * ⚠️ name 為 null 859 筆（65%）—— 這是 OSM 標了場所但沒標名，誠實顯示「未命名場所」。
 */
export function OtherWorshipPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  return (
    <>
      <Title color={RELIGION_LAYER_COLORS.religionOtherWorship}>{str(props.name) || tr("popup.religion.unnamedWorship")}</Title>
      {str(props.name_en) ? <Row field="englishName" value={str(props.name_en)} /> : null}
      <Row label={tr("popup.religion.religion")} value={str(props.religion_type)} />
      <Row label={tr("popup.religion.denomination")} value={str(props.denomination)} />
      <Row field="county" value={str(props.county)} />
      <Row field="township" value={str(props.town)} />
      <Row field="address" value={str(props.address)} />
      <OdblNote props={props} />
    </>
  );
}

/**
 * 宗教百景（100）：2026-08-02 自觀光群搬來（原 tourReligion / ReligionPanel）。
 * 上游同步自 tourism.religion 搬移歸位為 religion.top100，欄位不變。
 */
export function ReligionTop100Panel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  return (
    <>
      <Title color={RELIGION_LAYER_COLORS.religionTop100}>{str(props.name) || tr("popup.religion.religiousSite")}</Title>
      {str(props.name_en) ? <Row field="englishName" value={str(props.name_en)} /> : null}
      <Row field="county" value={str(props.county)} />
      <Row field="township" value={str(props.town)} />
      <Row field="address" value={str(props.address)} />
    </>
  );
}

type JpReligionSource = "gsi" | "osm" | "wikidata";

const JP_RELIGION_SOURCE_LABEL: Record<JpReligionSource, string> = {
  gsi: "国土地理院最適化ベクトルタイル",
  osm: "OpenStreetMap contributors（ODbL）",
  wikidata: "Wikidata（CC0）",
};

function JpReligionPanel({
  props,
  source,
}: {
  props: Record<string, unknown>;
  source: JpReligionSource;
}) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const religion = str(props.religion);
  const jpCode = religion === "shinto" || religion === "buddhist" || religion === "christian" ? religion : "other";
  const mapSymbol = source === "gsi";
  const name = str(props.name) || enumLabel("religionJpName", `${jpCode}${mapSymbol ? "Symbol" : ""}`, religionNameFallback(religion, mapSymbol), i18n);
  const id = str(props.id);
  const color = JP_RELIGION_COLORS[religion as keyof typeof JP_RELIGION_COLORS]
    ?? JP_RELIGION_COLORS.other;
  return (
    <>
      <Title color={color}>{name}</Title>
      <Row field="category" value={enumLabel("religionJp", jpCode, jpReligionLabel(religion), i18n)} color={color} />
      {source === "gsi" && !str(props.name) ? (
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
          {tr("popup.religion.mapSymbolNote")}
        </div>
      ) : null}
      {id ? <Row label={source === "wikidata" ? "Wikidata" : "ID"} value={id} /> : null}
      {source === "wikidata" && /^Q\d+$/.test(id) ? (
        <a
          href={`https://www.wikidata.org/wiki/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: t.link, fontSize: FONT_SIZE.base, display: "inline-block", marginTop: 5 }}
        >
          {tr("popup.religion.openWikidata")}
        </a>
      ) : null}
      <Row field="dataSource" value={JP_RELIGION_SOURCE_LABEL[source]} />
    </>
  );
}

export function JpReligionGsiPanel({ props }: { props: Record<string, unknown> }) {
  return <JpReligionPanel props={props} source="gsi" />;
}

export function JpReligionOsmPanel({ props }: { props: Record<string, unknown> }) {
  return <JpReligionPanel props={props} source="osm" />;
}

export function JpReligionWikidataPanel({ props }: { props: Record<string, unknown> }) {
  return <JpReligionPanel props={props} source="wikidata" />;
}
