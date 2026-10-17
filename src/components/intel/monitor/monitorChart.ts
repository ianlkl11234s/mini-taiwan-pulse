/**
 * 監看模式走勢圖高三階（spec §5.35 B1）——指「圖區」高度，不含軸字的留白。
 * 迷你 24（列內）／標準 48（卡內主圖）／大 96（全寬主角圖）；圖寬一律 100% 隨格子。
 */
export const MON_CHART_H = { mini: 24, std: 48, lg: 96 } as const;

export type MonChartTier = keyof typeof MON_CHART_H;
