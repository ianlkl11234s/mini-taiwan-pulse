import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { SPORTS_CATEGORY_COLOR, SPORTS_FALLBACK_COLOR } from "../../data/sportsTypes";
import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";

function Title({ color, children }: { color: string; children: string }) {
  const t = useFeatureTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>{children}</div>
    </div>
  );
}

// open_status 顏色：可用（綠）/ 付費（琥珀）/ 不對外（紅）/ 其他（灰）
function openStatusColor(s: string): string {
  if (s === "免費開放") return "#66bb6a";
  if (s === "付費開放") return "#ffb300";
  if (s === "不對外") return "#ef5350";
  return "#9e9e9e";
}

export function SportsVenuePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const category = String(props["category"] ?? "");
  const accent = SPORTS_CATEGORY_COLOR[category] ?? SPORTS_FALLBACK_COLOR;
  const openStatus = String(props["open_status"] ?? "");
  const area = Number(props["area_sqm"]);
  const website = String(props["website"] ?? "");
  const cityDistrict = `${String(props["city"] ?? "")}${String(props["district"] ?? "")}`;
  return (
    <>
      <Title color={accent}>{String(props["name"] ?? "運動場館")}</Title>
      <Row label="類型" value={category} color={accent} />
      <Row label="隸屬" value={String(props["layer"] ?? "")} />
      {openStatus && <Row label="開放" value={openStatus} color={openStatusColor(openStatus)} />}
      {Number.isFinite(area) && area > 0 && <Row label="面積" value={`${area.toLocaleString()} m²`} />}
      <Row label="開放時間" value={String(props["open_hours"] ?? "")} />
      <Row label="縣市區" value={cityDistrict} />
      <Row label="地址" value={String(props["address"] ?? "")} />
      <Row label="經營單位" value={String(props["owner_org"] ?? "")} />
      {website && website !== "null" && (
        <div style={{ marginTop: 4, fontSize: FONT_SIZE.base }}>
          <a href={website} target="_blank" rel="noreferrer" style={{ color: t.link, textDecoration: "none" }}>
            官方網站 ↗
          </a>
        </div>
      )}
    </>
  );
}
