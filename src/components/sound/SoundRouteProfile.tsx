/**
 * 路線剖面（沿途主要聲源）：橫軸是沿線距離，每個家族一列小圖（相對潛勢 0–1，非 dB）。
 * 只列沿途至少有一個樣本活躍的家族；無法判斷的路段畫斜線（空隙，不是 0）。
 * 是「沿線接觸哪些聲源活動」，**不是噪音暴露量**（不累加、不換算劑量）。
 */
import { useId } from "react";
import type { RouteProfile } from "../../sound/engines/routeProfile";
import { SOUND_FAMILY_COLORS, SOUND_UNKNOWN_COLOR } from "../../sound/soundAtlasColors";
import type { SoundSourceFamily } from "../../sound/types";
import { useLocale } from "../../state/localeStore";
import { FONT_DATA, FONT_SIZE } from "../../styles/designTokens";
import { areaPaths } from "./SoundDayProfile";
import { FAMILY_KEYS, formatDistanceM } from "./soundAtlasText";

const W = 300;
const ROW_H = 26;
const LABEL_W = 40;
const RIGHT_W = 52;

export function SoundRouteProfile({ profile, mutedColor, dimColor, axisColor }: {
  profile: RouteProfile<SoundSourceFamily>;
  mutedColor: string;
  dimColor: string;
  axisColor: string;
}) {
  const { t } = useLocale();
  const patternId = `sound-route-hatch-${useId().replace(/:/g, "")}`;
  const rows = profile.families.filter((f) => (profile.activeSampleCount[f.family] ?? 0) > 0);
  const n = profile.samples.length;
  const plotW = W - LABEL_W - RIGHT_W;
  const bw = n > 0 ? plotW / n : plotW;
  const height = Math.max(1, rows.length) * ROW_H + 14;
  if (rows.length === 0) return null;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={t("soundAtlas.route.chartLabel")} style={{ display: "block" }}>
      <defs>
        <pattern id={patternId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={SOUND_UNKNOWN_COLOR} strokeWidth="1.2" />
        </pattern>
      </defs>
      {rows.map((fam, row) => {
        const y0 = row * ROW_H;
        const base = y0 + ROW_H - 4;
        const top = y0 + 3;
        const share = n > 0 ? (profile.activeSampleCount[fam.family] ?? 0) / n : 0;
        return (
          <g key={fam.family}>
            <text x={0} y={base - 6} fontSize={9} fill={mutedColor}>{t(FAMILY_KEYS[fam.family])}</text>
            <line x1={LABEL_W} x2={LABEL_W + plotW} y1={base} y2={base} stroke={axisColor} strokeWidth={0.5} />
            {fam.statuses.map((st, i) =>
              st === "unknown" || st === "unavailable"
                ? <rect key={i} x={LABEL_W + i * bw} y={top} width={bw} height={base - top} fill={`url(#${patternId})`} opacity={0.7} />
                : null,
            )}
            {areaPaths(fam.values, fam.statuses, LABEL_W, bw, base, top).map((d, k) => (
              <path key={k} d={d} fill={SOUND_FAMILY_COLORS[fam.family]} fillOpacity={0.55} stroke={SOUND_FAMILY_COLORS[fam.family]} strokeWidth={1} strokeLinejoin="round" />
            ))}
            {/* 右側：此家族活躍的樣本比例（沿線多少路段接觸得到） */}
            <text x={W} y={base - 6} fontSize={8} fill={dimColor} textAnchor="end" style={{ fontFamily: FONT_DATA }}>
              {`${Math.round(share * 100)}%`}
            </text>
          </g>
        );
      })}
      {[0, 0.5, 1].map((f) => (
        <text key={f} x={LABEL_W + f * plotW} y={height - 2} fontSize={8} fill={dimColor} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"} style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs }}>
          {formatDistanceM(profile.totalDistanceM * f)}
        </text>
      ))}
    </svg>
  );
}

/** 沿線最常是「最高活躍聲源」的家族（依樣本數排序，最多 3 個） */
export function dominantFamilies(profile: RouteProfile<SoundSourceFamily>, limit = 3): { family: SoundSourceFamily; share: number }[] {
  const counts = new Map<SoundSourceFamily, number>();
  for (const s of profile.samples) if (s.dominant) counts.set(s.dominant.family, (counts.get(s.dominant.family) ?? 0) + 1);
  const n = profile.samples.length || 1;
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([family, c]) => ({ family, share: c / n }));
}
