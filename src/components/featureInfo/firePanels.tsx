import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { fireStationColor, fireHydrantColor, fireIsochroneColor, fireIsochroneLabel } from "../../data/fireTypes";
import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";

export function FireEventPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const deaths = Number(props.deaths ?? 0);
  const injuries = Number(props.injuries ?? 0);
  const casualty = deaths > 0 || injuries > 0;
  const accentColor = casualty ? "#ff1744" : "#ff7043";
  const ts = Number(props.occurred_ts ?? 0);
  let timeStr = "";
  if (ts > 0) {
    const d = new Date(ts * 1000);
    const p2 = (n: number) => String(n).padStart(2, "0");
    timeStr = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  }
  const loc = [props.county, props.township].filter(Boolean).map(String).join(" ");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {loc || "火災事件"}
        </div>
      </div>
      <Row label="起火原因" value={String(props.cause ?? "")} color={accentColor} />
      <Row label="死亡" value={String(deaths)} color={deaths > 0 ? "#ff1744" : undefined} />
      <Row label="受傷" value={String(injuries)} color={injuries > 0 ? "#ffb300" : undefined} />
      <Row label="發生時間" value={timeStr} />
    </>
  );
}

export function FireStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const cat = String(props.cat ?? "其他");
  const accentColor = fireStationColor(cat);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "消防分隊")}
        </div>
      </div>
      <Row label="類型" value={String(props.type ?? cat)} color={accentColor} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="行政區" value={String(props.district ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
    </>
  );
}

export function FireHydrantPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const cat = String(props.cat ?? "其他");
  const accentColor = fireHydrantColor(cat);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          消防栓
        </div>
      </div>
      <Row label="型式" value={String(props.type ?? cat)} color={accentColor} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="行政區" value={String(props.district ?? "")} />
      <Row label="編號" value={String(props.id ?? "")} />
    </>
  );
}

export function FireIsochronePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const minutes = Number(props.minutes ?? 0);
  const accentColor = fireIsochroneColor(minutes);
  const cumulative = props.cumulative_sqkm != null ? `${props.cumulative_sqkm} km²` : "";
  const ring = props.ring_sqkm != null ? `${props.ring_sqkm} km²` : "";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {fireIsochroneLabel(minutes)}
        </div>
      </div>
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="可達時間" value={`${minutes} 分鐘內`} color={accentColor} />
      <Row label="累積可達面積" value={cumulative} />
      <Row label="本級環帶面積" value={ring} />
      <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.7)", marginTop: 6, lineHeight: 1.4 }}>
        ⚠️ driving 路網保守估計，未計消防車優先路權
      </div>
    </>
  );
}
