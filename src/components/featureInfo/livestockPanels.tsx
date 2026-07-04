import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { FARM_COLOR, slaughterKind, SLAUGHTER_COLOR, FEED_COLOR, MARKET_COLOR } from "../../data/livestockTypes";
import { Row } from "./shared";

function Title({ color, children }: { color: string; children: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>{children}</div>
    </div>
  );
}

export function LivestockFarmPanel({ props }: { props: Record<string, unknown> }) {
  const species = String(props["主畜種"] ?? "");
  const accent = FARM_COLOR[species] ?? "#9e9e9e";
  const lowPrecision = String(props["精度"] ?? "") === "低";
  const total = Number(props["總隻數"] ?? 0);
  return (
    <>
      <Title color={accent}>{String(props["場名"] ?? "畜禽飼養場")}</Title>
      <Row label="主畜種" value={species} color={accent} />
      <Row label="總隻數" value={total.toLocaleString()} />
      <Row label="種類明細" value={String(props["種類明細"] ?? "")} />
      <Row label="縣市" value={String(props["縣市"] ?? "")} />
      {lowPrecision && <Row label="定位精度" value="低（僅段/村里中心，非精確場址）" color="#ffb300" />}
    </>
  );
}

export function LivestockSlaughterPanel({ props }: { props: Record<string, unknown> }) {
  const kind = slaughterKind(props["種類"]);
  const accent = kind === "家禽" ? SLAUGHTER_COLOR.poultry : SLAUGHTER_COLOR.livestock;
  return (
    <>
      <Title color={accent}>{String(props["場名"] ?? "屠宰場")}</Title>
      <Row label="類別" value={kind} color={accent} />
      <Row label="種類" value={String(props["種類"] ?? "")} />
      <Row label="地址" value={String(props["地址"] ?? "")} />
    </>
  );
}

export function LivestockFeedPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color={FEED_COLOR}>{String(props["廠名"] ?? "飼料廠")}</Title>
      <Row label="統編 BAN" value={String(props["BAN"] ?? "")} />
      <Row label="地址" value={String(props["地址"] ?? "")} />
    </>
  );
}

export function LivestockMarketPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color={MARKET_COLOR}>{String(props["場名"] ?? "拍賣/批發市場")}</Title>
      <Row label="種類" value={String(props["種類"] ?? "")} />
      <Row label="地址" value={String(props["地址"] ?? "")} />
    </>
  );
}
