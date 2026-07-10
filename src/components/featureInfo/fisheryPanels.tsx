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
