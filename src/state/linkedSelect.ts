/**
 * 連動選單（`kind: "linkedSelect"`，圖層面板統一 C 段）的共用邏輯與 provider 註冊表。
 *
 * 規格（`data/layerParamsSpec.ts` 的 `LinkedSelectParamSpec`）只宣告「這一列存在、連到哪個 provider」；
 * 值與選項由 provider 從自己的 store 算出來（統計：`regionalStatisticsStore`）。本檔放三件事：
 *
 * 1. **純函式**：合法組合（tuple）→ 某一列的選項；改一列時其他列怎麼跟著動（全部 provider 共用同一條規則）。
 * 2. **provider 註冊表**：buildParamControls／Agent／場景存檔都經這裡讀寫，不認識統計的細節。
 * 3. **場景還原**：等選項載入後再逐列驗證、套用（舊存檔沒有這些值 → 什麼都不做）。
 */
import { getParamsSpec, type LinkedSelectParamSpec } from "../data/layerParamsSpec";

export type LinkedSelectStatus = "idle" | "loading" | "ready" | "error";

export interface LinkedSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

/** 一組合法的值（以連動選單的 `name` 為 key）；缺某一列＝這個組合不適用該列（例：別的指標還沒載入細項）。 */
export interface LinkedSelectTuple {
  readonly values: Readonly<Record<string, string>>;
}

/** 一列在連動計算裡需要的資訊（宣告順序即上下游順序） */
export interface LinkedSelectField {
  name: string;
  dependsOn: readonly string[];
}

export interface LinkedSelectSnapshot {
  status: LinkedSelectStatus;
  /** 白話錯誤（status === "error"） */
  error?: string;
  options: LinkedSelectOption[];
  /** 目前值；沒有合法組合時為 "" */
  value: string;
}

export interface LinkedSelectProvider {
  snapshot(layerKey: string, spec: LinkedSelectParamSpec): LinkedSelectSnapshot;
  /** 設定一列；值必須在當下選項內（否則丟 `LINKED_SELECT_VALUE_INVALID`）。可回 Promise（例：要先載入目標資料）。 */
  set(layerKey: string, spec: LinkedSelectParamSpec, value: string): void | Promise<void>;
  subscribe(layerKey: string, callback: () => void): () => void;
  /** 觸發載入（選項來源、資料本體）；可重複呼叫 */
  ensure?(layerKey: string): void;
  /** 錯誤後重試 */
  retry?(layerKey: string): void;
}

export const LINKED_SELECT_VALUE_INVALID = "LINKED_SELECT_VALUE_INVALID";
export const LINKED_SELECT_NOT_READY = "LINKED_SELECT_NOT_READY";

// ══════════════════════════════════════════════════════════════════
//  純函式
// ══════════════════════════════════════════════════════════════════

function matches(tuple: LinkedSelectTuple, fixed: Readonly<Record<string, string>>): boolean {
  return Object.entries(fixed).every(([name, value]) => tuple.values[name] === value);
}

/** 本列在「上游各列目前值」之下的合法值（依組合出現順序、去重；不適用本列的組合略過）。 */
export function linkedSelectValues(
  field: LinkedSelectField,
  tuples: readonly LinkedSelectTuple[],
  current: Readonly<Record<string, string>>,
): string[] {
  const fixed = Object.fromEntries(field.dependsOn.flatMap((name) => current[name] === undefined ? [] : [[name, current[name]!]]));
  const out: string[] = [];
  for (const tuple of tuples) {
    const value = tuple.values[field.name];
    if (value === undefined || !matches(tuple, fixed) || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}

/**
 * 改一列之後要落在哪一個合法組合（全部 provider 共用的規則）：
 *
 * - 宣告順序在 `changed` 之前的列：保持目前值；
 * - `changed`：設成 `value`（必須是它當下的合法值，否則回 null）；
 * - 之後的每一列依序：目前值若仍在「已決定各列」之下合法就保留，否則改成第一個合法值；
 *   該列在剩下的組合裡完全不適用（值缺席）就跳過。
 *
 * 回傳第一個符合全部已決定值的組合；找不到（不該發生）回 null。
 */
export function resolveLinkedSelectChange<T extends LinkedSelectTuple>(
  fields: readonly LinkedSelectField[],
  tuples: readonly T[],
  current: Readonly<Record<string, string>>,
  changed: string,
  value: string,
): T | null {
  const index = fields.findIndex((field) => field.name === changed);
  if (index < 0) return null;
  if (!linkedSelectValues(fields[index]!, tuples, current).includes(value)) return null;
  const fixed: Record<string, string> = {};
  for (const field of fields.slice(0, index)) if (current[field.name] !== undefined && current[field.name] !== "") fixed[field.name] = current[field.name]!;
  fixed[changed] = value;
  for (const field of fields.slice(index + 1)) {
    const candidates = tuples.filter((tuple) => matches(tuple, fixed));
    const legal: string[] = [];
    for (const tuple of candidates) {
      const v = tuple.values[field.name];
      if (v !== undefined && !legal.includes(v)) legal.push(v);
    }
    if (legal.length === 0) continue;
    fixed[field.name] = legal.includes(current[field.name] ?? "") ? current[field.name]! : legal[0]!;
  }
  return tuples.find((tuple) => matches(tuple, fixed)) ?? null;
}

// ══════════════════════════════════════════════════════════════════
//  provider 註冊表
// ══════════════════════════════════════════════════════════════════

const providers = new Map<string, LinkedSelectProvider>();
const IDLE: LinkedSelectSnapshot = { status: "idle", options: [], value: "" };

export function registerLinkedSelectProvider(id: string, provider: LinkedSelectProvider): void {
  providers.set(id, provider);
}

export function linkedSelectProvider(id: string): LinkedSelectProvider | undefined {
  return providers.get(id);
}

export function linkedSelectSpecs(layerKey: string): LinkedSelectParamSpec[] {
  return (getParamsSpec(layerKey) ?? []).filter((spec): spec is LinkedSelectParamSpec => spec.kind === "linkedSelect");
}

export function linkedSelectSnapshot(layerKey: string, spec: LinkedSelectParamSpec): LinkedSelectSnapshot {
  return providers.get(spec.provider)?.snapshot(layerKey, spec) ?? IDLE;
}

/** 設定一列（UI、Agent、場景還原共用入口）。provider 不存在或未就緒時丟清楚的錯誤碼。 */
export function setLinkedSelect(layerKey: string, spec: LinkedSelectParamSpec, value: string): void | Promise<void> {
  const provider = providers.get(spec.provider);
  if (!provider) throw new Error(LINKED_SELECT_NOT_READY);
  return provider.set(layerKey, spec, value);
}

/** 同一 key 用到的 provider 全部訂閱；回傳取消函式。 */
export function subscribeLinkedSelects(layerKey: string, callback: () => void): () => void {
  const ids = [...new Set(linkedSelectSpecs(layerKey).map((spec) => spec.provider))];
  const offs = ids.flatMap((id) => {
    const provider = providers.get(id);
    return provider ? [provider.subscribe(layerKey, callback)] : [];
  });
  return () => offs.forEach((off) => off());
}

export function ensureLinkedSelects(layerKey: string): void {
  const ids = [...new Set(linkedSelectSpecs(layerKey).map((spec) => spec.provider))];
  for (const id of ids) providers.get(id)?.ensure?.(layerKey);
}

export function retryLinkedSelects(layerKey: string, providerId: string): void {
  providers.get(providerId)?.retry?.(layerKey);
}

/**
 * 可見規則（`visibleParamsSpec` 的 linkedHidden）：選項 ≥2 才顯示；
 * provider 尚未就緒、且同一 provider 沒有任何一列可見時，`primary` 那一列保底顯示（承載載入／錯誤）。
 */
export function linkedSelectHiddenFor(layerKey: string): (spec: LinkedSelectParamSpec) => boolean {
  const specs = linkedSelectSpecs(layerKey);
  const snaps = new Map(specs.map((spec) => [spec.name, linkedSelectSnapshot(layerKey, spec)]));
  return (spec) => {
    const snap = snaps.get(spec.name) ?? linkedSelectSnapshot(layerKey, spec);
    if (snap.options.length > 1) return false;
    if (!spec.primary || snap.status === "ready") return true;
    const siblingsVisible = specs.some((other) => other.provider === spec.provider && (snaps.get(other.name)?.options.length ?? 0) > 1);
    return siblingsVisible;
  };
}

// ══════════════════════════════════════════════════════════════════
//  場景還原
// ══════════════════════════════════════════════════════════════════

function waitUntilSettled(layerKey: string, specs: readonly LinkedSelectParamSpec[], timeoutMs: number): Promise<boolean> {
  const settled = () => specs.every((spec) => {
    const status = linkedSelectSnapshot(layerKey, spec).status;
    return status === "ready" || status === "error";
  });
  if (settled()) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => { if (done) return; done = true; off(); clearTimeout(timer); resolve(ok); };
    const off = subscribeLinkedSelects(layerKey, () => { if (settled()) finish(true); });
    const timer = setTimeout(() => finish(settled()), timeoutMs);
  });
}

/**
 * 依宣告順序還原連動選單：每個 key 先觸發載入、等選項就緒，再逐列驗證（值必須在當下選項內）後設定；
 * 設定後等下游重算完成才處理下一列。不合法或逾時的值保留目前選擇並回報略過訊息。
 */
export async function restoreLinkedSelects(
  linked: Readonly<Record<string, Readonly<Record<string, string>>>>,
  timeoutMs = 20_000,
): Promise<string[]> {
  const skipped: string[] = [];
  for (const [layerKey, values] of Object.entries(linked)) {
    const specs = linkedSelectSpecs(layerKey).filter((spec) => spec.persist !== false);
    if (!specs.length) continue;
    ensureLinkedSelects(layerKey);
    for (const spec of specs) {
      const wanted = values[spec.name];
      if (wanted === undefined) continue;
      if (!(await waitUntilSettled(layerKey, specs, timeoutMs))) {
        skipped.push(`${layerKey}.${spec.name}：選項未能及時載入，保留目前選擇`);
        continue;
      }
      const snap = linkedSelectSnapshot(layerKey, spec);
      if (snap.value === wanted) continue;
      if (!snap.options.some((option) => option.value === wanted && !option.disabled)) {
        skipped.push(`${layerKey}.${spec.name}：選項已不存在，保留目前選擇`);
        continue;
      }
      try {
        await setLinkedSelect(layerKey, spec, wanted);
      } catch {
        skipped.push(`${layerKey}.${spec.name}：無法套用，保留目前選擇`);
      }
    }
  }
  return skipped;
}
