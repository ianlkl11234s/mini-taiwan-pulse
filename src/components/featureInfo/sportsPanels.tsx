import { FONT_SIZE } from "../../styles/designTokens";
import { SPORTS_CATEGORY_COLOR, SPORTS_FALLBACK_COLOR } from "../../data/sportsTypes";
import { Row, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { placeName } from "../../i18n/placeText";

// open_status 顏色：可用（綠）/ 付費（琥珀）/ 不對外（紅）/ 其他（灰）
function openStatusColor(s: string): string {
  if (s === "免費開放") return "#66bb6a";
  if (s === "付費開放") return "#ffb300";
  if (s === "不對外") return "#ef5350";
  return "#9e9e9e";
}

export function SportsVenuePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr, formatNumber } = i18n;
  const category = String(props["category"] ?? "");
  const accent = SPORTS_CATEGORY_COLOR[category] ?? SPORTS_FALLBACK_COLOR;
  const openStatus = String(props["open_status"] ?? "");
  const area = Number(props["area_sqm"]);
  const website = String(props["website"] ?? "");
  const cityDistrict = placeName(`${String(props["city"] ?? "")}${String(props["district"] ?? "")}`, i18n);
  return (
    <>
      <Title color={accent}>{String(props["name"] ?? tr("popup.sports.venueFallback"))}</Title>
      <Row field="type" value={enumLabel("sportsCategory", category, category, i18n)} color={accent} />
      <Row label={tr("popup.sports.affiliation")} value={enumLabel("sportsLayer", String(props["layer"] ?? ""), String(props["layer"] ?? ""), i18n)} />
      {openStatus && <Row label={tr("popup.sports.openStatus")} value={enumLabel("sportsOpenStatus", openStatus, openStatus, i18n)} color={openStatusColor(openStatus)} />}
      {Number.isFinite(area) && area > 0 && <Row field="area" value={`${formatNumber(area)} m²`} />}
      <Row field="openingHours" value={String(props["open_hours"] ?? "")} />
      <Row field="countyDistrict" value={cityDistrict} />
      <Row field="address" value={String(props["address"] ?? "")} />
      <Row label={tr("popup.sports.owner")} value={String(props["owner_org"] ?? "")} />
      {website && website !== "null" && (
        <div style={{ marginTop: 4, fontSize: FONT_SIZE.base }}>
          <a href={website} target="_blank" rel="noreferrer" style={{ color: t.link, textDecoration: "none" }}>
            {tr("popup.sports.website")}
          </a>
        </div>
      )}
    </>
  );
}
