import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { Row, SourceFooter } from "./shared";
import { useFeatureTheme } from "./featureTheme";

// 本檔 Title 為極簡本地版（同 fisheryPanels 慣例）：shared.tsx 未 export Title，故不去改動它。
function Title({ color, children }: { color: string; children: string }) {
  const t = useFeatureTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>{children}</div>
    </div>
  );
}

/** 數值 + 單位；非有限值回空字串（Row 對空值自動隱藏） */
function numUnit(v: unknown, unit: string): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}` : "";
}

/** status 三值 → 中文標籤 + 代表色（存續 綠 / 消失 紅 / 新增 淺綠） */
const STATUS_TIER: Record<string, { label: string; color: string }> = {
  persisted: { label: "存續（2024→現在）", color: "#2e7d32" },
  disappeared: { label: "消失（2024 有、現在無）", color: "#e53935" },
  appeared: { label: "新增（2024 無、現在有）", color: "#9ccc65" },
};

export function StreetTreesTaipeiDiffPanel({ props }: { props: Record<string, unknown> }) {
  const status = typeof props.status === "string" ? props.status : "";
  const tier = STATUS_TIER[status] ?? { label: status || "未知", color: "#9e9e9e" };
  const renumberSuspect = props.renumber_suspect === true;
  // 路名（附行政區）：Region 為主，Dist 括號附註
  const region = String(props.Region ?? "");
  const dist = String(props.Dist ?? "");
  const roadValue = region && dist ? `${region}（${dist}）` : region || dist;
  return (
    <>
      <Title color={tier.color}>{String(props.TreeType ?? "行道樹")}</Title>
      <Row label="狀態" value={tier.label} color={tier.color} />
      <Row label="路名" value={roadValue} />
      <Row label="TreeID" value={String(props.TreeID ?? "")} />
      <Row label="胸徑" value={numUnit(props.Diameter, "cm")} />
      <Row label="樹高" value={numUnit(props.TreeHeight, "m")} />
      <Row label="調查日" value={String(props.SurveyDate ?? "")} />
      {renumberSuspect && (
        <Row label="提示" value="⚠️ 疑似重編號（同路名同樹種 10m 內配對，可能非真消失/新增）" color="#fbbf24" />
      )}
      <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5, marginTop: 6 }}>
        ⓘ TreeID 消失≠砍除；2024 基準取自 Wayback，含颱風後清運滯後
      </div>
      <SourceFooter props={props} />
    </>
  );
}
