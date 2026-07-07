// 環境污染 popup panels（設施 / 裁處事件 / 場址）。
// 語意紅線：EMS_S_01 列管 ≠ 污染源 → 標題與敘述皆用「污染潛勢設施」。
import type { PanelProps } from "./registry";
import { Row, Badge } from "./shared";
import {
  FACILITY_MEDIA, POLLUTION_MEDIUM_LABELS, POLLUTION_MEDIUM_COLORS,
  SEVERITY_BANDS, PENALTY_SEVERITY_LABELS, PENALTY_SEVERITY_COLORS,
  type PollutionMedium, type PollutionPenaltySeverity,
} from "../../data/pollutionTypes";

function sevLabel(sev: number): string {
  const b = SEVERITY_BANDS.find((x) => x.sev === sev);
  return b ? b.label : `S${sev}`;
}

const PRECISION_LABELS: Record<string, string> = {
  facility_join: "設施座標（ems_no join）",
  address_exact: "地址精確定位",
  address_osm: "地址（OSM）",
  parcel: "地號補點",
  approx: "約略位置（內插）",
  unknown: "未知",
};

export function PollutionFacilityPanel({ props }: PanelProps) {
  const maxSev = Number(props.max_sev ?? 0);
  return (
    <div>
      <Row label="名稱" value={String(props.name ?? "")} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="行業" value={String(props.industry_macro ?? "")} />
      <Row label="最高嚴重度" value={sevLabel(maxSev)} color={SEVERITY_BANDS.find((b) => b.sev === maxSev)?.color} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
        {FACILITY_MEDIA.map((m: PollutionMedium) => {
          const raw = props[`sev_${m}`];
          if (raw == null) return null;
          const sev = Number(raw);
          return (
            <Badge key={m} label={`${POLLUTION_MEDIUM_LABELS[m]} S${sev}`} on={sev > 0} color={POLLUTION_MEDIUM_COLORS[m]} />
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
        「環保列管對象」× 裁處紀錄推得之污染潛勢；列管 ≠ 污染。
      </div>
    </div>
  );
}

export function PollutionPenaltyPanel({ props }: PanelProps) {
  const medium = String(props.event_medium ?? "other") as PollutionMedium;
  const severity = String(props.severity_event ?? "normal") as PollutionPenaltySeverity;
  const money = Number(props.penalty_money ?? 0);
  const illegalMoney = Number(props.illegal_money ?? 0);
  const reason = String(props.severity_reason ?? "")
    .split(",")
    .filter(Boolean)
    .map((r) => ({
      money_100k: "罰鍰 >= 10 萬",
      important: "重大案件",
      continuous: "連續處罰",
      stop_order: "停工 / 停業 / 勒令 / 廢止",
      illegal_money: "不法利得",
      money_30k_100k: "罰鍰 3-10 萬",
      mobile: "移動污染",
    }[r] ?? r))
    .join("、");
  return (
    <div>
      <Row label="受罰對象" value={String(props.fac_name ?? "")} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="介質" value={POLLUTION_MEDIUM_LABELS[medium] ?? medium} color={POLLUTION_MEDIUM_COLORS[medium]} />
      <Row label="分層" value={PENALTY_SEVERITY_LABELS[severity] ?? severity} color={PENALTY_SEVERITY_COLORS[severity]} />
      {reason && <Row label="分層原因" value={reason} />}
      <Row label="裁處類型" value={String(props.transgress_type ?? "")} />
      <Row label="違反法規" value={String(props.transgress_law ?? "")} />
      <Row label="違反事實" value={String(props.violation_fact ?? "")} />
      <Row label="裁處日期" value={String(props.penalty_date ?? "")} />
      <Row label="罰鍰" value={money > 0 ? `NT$ ${money.toLocaleString()}` : "—"} />
      {illegalMoney > 0 && <Row label="不法利得" value={`NT$ ${illegalMoney.toLocaleString()}`} />}
      {Number(props.is_continuous ?? 0) === 1 && (
        <div style={{ marginTop: 6 }}>
          <Badge label="連續處罰" on color="#dc2626" />
        </div>
      )}
      {Number(props.is_stop_order ?? 0) === 1 && (
        <div style={{ marginTop: 6 }}>
          <Badge label="停工/勒令等" on color="#ef4444" />
        </div>
      )}
      <Row label="改善狀態" value={String(props.is_improve ?? "")} />
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
        定位方式：{PRECISION_LABELS[String(props.geocode_precision ?? "unknown")] ?? String(props.geocode_precision ?? "")}
      </div>
    </div>
  );
}

export function PollutionSitePanel({ props }: PanelProps) {
  const active = Number(props.is_active ?? 0) === 1;
  return (
    <div>
      <Row label="場址名稱" value={String(props.site_name ?? "")} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="行政區" value={String(props.township ?? "")} />
      <Row label="類型" value={String(props.site_type ?? "")} />
      <Row label="控制類別" value={String(props.controltype ?? "")} />
      <Row label="公告日期" value={String(props.anno_date ?? "")} />
      <Row label="污染物" value={String(props.pollutant_short ?? "")} />
      <div style={{ marginTop: 6 }}>
        <Badge label={active ? "仍列管中" : "已解除列管"} on={active} color="#dc2626" />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
        EMS_S_07 確認污染場址（嚴重度 S4）。
      </div>
    </div>
  );
}
