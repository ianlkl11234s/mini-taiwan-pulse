/**
 * 綜合網格（W6-4/5，`soundComposite`）：由七族「當下的網格碼」逐格算出三種呈現方式（2026-11-16 使用者決定三種並存：主因〔預設〕／活躍種數／綜合指數）。
 *
 * 規則（正本 docs/features/city-sound-atlas/MODEL_DECISIONS.md §10；常數在 soundProfiles.COMPOSITE）：
 * - 每族先把格碼換成「顯示分級 L（0–4）」與「潛勢下緣 s（0–1）」；255＝該族在該格無法判斷（unknown ≠ 0）。
 *   雨：L＝雨分級，s＝rainPotential(該級雨量下緣)；道路：L＝五級，s＝該級潛勢下緣（0／0.1／0.3／0.5／0.75）；
 *   飛機／鐵道／風／浪／河：L＝potentialLevelOfCode(碼, 門檻)，s＝碼的潛勢下緣 (碼−1)/200；飛機低於顯示門檻 → L＝0、s＝0。
 * - 活躍種數：數 L ≥ activeMinLevel 的族（不相加），依 levelCuts 分平靜／一般／熱鬧；可判斷族 < minKnownFamilies → 255。
 * - 綜合指數（假設權重指數）：Σ w·s ／ Σ w（只算可判斷的族，權重重新正規化）；可判斷權重占比 < minKnownWeightShare 或可判斷族 < minKnownFamilies → 255。
 *   碼＝round(指數 × 200)（0–200）。
 * - 主因（W6-8）：分級 ≥ 1（「低」以上）的族裡最明顯的一族（和活躍種數的「最明顯」同一個比較：分級高者、同級比潛勢、再同依族序），
 *   碼＝1 + 族序 × 4 + (分級 − 1)（1–28）；沒有任何族達「低」→ 0（平靜）；可判斷族 < minKnownFamilies → 255（同活躍種數）。
 * - 另回每格七族分級的打包（3 bit／族，7＝無法判斷），給主執行緒滑過提示直接查，不必重算。
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

/** 活躍種數的三級碼（0 平靜、1 一般、2 熱鬧；255 無法判斷） */
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

/** 主因：每族 4 級（低→很高） */
export const COMPOSITE_C_LEVELS = 4;
const C_UNKNOWN_LEVEL = 7;

export interface CompositeCell {
  /** 可判斷的族數（0–7） */
  known: number;
  /** 偏活躍的族數 */
  activeCount: number;
  /** 偏活躍族裡最強的（分級高者、同級比潛勢、再同依族序）；沒有偏活躍族 → null */
  dominant: CompositeFamily | null;
  /** 主因：分級 ≥ 1 的族裡最強的（同一個比較）；沒有 → null */
  top: CompositeFamily | null;
  /** 主因：0 平靜／1–28 族×分級／255 無法判斷 */
  codeC: number;
  /** 活躍種數：0 平靜／1 一般／2 熱鬧／255 無法判斷 */
  codeA: number;
  /** 綜合指數：可判斷權重占比（0–1） */
  knownWeightShare: number;
  /** 綜合指數：指數 0–1（無法判斷 → null） */
  index: number | null;
  /** 綜合指數：碼 0–200／255 */
  codeB: number;
  /** 各族分級與潛勢（依 COMPOSITE_FAMILIES 順序；null＝無法判斷） */
  terms: (FamilyTerm | null)[];
}

const WEIGHTS = COMPOSITE_FAMILIES.map((f) => COMPOSITE.weights.value[f]!);
const WEIGHT_SUM = WEIGHTS.reduce((a, b) => a + b, 0);
const ACTIVE_MIN = COMPOSITE_FAMILIES.map((f) => COMPOSITE.activeMinLevel.value[f]!);

/** 偏活躍種數 → 活躍種數的分級 */
export function levelAOfCount(n: number): CompositeLevelA {
  const [c1, c2] = COMPOSITE.levelCuts.value;
  return n < c1! ? 0 : n < c2! ? 1 : 2;
}

/** 一格：codes 依 COMPOSITE_FAMILIES 順序的七個網格碼 */
export function compositeCell(codes: ArrayLike<number>, gate = 0): CompositeCell {
  const terms: (FamilyTerm | null)[] = [];
  let known = 0, activeCount = 0, kw = 0, ws = 0;
  let dom = -1, top = -1;
  // 「最明顯」：分級高者、同級比潛勢、再同依族序（先到者）——活躍種數的 dominant 與主因的 top 共用
  const stronger = (t: FamilyTerm, j: number) => j < 0 || t.level > terms[j]!.level || (t.level === terms[j]!.level && t.s > terms[j]!.s);
  for (let i = 0; i < COMPOSITE_FAMILY_COUNT; i++) {
    const t = familyTerm(COMPOSITE_FAMILIES[i]!, codes[i]!, gate);
    terms.push(t);
    if (!t) continue;
    known++;
    kw += WEIGHTS[i]!;
    ws += WEIGHTS[i]! * t.s;
    if (t.level >= 1 && stronger(t, top)) top = i;
    if (t.level >= ACTIVE_MIN[i]!) {
      activeCount++;
      if (stronger(t, dom)) dom = i;
    }
  }
  const enough = known >= COMPOSITE.minKnownFamilies.value;
  const codeA = !enough ? GRID_UNKNOWN : levelAOfCount(activeCount);
  const codeC = !enough ? GRID_UNKNOWN : top < 0 ? 0 : 1 + top * COMPOSITE_C_LEVELS + (Math.min(terms[top]!.level, COMPOSITE_C_LEVELS) - 1);
  const share = kw / WEIGHT_SUM;
  const index = share < COMPOSITE.minKnownWeightShare.value || known < COMPOSITE.minKnownFamilies.value || kw === 0 ? null : ws / kw;
  return {
    known, activeCount, dominant: dom >= 0 ? COMPOSITE_FAMILIES[dom]! : null, top: top >= 0 ? COMPOSITE_FAMILIES[top]! : null, codeC, codeA,
    knownWeightShare: share, index, codeB: index == null ? GRID_UNKNOWN : Math.round(index * COMPOSITE_B_SCALE), terms,
  };
}

/** 主因的碼 → 主因族與分級（1–4）；0 平靜、255 無法判斷 → null */
export function decodeCompositeC(code: number): { family: CompositeFamily; level: number } | null {
  if (code < 1 || code > COMPOSITE_FAMILY_COUNT * COMPOSITE_C_LEVELS) return null;
  return { family: COMPOSITE_FAMILIES[Math.floor((code - 1) / COMPOSITE_C_LEVELS)]!, level: ((code - 1) % COMPOSITE_C_LEVELS) + 1 };
}

/** 七族分級打包（族序 i 佔第 3i–3i+2 bit；7＝無法判斷）；滑過提示用 */
export function packLevels(terms: readonly (FamilyTerm | null)[]): number {
  let v = 0;
  for (let i = 0; i < terms.length; i++) v |= (terms[i] ? Math.min(terms[i]!.level, 6) : C_UNKNOWN_LEVEL) << (3 * i);
  return v >>> 0;
}

/** 解包：依 COMPOSITE_FAMILIES 順序，null＝無法判斷 */
export function unpackLevels(v: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < COMPOSITE_FAMILY_COUNT; i++) { const l = (v >>> (3 * i)) & 7; out.push(l === C_UNKNOWN_LEVEL ? null : l); }
  return out;
}

/** 碼 → 綜合指數的指數下緣（popup 顯示用） */
export const compositeIndexOfCode = (code: number): number | null => (code === GRID_UNKNOWN || code > COMPOSITE_B_SCALE ? null : code / COMPOSITE_B_SCALE);

/**
 * 整幀：frames 依 COMPOSITE_FAMILIES 順序（缺 → 視為整幀無法判斷）。範圍外格＝255（lv＝0）。
 * 只算碼與三版的值＋七族分級打包；逐格與 compositeCell 同一規則（測試另以文件公式獨立重算）。
 */
export function compositeFrames(
  frames: readonly (Uint8Array | null)[],
  gate = 0,
  outA: Uint8Array = new Uint8Array(GRID_CELLS),
  outB: Uint8Array = new Uint8Array(GRID_CELLS),
  cells: Uint32Array = inScopeCells(),
  outC: Uint8Array = new Uint8Array(outA.length),
  outLv: Uint32Array = new Uint32Array(outA.length),
): { a: Uint8Array; b: Uint8Array; c: Uint8Array; lv: Uint32Array } {
  outA.fill(GRID_UNKNOWN);
  outB.fill(GRID_UNKNOWN);
  outC.fill(GRID_UNKNOWN);
  outLv.fill(0);
  const codes = new Uint8Array(COMPOSITE_FAMILY_COUNT);
  for (let k = 0; k < cells.length; k++) {
    const c = cells[k]!;
    for (let i = 0; i < COMPOSITE_FAMILY_COUNT; i++) codes[i] = frames[i] ? frames[i]![c]! : GRID_UNKNOWN;
    const r = compositeCell(codes, gate);
    outA[c] = r.codeA;
    outB[c] = r.codeB;
    outC[c] = r.codeC;
    outLv[c] = packLevels(r.terms);
  }
  return { a: outA, b: outB, c: outC, lv: outLv };
}
