/**
 * §A 變軌警報區（P4：區段標題＋四格嚴重度＋清單列）
 *
 * 排序：red → orange → grey，副 key 時間 DESC
 * 重大／注意直接列出；例行與無法判定摺疊。每列：嚴重度色點＋衛星名（點名稱＝開百科）＋
 * 類型中文＋相對時間＋「看覆蓋變化」圖示鈕；下行顯示變化量與台灣過境影響。
 * 讀取中／失敗／更新中斷（P-D）維持在本區。
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, GitCompareArrows } from "lucide-react";
import { COLORS, FONT_CJK, FONT_DATA, MANEUVER_TOKEN } from "./satelliteConsoleTokens";
import { RADIUS, FONT_SIZE, CONTROL } from "../../styles/designTokens";
import { chipOutline } from "../intel/intelTokens";
import { SubGroupLabel } from "../sidebar/ThemeBanner";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";
import { describeManeuversBanner, type ManeuversState } from "../../data/satelliteDataState";
import {
  formatManeuverDetail,
  formatRelTime,
  getManeuverSeverity,
  type ManeuverSeverity,
} from "../../data/satelliteManeuversLoader";
import { useManeuverImpacts, type ManeuverImpactState } from "../../hooks/useManeuverImpacts";
import { ctrlButton, resolveManeuverListScope, SEVERITY_VIEW } from "./maneuverAlertKit";

interface Props {
  maneuvers: ManeuversState;
  onSelectNorad: (n: number) => void;
  onOpenCompare: (m: ManeuverRow) => void;
  onFlyTo?: (lon: number, lat: number) => void;
  /** 時間軸是否在歷史模式（清單範圍提示用） */
  isHistory?: boolean;
}

const TAIWAN_GROUP = new Set(["TAIWAN"]);
const CN_GROUPS = new Set(["YAOGAN", "JILIN", "GAOFEN", "TJS", "BEIDOU", "SHIYAN"]);
const INTL_GROUPS = new Set(["USA", "JAPAN", "RUSSIA", "INDIA", "KOREA", "FRANCE", "GERMANY", "ITALY", "ISRAEL"]);

const SECTION_PAD = "0 14px";
const SECTION_STYLE = { borderBottom: `1px solid ${COLORS.borderSoft}`, paddingBottom: 12 } as const;

export function ManeuverAlertSection({ maneuvers: state, onSelectNorad, onOpenCompare, isHistory = false }: Props) {
  const [expandedGrey, setExpandedGrey] = useState(false);
  const maneuvers = state.rows;
  const scope = resolveManeuverListScope(isHistory);

  const { cnCount, twCount, intlCount, sortedRed, sortedOrange, sortedGrey, sortedUnknown } = useMemo(() => {
    let cn = 0, tw = 0, intl = 0;
    const red: ManeuverRow[] = [];
    const orange: ManeuverRow[] = [];
    const grey: ManeuverRow[] = [];
    const unknown: ManeuverRow[] = [];
    for (const m of maneuvers) {
      if (TAIWAN_GROUP.has(m.cn_group) || m.country_operator === "Taiwan") tw++;
      else if (INTL_GROUPS.has(m.cn_group)) intl++;
      else if (m.country_operator === "China" || CN_GROUPS.has(m.cn_group)) cn++;
      const sev = getManeuverSeverity(m);
      if (sev === "red") red.push(m);
      else if (sev === "orange") orange.push(m);
      else if (sev === "grey") grey.push(m);
      else unknown.push(m);
    }
    const byTime = (a: ManeuverRow, b: ManeuverRow) =>
      new Date(b.curr_fetched_at).getTime() - new Date(a.curr_fetched_at).getTime();
    red.sort(byTime);
    orange.sort(byTime);
    grey.sort(byTime);
    unknown.sort(byTime);
    return { cnCount: cn, twCount: tw, intlCount: intl, sortedRed: red, sortedOrange: orange, sortedGrey: grey, sortedUnknown: unknown };
  }, [maneuvers]);

  // affects TW 計算（非阻塞）
  const impacts = useManeuverImpacts(maneuvers);

  const banner = describeManeuversBanner(state);
  if (banner.kind !== "ok") {
    const isEmpty = banner.kind === "empty";
    const isError = banner.kind === "error";
    const tone = isEmpty ? COLORS.statusLive : isError ? COLORS.statusErr : COLORS.textDim;
    return (
      <div style={SECTION_STYLE}>
        <SubGroupLabel>變軌警報</SubGroupLabel>
        <ScopeNotice text={scope.notice} />
        <div style={{ padding: "4px 14px 0" }}>
          <div role="status" style={{
            padding: "6px 10px",
            borderRadius: RADIUS.lg,
            background: CONTROL.bg,
            border: `1px solid ${COLORS.borderSoft}`,
            fontFamily: FONT_CJK,
            fontSize: FONT_SIZE.base,
            color: COLORS.textDefault,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: RADIUS.full, background: tone, flexShrink: 0 }} />
            {banner.text}
          </div>
        </div>
      </div>
    );
  }

  const featured = [...sortedRed, ...sortedOrange];
  const folded = [...sortedGrey, ...sortedUnknown];
  const total = maneuvers.length;

  const renderRow = (m: ManeuverRow) => (
    <ManeuverRowItem
      key={`${m.norad_id}-${m.curr_epoch}`}
      row={m}
      severity={getManeuverSeverity(m)}
      impact={impacts.get(m.norad_id)}
      onSelectNorad={onSelectNorad}
      onOpenCompare={onOpenCompare}
    />
  );

  return (
    <div style={SECTION_STYLE}>
      <SubGroupLabel>變軌警報</SubGroupLabel>
      <ScopeNotice text={scope.notice} />
      {state.stale && (
        <div role="status" style={{ padding: "0 14px 4px", fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.statusWarn }}>
          更新中斷，目前顯示的是上次讀取的資料
        </div>
      )}
      <div style={{ padding: "0 14px", fontSize: FONT_SIZE.sm, color: COLORS.textDim }}>
        近 24 小時 · 共 <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{total}</span> 筆
      </div>

      <div style={{ padding: "6px 14px 0" }}>
        {/* 四格嚴重度 */}
        <div style={{ display: "flex", gap: 6 }}>
          <SevCell severity="red" count={sortedRed.length} />
          <SevCell severity="orange" count={sortedOrange.length} />
          <SevCell severity="grey" count={sortedGrey.length} />
          <SevCell severity="unknown" count={sortedUnknown.length} />
        </div>
        {/* 國別計數 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 6, fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
          <CountryCount zh="中國" n={cnCount} hot />
          <span style={{ color: COLORS.textFaint }}>·</span>
          <CountryCount zh="國際" n={intlCount} />
          <span style={{ color: COLORS.textFaint }}>·</span>
          <CountryCount zh="台灣" n={twCount} />
        </div>
      </div>

      <div style={{ padding: SECTION_PAD }}>
        {featured.length > 0 && (
          <div style={{ marginTop: 8, borderBottom: `1px solid ${COLORS.borderSoft}` }}>
            {featured.map(renderRow)}
          </div>
        )}

        {folded.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              aria-expanded={expandedGrey}
              onClick={() => setExpandedGrey((v) => !v)}
              style={ctrlButton({ width: "100%", justifyContent: "flex-start", fontFamily: FONT_CJK, color: COLORS.textMuted })}
            >
              {expandedGrey ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
              <span>
                例行調整 <span style={{ fontFamily: FONT_DATA }}>{sortedGrey.length}</span> 筆
                {sortedUnknown.length > 0 && <>、無法判定 <span style={{ fontFamily: FONT_DATA }}>{sortedUnknown.length}</span> 筆</>}
              </span>
            </button>
            {expandedGrey && (
              <div style={{ marginTop: 4, borderBottom: `1px solid ${COLORS.borderSoft}` }}>
                {folded.map(renderRow)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScopeNotice({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div role="note" style={{ padding: "0 14px 4px", fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, lineHeight: 1.5, color: COLORS.textDim }}>
      {text}
    </div>
  );
}

function SevCell({ severity, count }: { severity: ManeuverSeverity; count: number }) {
  const v = SEVERITY_VIEW[severity];
  const hot = count > 0 && (severity === "red" || severity === "orange");
  return (
    <div style={{
      flex: 1, minWidth: 0, padding: "6px 8px",
      borderRadius: RADIUS.lg, background: CONTROL.bg, border: `1px solid ${COLORS.borderSoft}`,
    }}>
      <div style={{
        fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", fontSize: FONT_SIZE.xl, fontWeight: 700, lineHeight: 1.1,
        color: count === 0 ? COLORS.textDim : hot ? v.color : COLORS.textDefault,
      }}>
        {count}
      </div>
      <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted, whiteSpace: "nowrap" }}>{v.zh}</div>
    </div>
  );
}

function CountryCount({ zh, n, hot }: { zh: string; n: number; hot?: boolean }) {
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      {zh}{" "}
      <span style={{
        fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums",
        fontWeight: n > 0 ? 600 : 400,
        color: n > 0 ? (hot ? COLORS.textStrong : COLORS.textDefault) : COLORS.textDim,
      }}>{n}</span>
    </span>
  );
}

interface RowProps {
  row: ManeuverRow;
  severity: ManeuverSeverity;
  impact: ManeuverImpactState | undefined;
  onSelectNorad: (n: number) => void;
  onOpenCompare: (m: ManeuverRow) => void;
}

function ManeuverRowItem({ row, severity, impact, onSelectNorad, onOpenCompare }: RowProps) {
  const sev = SEVERITY_VIEW[severity];
  const typeToken = MANEUVER_TOKEN[row.maneuver_type];
  if (!typeToken) return null;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0", borderTop: `1px solid ${COLORS.borderSoft}` }}>
      <span style={{ width: 8, height: 8, borderRadius: RADIUS.full, background: sev.color, flexShrink: 0, marginTop: 4 }} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <button
            type="button"
            onClick={() => onSelectNorad(row.norad_id)}
            title={`查看 ${row.name} 的衛星百科`}
            style={{
              flex: 1, minWidth: 0, padding: 0, border: "none", background: "transparent", textAlign: "left", cursor: "pointer",
              fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, fontWeight: 600, color: COLORS.textStrong,
              textDecoration: "underline", textDecorationColor: COLORS.borderMid, textUnderlineOffset: 3,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {row.name}
          </button>
          <span style={{ flexShrink: 0, fontSize: FONT_SIZE.sm, color: COLORS.textDim }}>{formatRelTime(row.curr_fetched_at)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
          <span style={{ whiteSpace: "nowrap" }}>{sev.zh} · {typeToken.zh}</span>
          <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{formatManeuverDetail(row)}</span>
          <ImpactText impact={impact} />
        </div>
      </div>
      <button
        type="button"
        title="看覆蓋變化"
        aria-label="看覆蓋變化"
        onClick={() => onOpenCompare(row)}
        style={ctrlButton({ width: 26, height: 26, padding: 0, flexShrink: 0, color: COLORS.textMuted })}
      >
        <GitCompareArrows size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

const plain = { whiteSpace: "nowrap", fontSize: FONT_SIZE.sm, color: COLORS.textDim } as const;

/** 台灣過境影響：有變化用 warn 色 chipOutline，其餘淡字 */
function ImpactText({ impact: state }: { impact: ManeuverImpactState | undefined }) {
  if (state?.kind === "unavailable") return <span style={plain}>台灣過境 · 無法計算</span>;
  if (!state) return <span style={plain}>台灣過境計算中…</span>;
  const { impact } = state;
  if (impact.affectsTw) {
    return (
      <span style={{
        ...chipOutline(COLORS.statusWarn),
        display: "inline-flex", alignItems: "center", padding: "1px 5px", borderRadius: 3,
        fontSize: FONT_SIZE.sm, lineHeight: 1.2, whiteSpace: "nowrap",
      }}>
        台灣過境 <Num>{impact.passBefore}</Num>→<Num>{impact.passAfter}</Num> 次
      </span>
    );
  }
  return <span style={plain}>台灣過境不變（<Num>{impact.passBefore}</Num> 次）</span>;
}

function Num({ children }: { children: number }) {
  return <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{children}</span>;
}
