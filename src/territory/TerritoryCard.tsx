/**
 * 「領土卡」：點一格後停靠在右下（同 FeatureInfoPanel 位置與 B 版外殼，spec §5.2），
 * 標題＝縣市 鄉鎮 村里＋格子大小白話；三個標籤做成能力條；以下依 tag 分組列全部屬性。
 * 值是點擊當下的磚內屬性快照（territoryStore.selected），缺席一律寫「未涵蓋」不寫 0。
 */
import { useMemo, type CSSProperties } from "react";
import { X } from "lucide-react";
import { Row, Title, PopupScroll } from "../components/featureInfo/shared";
import { DARK_FEATURE, FeatureThemeProvider, LIGHT_FEATURE, useFeatureTheme } from "../components/featureInfo/featureTheme";
import { COLORS, FONT_CJK, FONT_DATA, FONT_SIZE, FONT_WEIGHT, LIGHT, RADIUS, SURFACE } from "../styles/designTokens";
import { useLocale } from "../state/localeStore";
import { RES_LABEL, SCORE_TAGS, TAG_ORDER, TERRITORY_TEXT as T } from "./territoryText";
import { accentFor, availableAtRes, coverageText, formatAttrValue, type TerritoryAttribute } from "./territoryAttributes";
import { territoryStore, useTerritory } from "./territoryStore";
import { useTerritoryAttributes } from "./useTerritoryAttributes";
import "./territory.css";

const present = (v: unknown) => v !== undefined && v !== null && v !== "";
/** 等寬字只給純數字（spec §4.1）：值含中文單位時不用 mono */
const CJK = /[\u3400-\u9fff]/;
const monoOk = (s: string | null) => s !== null && !CJK.test(s);

export function TerritoryCard({ isDark }: { isDark: boolean }) {
  const { open, selected } = useTerritory();
  const attrs = useTerritoryAttributes(open);
  if (!open || !selected) return null;
  const list = attrs.status === "ready" ? attrs.data.attributes : [];
  const palette = isDark ? DARK_FEATURE : LIGHT_FEATURE;
  return (
    <FeatureThemeProvider palette={palette}>
      <div
        className="territory-card"
        style={{
          position: "relative", width: 280, maxWidth: "92vw", maxHeight: "80vh", minHeight: 0,
          display: "flex", flexDirection: "column",
          background: isDark ? SURFACE.strong : LIGHT.surfacePanel,
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          border: `1px solid ${isDark ? "rgba(100, 170, 255, 0.25)" : LIGHT.border}`,
          borderRadius: RADIUS.xl, padding: "12px 14px", fontFamily: FONT_CJK,
          "--fi-border-soft": palette.borderSoft,
        } as CSSProperties}
      >
        <button type="button" aria-label={T.cardClose} title={T.cardClose} onClick={() => territoryStore.select(null)}
          style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", color: palette.textDim, cursor: "pointer", padding: 2, display: "flex" }}>
          <X size={14} />
        </button>
        <CardBody props={selected} attributes={list} isDark={isDark} />
      </div>
    </FeatureThemeProvider>
  );
}

function CardBody({ props, attributes, isDark }: { props: Record<string, unknown>; attributes: TerritoryAttribute[]; isDark: boolean }) {
  const t = useFeatureTheme();
  const { formatNumber } = useLocale();
  const res = Number(props.res);
  const place = [props.county, props.town, props.village].filter(present).map(String).join(" ") || T.uncovered;
  const accent = isDark ? COLORS.accent : LIGHT.accent;

  const groups = useMemo(() => {
    const m = new Map<string, TerritoryAttribute[]>();
    for (const a of attributes) {
      if (a.tag === "標籤" || a.key.startsWith("score_")) continue;
      const arr = m.get(a.tag) ?? [];
      arr.push(a);
      m.set(a.tag, arr);
    }
    const order = [...TAG_ORDER, ...[...m.keys()].filter((k) => !(TAG_ORDER as readonly string[]).includes(k))];
    return order.filter((k) => m.has(k)).map((k) => ({ tag: k, items: m.get(k)! }));
  }, [attributes]);
  const byKey = useMemo(() => new Map(attributes.map((a) => [a.key, a] as const)), [attributes]);

  return (
    <>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1.2, marginBottom: 6, flexShrink: 0 }}>
        {T.cardEyebrow}{RES_LABEL[res] ? ` · ${RES_LABEL[res]}` : ""}
      </div>
      <div style={{ paddingRight: 16, flexShrink: 0 }}>
        <Title color={accent}>{place}</Title>
      </div>
      <PopupScroll>
        {/* 能力值 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "6px 0 4px" }}>
          {SCORE_TAGS.map((tag) => {
            const attr = byKey.get(tag.key);
            const raw = props[tag.key];
            const v = present(raw) ? Number(raw) : null;
            const color = accentFor({ key: tag.key, tag: "標籤" }, isDark);
            const cov = attr ? coverageText(attr) : null;
            return (
              <AbilityBar key={tag.key} label={tag.label} value={v !== null && Number.isFinite(v) ? v : null} color={color}
                caption={v === null || !Number.isFinite(v) ? T.uncovered
                  : cov ? T.beatArea(Math.round(v), cov) : T.beatAll(Math.round(v))}
                formatNumber={formatNumber} />
            );
          })}
        </div>

        {/* 依 tag 分組的全部屬性 */}
        {groups.map(({ tag, items }) => {
          const sources = groupSources(items);
          return (
            <div key={tag} style={{ marginTop: 10 }}>
              <div style={{ fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: t.textStrong, borderBottom: `1px solid ${t.border}`, paddingBottom: 3, marginBottom: 2 }}>{tag}</div>
              {items.filter((a) => !a.key.startsWith("biz_div_")).map((a) => {
                const here = availableAtRes(a, res);
                const shown = here ? formatAttrValue(a, props[a.key], formatNumber) : null;
                return (
                  <div key={a.key} style={{ display: "flex", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Row label={a.kind === "village_value" ? a.label.replace(/（村里值）$/, "") : a.label} value={shown ?? (here ? T.uncovered : T.zoomOut)} color={shown ? undefined : t.textDim} mono={a.kind !== "category" && monoOk(shown)} />
                    </div>
                    {a.kind === "village_value" && (
                      <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim, border: "1px solid currentColor", borderRadius: RADIUS.sm, padding: "0 3px", marginTop: 4, marginLeft: 4, flexShrink: 0 }}>{T.villageValue}</span>
                    )}
                  </div>
                );
              })}
              {items.some((a) => a.key.startsWith("biz_div_")) && (
                <BizDivRows items={items.filter((a) => a.key.startsWith("biz_div_"))} props={props} formatNumber={formatNumber} />
              )}
              {sources.length > 0 && (
                <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 3, lineHeight: 1.4 }}>
                  {sources.join("；")}
                </div>
              )}
            </div>
          );
        })}
      </PopupScroll>
    </>
  );
}

/** 產業大類：只列這格 >0 的大類，由多到少最多 5 個，其餘併「其他 N 類」 */
function BizDivRows({ items, props, formatNumber }: {
  items: TerritoryAttribute[]; props: Record<string, unknown>;
  formatNumber: (n: number, o?: Intl.NumberFormatOptions) => string;
}) {
  const t = useFeatureTheme();
  const present = items.filter((a) => props[a.key] !== undefined && props[a.key] !== null);
  if (present.length === 0) return <Row label="產業大類" value={T.uncovered} color={t.textDim} />;
  const positive = present
    .map((a) => ({ a, v: Number(props[a.key]) }))
    .filter((x) => Number.isFinite(x.v) && x.v > 0)
    .sort((x, y) => y.v - x.v);
  if (positive.length === 0) return <Row label="產業大類" value={T.bizNone} color={t.textDim} />;
  const top = positive.slice(0, 5);
  const rest = positive.slice(5);
  const restSum = rest.reduce((n, x) => n + x.v, 0);
  return (
    <>
      {top.map(({ a, v }) => <Row key={a.key} label={a.label.replace(/家數$/, "")} value={`${formatNumber(v)} 家`} />)}
      {rest.length > 0 && <Row label={T.bizOther(rest.length)} value={`${formatNumber(restSum)} 家`} color={t.textMuted} />}
    </>
  );
}

/**
 * 每組一行來源（站主尚未決定是否保留）：attributes.json 的 source 混有內部檔名（例 rail_stations_20260529），
 * 顯示前拿掉含底線的代號（spec §6.3）；「同上」「同 X」這類參照與 19 個產業大類的逐類說明不重列；同文同日只列一次。
 */
const INTERNAL_ID = /[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+/g;
function humanSource(raw: string): string {
  let s = raw.trim();
  const m = s.match(/^[A-Za-z][A-Za-z0-9_]*_[A-Za-z0-9_]+\s*（(.+)）$/);
  if (m) s = m[1]!;
  return s.replace(/（[^）]*_[^）]*）/g, "").replace(INTERNAL_ID, "").replace(/\s{2,}/g, " ").replace(/^[，、；\s]+|[，、；\s]+$/g, "").trim();
}
function groupSources(items: TerritoryAttribute[]): string[] {
  const out = new Set<string>();
  for (const a of items) {
    if (!a.source || a.key.startsWith("biz_div_")) continue;
    if (/^同/.test(a.source.trim())) continue;
    const src = humanSource(a.source);
    if (!src) continue;
    out.add(T.sourceLine(src, a.source_date ?? ""));
  }
  return [...out];
}

function AbilityBar({ label, value, color, caption, formatNumber }: {
  label: string; value: number | null; color: string; caption: string;
  formatNumber: (n: number, o?: Intl.NumberFormatOptions) => string;
}) {
  const t = useFeatureTheme();
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semibold, color: t.textStrong, minWidth: 52 }}>{label}</span>
        <span style={{ flex: 1 }} />
        {value !== null && (
          <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color }}>
            {formatNumber(Math.round(value))}
          </span>
        )}
      </div>
      {/* 能力條：10 格刻度感（遊戲血條），填色＝該標籤色 */}
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined}
        style={{ position: "relative", height: 7, marginTop: 3, borderRadius: RADIUS.pill, background: t.bgStrong, overflow: "hidden" }}>
        <div className="territory-bar-fill" style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: RADIUS.pill, transition: "width 0.35s ease-out" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), ${t.border} calc(10% - 1px) 10%)` }} />
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2 }}>{caption}</div>
    </div>
  );
}
