/**
 * 24 小時構成（計畫書 §6.2 24h_profile）：每個家族一列小圖，10 分鐘一格。
 * - 縱軸是相對潛勢 0–1（非 dB），連續可判斷格畫成填色面積；inactive 貼在基線（真正的 0）；
 * - unknown／unavailable 畫斜線格（空隙，不是 0），右側標比例；
 * - 雨標「每小時解析度」；時間軸游標用 UI 節流時間（useUiTime，4 Hz），不跟每幀。
 */
import { useId } from "react";
import type { DayProfile } from "../../sound/engines/receiverQuery";
import { SOUND_FAMILY_COLORS, SOUND_RECEIVER_COLOR, SOUND_UNKNOWN_COLOR } from "../../sound/soundAtlasColors";
import { useUiTime } from "../../hooks/useTimeline";
import { useLocale } from "../../state/localeStore";
import { FONT_DATA, FONT_SIZE } from "../../styles/designTokens";
import { FAMILY_KEYS } from "./soundAtlasText";

const W = 300;

/**
 * 連續可判斷格（active／inactive）連成填色面積；unknown／unavailable 斷開（空隙，不是 0）。
 * 每格畫成平台（左右兩點同值），避免把 10 分鐘格的值內插到相鄰格。
 */
export function areaPaths(
  values: readonly (number | null)[],
  statuses: readonly string[],
  x0: number,
  bw: number,
  base: number,
  top: number,
): string[] {
  const out: string[] = [];
  let pts: string[] = [];
  let startX = 0;
  let lastX = 0;
  let any = false;
  const flush = () => {
    if (pts.length && any) out.push(`M${startX.toFixed(2)} ${base}${pts.join("")}L${lastX.toFixed(2)} ${base}Z`);
    pts = [];
    any = false;
  };
  values.forEach((v, i) => {
    const st = statuses[i];
    if (st === "unknown" || st === "unavailable") {
      flush();
      return;
    }
    const xa = x0 + i * bw;
    const xb = xa + bw;
    const y = base - Math.max(0, Math.min(1, v ?? 0)) * (base - top);
    if (!pts.length) startX = xa;
    if ((v ?? 0) > 0) any = true;
    pts.push(`L${xa.toFixed(2)} ${y.toFixed(2)}L${xb.toFixed(2)} ${y.toFixed(2)}`);
    lastX = xb;
  });
  flush();
  return out;
}
const ROW_H = 26;
const LABEL_W = 40;
const RIGHT_W = 52;

export function SoundDayProfile({ profile, mutedColor, dimColor, axisColor }: {
  profile: DayProfile;
  mutedColor: string;
  dimColor: string;
  axisColor: string;
}) {
  const { t } = useLocale();
  const uiTime = useUiTime();
  const patternId = `sound-hatch-${useId().replace(/:/g, "")}`;
  const n = profile.binStarts.length;
  const plotW = W - LABEL_W - RIGHT_W;
  const bw = plotW / n;
  const dayStart = profile.binStarts[0] ?? 0;
  const cursorX = uiTime >= dayStart && uiTime < dayStart + 86_400 ? LABEL_W + ((uiTime - dayStart) / 86_400) * plotW : null;
  const height = profile.families.length * ROW_H + 14;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={t("soundAtlas.profile.title")} style={{ display: "block" }}>
      <defs>
        <pattern id={patternId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={SOUND_UNKNOWN_COLOR} strokeWidth="1.2" />
        </pattern>
      </defs>
      {profile.families.map((fam, row) => {
        const y0 = row * ROW_H;
        const base = y0 + ROW_H - 4;
        const top = y0 + 3;
        const famLabel = t(FAMILY_KEYS[fam.family]);
        return (
          <g key={fam.family} aria-label={t("soundAtlas.profile.chartLabel", { family: famLabel })}>
            <text x={0} y={base - 6} fontSize={9} fill={mutedColor}>{famLabel}</text>
            {fam.family === "rain" && <text x={0} y={base + 3} fontSize={7} fill={dimColor}>{t("soundAtlas.profile.rainHourly")}</text>}
            <line x1={LABEL_W} x2={LABEL_W + plotW} y1={base} y2={base} stroke={axisColor} strokeWidth={0.5} />
            {fam.statuses.map((st, i) =>
              st === "unknown" || st === "unavailable"
                ? <rect key={i} x={LABEL_W + i * bw} y={top} width={bw} height={base - top} fill={`url(#${patternId})`} opacity={0.7} />
                : null,
            )}
            {areaPaths(fam.values, fam.statuses, LABEL_W, bw, base, top).map((d, k) => (
              <path key={k} d={d} fill={SOUND_FAMILY_COLORS[fam.family]} fillOpacity={0.55} stroke={SOUND_FAMILY_COLORS[fam.family]} strokeWidth={1} strokeLinejoin="round" />
            ))}
            <text x={W} y={base - 6} fontSize={8} fill={dimColor} textAnchor="end" style={{ fontFamily: FONT_DATA }}>
              {`${Math.round(fam.unknownRatio * 100)}%`}
            </text>
          </g>
        );
      })}
      {[0, 6, 12, 18, 24].map((h) => (
        <text key={h} x={LABEL_W + (h / 24) * plotW} y={height - 2} fontSize={8} fill={dimColor} textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"} style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs }}>
          {String(h).padStart(2, "0")}
        </text>
      ))}
      {cursorX != null && (
        <g aria-hidden="true">
          <line x1={cursorX} x2={cursorX} y1={0} y2={height - 12} stroke={SOUND_RECEIVER_COLOR} strokeWidth={1.8} />
          <circle cx={cursorX} cy={height - 12} r={2.6} fill={SOUND_RECEIVER_COLOR} />
        </g>
      )}
    </svg>
  );
}
