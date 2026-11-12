/**
 * 飛機網格的顯示門檻（W6-3，三選一，待使用者選定）：只影響網格「有飛機」的分級（潛勢 < 門檻歸「沒有或低於門檻」），
 * 不改 queryReceiver、24h 構成圖、接收點面板的值。門檻都是 1/250 的整數倍（potentialCode 恰好對齊碼界）。
 * 依 11-09 分布的提案與各門檻「有飛機」格比例寫在 docs/features/city-sound-atlas/MODEL_DECISIONS.md §9。
 */
export type AviationGateId = "current" | "strict" | "very_strict";

export interface AviationGate {
  id: AviationGateId;
  potential: number;
}

export const AVIATION_GRID_GATES: readonly AviationGate[] = [
  { id: "current", potential: 0.1 },
  { id: "strict", potential: 0.2 },
  { id: "very_strict", potential: 0.4 },
];

export const DEFAULT_AVIATION_GATE: AviationGateId = "strict";

/** 統計用的門檻階梯（預算時順便算各門檻的「有飛機」比例，供提案） */
export const AVIATION_GATE_LADDER = [0.02, 0.04, 0.1, 0.2, 0.3, 0.4, 0.5] as const;

export function aviationGatePotential(id: string | null | undefined): number {
  return (AVIATION_GRID_GATES.find((g) => g.id === id) ?? AVIATION_GRID_GATES.find((g) => g.id === DEFAULT_AVIATION_GATE)!).potential;
}

/**
 * 飛機每日包的分箱邊界（潛勢）：三個門檻＋共用顯示分級（0.25／0.5／0.75）＋遠方細分。
 * 包只存箱下緣碼（binLookup），精確值在格 popup 對格心即時算（同 queryReceiver）。
 */
export const AVIATION_PACK_EDGES = [0.02, 0.04, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75] as const;
