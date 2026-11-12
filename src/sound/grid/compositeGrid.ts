/**
 * 綜合網格（W6-4/5，`soundComposite`）：由七族「當下的網格碼」逐格算出甲、乙兩版（預覽，使用者看過再選一個）。
 *
 * 規則（正本 docs/features/city-sound-atlas/MODEL_DECISIONS.md §10；常數在 soundProfiles.COMPOSITE）：
 * - 每族先把格碼換成「顯示分級 L（0–4）」與「潛勢下緣 s（0–1）」；255＝該族在該格無法判斷（unknown ≠ 0）。
 *   雨：L＝雨分級，s＝rainPotential(該級雨量下緣)；道路：L＝五級，s＝該級潛勢下緣（0／0.1／0.3／0.5／0.75）；
 *   飛機／鐵道／風／浪／河：L＝potentialLevelOfCode(碼, 門檻)，s＝碼的潛勢下緣 (碼−1)/200；飛機低於顯示門檻 → L＝0、s＝0。
 * - 甲（活躍種數分級）：數 L ≥ activeMinLevel 的族（不相加），依 levelCuts 分平靜／一般／熱鬧；可判斷族 < minKnownFamilies → 255。
 * - 乙（假設權重指數）：Σ w·s ／ Σ w（只算可判斷的族，權重重新正規化）；可判斷權重占比 < minKnownWeightShare 或可判斷族 < minKnownFamilies → 255。
 *   碼＝round(指數 × 200)（0–200）。
 * 綜合網格不另出檔：Worker 用同一個 10 分格的七幀即時算；點選查詢面板對該格七個碼呼叫同一支 compositeCell。
 */
import { COMPOSITE, ROAD_GRID } from "../model/soundProfiles";
import { rainPotential } from "../engines/relativePotentialKernel";
import { GRID_CELLS, GRID_UNKNOWN, inScopeCells } from "./gridSpec";
import { minCodeForPotential, POTENTIAL_CODE_MAX, POTENTIAL_CODE_SCALE, potentialLevelOfCode } from "./potentialCode";
import { rainClassLowerEdgeMmPerHour, type RainClass } from "./rainClass";
import { decodeRoadGridCode } from "./roadNetwork";

export type CompositeFamily = (typeof COMPOSITE.families.value)[number];
export const COMPOSITE_FAMILIES: readonly CompositeFamily[] = COMPOSITE.families.value;
export const COMPOSITE_FAMILY_COUNT = COMPOSITE_FAMILIES.length;

/** 甲的三級碼（0 平靜、1 一般、2 熱鬧；255 無法判斷） */
export type CompositeLevelA = 0 | 1 | 2;
export const COMPOSITE_B_SCALE = 200;

export interface FamilyTerm {
  /** 顯示分級 0–4 */
  level: number;
  /** 潛勢下緣 0–1 */
  s: number;
}

const ROAD_LEVEL_LOWER = [0, ...ROAD_GRID.potentialClassEdges.value];

/** 一族一格的碼 → 分級與潛勢下緣；無法判斷 → null。gate＝飛機顯示門檻（潛勢） */
export function familyTerm(family: CompositeFamily, code: number, gate = 0): FamilyTerm | null {
  if (code === GRID_UNKNOWN) return null;
  if (family === "rain") {
    if (code < 0 || code > 4) return null;
    return { level: code, s: code === 0 ? 0 : rainPotential(rainClassLowerEdgeMmPerHour(code as RainClass)) ?? 0 };
  }
  if (family === "road_traffic") {
    const d = decodeRoadGridCode(code);
    if (!d) return null;
    return { level: d.level, s: ROAD_LEVEL_LOWER[d.level]! };
  }
  if (code > POTENTIAL_CODE_MAX) return null;
  const g = family === "aviation" ? gate : 0;
  if (code === 0 || code < minCodeForPotential(g)) return { level: 0, s: 0 };
  return { level: potentialLevelOfCode(code, g)!, s: (code - 1) / POTENTIAL_CODE_SCALE };
}

export interface CompositeCell {
  /** 可判斷的族數（0–7） */
  known: number;
  /** 偏活躍的族數 */
  activeCount: number;
  /** 偏活躍族裡最強的（分級高者、同級比潛勢、再同依族序）；沒有偏活躍族 → null */
  dominant: CompositeFamily | null;
  /** 甲：0 平靜／1 一般／2 熱鬧／255 無法判斷 */
  codeA: number;
  /** 乙：可判斷權重占比（0–1） */
  knownWeightShare: number;
  /** 乙：指數 0–1（無法判斷 → null） */
  index: number | null;
  /** 乙：碼 0–200／255 */
  codeB: number;
  /** 各族分級與潛勢（依 COMPOSITE_FAMILIES 順序；null＝無法判斷） */
  terms: (FamilyTerm | null)[];
}

const WEIGHTS = COMPOSITE_FAMILIES.map((f) => COMPOSITE.weights.value[f]!);
const WEIGHT_SUM = WEIGHTS.reduce((a, b) => a + b, 0);
const ACTIVE_MIN = COMPOSITE_FAMILIES.map((f) => COMPOSITE.activeMinLevel.value[f]!);

/** 偏活躍種數 → 甲的分級 */
export function levelAOfCount(n: number): CompositeLevelA {
  const [c1, c2] = COMPOSITE.levelCuts.value;
  return n < c1! ? 0 : n < c2! ? 1 : 2;
}

/** 一格：codes 依 COMPOSITE_FAMILIES 順序的七個網格碼 */
export function compositeCell(codes: ArrayLike<number>, gate = 0): CompositeCell {
  const terms: (FamilyTerm | null)[] = [];
  let known = 0, activeCount = 0, kw = 0, ws = 0;
  let dom = -1;
  for (let i = 0; i < COMPOSITE_FAMILY_COUNT; i++) {
    const t = familyTerm(COMPOSITE_FAMILIES[i]!, codes[i]!, gate);
    terms.push(t);
    if (!t) continue;
    known++;
    kw += WEIGHTS[i]!;
    ws += WEIGHTS[i]! * t.s;
    if (t.level >= ACTIVE_MIN[i]!) {
      activeCount++;
      const d = dom >= 0 ? terms[dom]! : null;
      if (!d || t.level > d.level || (t.level === d.level && t.s > d.s)) dom = i;
    }
  }
  const codeA = known < COMPOSITE.minKnownFamilies.value ? GRID_UNKNOWN : levelAOfCount(activeCount);
  const share = kw / WEIGHT_SUM;
  const index = share < COMPOSITE.minKnownWeightShare.value || known < COMPOSITE.minKnownFamilies.value || kw === 0 ? null : ws / kw;
  return {
    known, activeCount, dominant: dom >= 0 ? COMPOSITE_FAMILIES[dom]! : null, codeA,
    knownWeightShare: share, index, codeB: index == null ? GRID_UNKNOWN : Math.round(index * COMPOSITE_B_SCALE), terms,
  };
}

/** 碼 → 乙的指數下緣（popup 顯示用） */
export const compositeIndexOfCode = (code: number): number | null => (code === GRID_UNKNOWN || code > COMPOSITE_B_SCALE ? null : code / COMPOSITE_B_SCALE);

/**
 * 整幀：frames 依 COMPOSITE_FAMILIES 順序（缺 → 視為整幀無法判斷）。範圍外格＝255。
 * 只算碼與兩版的值；逐格與 compositeCell 同一規則（測試另以文件公式獨立重算）。
 */
export function compositeFrames(
  frames: readonly (Uint8Array | null)[],
  gate = 0,
  outA: Uint8Array = new Uint8Array(GRID_CELLS),
  outB: Uint8Array = new Uint8Array(GRID_CELLS),
  cells: Uint32Array = inScopeCells(),
): { a: Uint8Array; b: Uint8Array } {
  outA.fill(GRID_UNKNOWN);
  outB.fill(GRID_UNKNOWN);
  const codes = new Uint8Array(COMPOSITE_FAMILY_COUNT);
  for (let k = 0; k < cells.length; k++) {
    const c = cells[k]!;
    for (let i = 0; i < COMPOSITE_FAMILY_COUNT; i++) codes[i] = frames[i] ? frames[i]![c]! : GRID_UNKNOWN;
    const r = compositeCell(codes, gate);
    outA[c] = r.codeA;
    outB[c] = r.codeB;
  }
  return { a: outA, b: outB };
}
