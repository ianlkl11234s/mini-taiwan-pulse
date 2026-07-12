import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { Row, SourceFooter } from "./shared";
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

function areaHa(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ha` : "";
}

export function AquaculturePondsPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color="#26c6da">{String(props.name ?? "魚塭")}</Title>
      <Row label="養殖物" value={String(props.produce ?? "")} />
      <Row label="面積" value={areaHa(props.area_ha)} />
      <SourceFooter props={props} />
    </>
  );
}

export function AquacultureZonePanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color="#66bb6a">{String(props.zone_name ?? "養殖漁業生產區")}</Title>
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="鄉鎮" value={String(props.township ?? "")} />
      <Row label="面積" value={areaHa(props.area_ha)} />
      <SourceFooter props={props} />
    </>
  );
}

export function AquacultureCageNetPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color="#5c6bc0">{String(props.public_no ?? "海上箱網")}</Title>
      <Row label="鄉鎮" value={String(props.township ?? "")} />
      <Row label="位置" value={String(props.location ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

/** nlsc_name + nlsc_code → 「水產養殖（0102）」；缺 name 退回純 code，皆空回空字串（Row 自動隱藏） */
function nlscLandUse(props: Record<string, unknown>): string {
  const name = typeof props.nlsc_name === "string" ? props.nlsc_name : "";
  const code = typeof props.nlsc_code === "string" ? props.nlsc_code : "";
  if (name && code) return `${name}（${code}）`;
  return name || code;
}

export function AquacultureWaterSatellitePanel({ props }: { props: Record<string, unknown> }) {
  const inOsm = props.in_osm === true;
  const solarSymbiotic = props.solar_symbiotic === true;
  const nlscCode = typeof props.nlsc_code === "string" ? props.nlsc_code : "";
  const tier =
    inOsm || nlscCode === "0102" || solarSymbiotic
      ? { color: "#26c6da", label: "確定 · 養殖/OSM" }
      : nlscCode === "0402" || nlscCode === "0104"
        ? { color: "#90a4ae", label: "蓄水池/農業設施" }
        : { color: "#cfd8dc", label: "不確定 · 水田/其他" };
  return (
    <>
      <Title color={tier.color}>衛星偵測養殖水體</Title>
      <Row label="面積" value={areaHa(props.area_ha)} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="信心" value={tier.label} color={tier.color} />
      <Row label="土地使用（NLSC 113年）" value={nlscLandUse(props)} />
      {solarSymbiotic && (
        <Row label="漁電共生" value="光電案場內，官方認定水產養殖或有魚塭證據而保留" color="#fbbf24" />
      )}
      <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5, marginTop: 6 }}>
        ⓘ 10m 解析度水體團塊，非逐口輪廓；漏標候選含少量假陽性（太陽能板/滯洪池等）
      </div>
      <SourceFooter props={props} />
    </>
  );
}

/** source 三值 → 中文標籤 + 代表色（ponds 青 / satellite 綠 / production 橙） */
const INTEGRATED_SOURCE: Record<string, { label: string; color: string }> = {
  ponds: { label: "逐口魚塭（OSM）", color: "#26c6da" },
  satellite: { label: "衛星偵測補充", color: "#66bb6a" },
  production: { label: "生產區", color: "#ffa726" },
};

export function AquacultureIntegratedPanel({ props }: { props: Record<string, unknown> }) {
  const src = typeof props.source === "string" ? props.source : "";
  const tier = INTEGRATED_SOURCE[src] ?? { label: src || "未知", color: "#9e9e9e" };
  return (
    <>
      <Title color={tier.color}>養殖漁業整合</Title>
      <Row label="來源" value={tier.label} color={tier.color} />
      <Row label="面積" value={areaHa(props.area_ha)} />
      <SourceFooter props={props} />
    </>
  );
}
