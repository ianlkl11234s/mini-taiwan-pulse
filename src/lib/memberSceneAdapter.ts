import { LAYER_PARAMS_SPEC, MULTI_SELECT_ALL, MULTI_SELECT_NONE, type LayerParamSpec, type ParamValue } from "../data/layerParamsSpec";
import type { MemberSceneSnapshot } from "./memberSchema";

const specsFor = (key: string): readonly LayerParamSpec[] => (LAYER_PARAMS_SPEC as Record<string, LayerParamSpec[]>)[key] ?? [];
type SelectParamSpec = Extract<LayerParamSpec, { kind: "select" }>;

function optionsFor(spec: SelectParamSpec, siblings: Record<string, unknown>) {
  const dynamic = spec.optionsByParam;
  return dynamic ? dynamic.byValue[String(siblings[dynamic.param])] ?? dynamic.byValue[dynamic.fallback] ?? spec.options : spec.options;
}

function validParam(spec: LayerParamSpec, value: unknown, siblings: Record<string, unknown>): value is ParamValue {
  if (spec.kind === "slider") return typeof value === "number" && Number.isFinite(value) && value >= spec.min && value <= spec.max;
  if (spec.kind === "toggle") return typeof value === "boolean";
  if (typeof value !== "string") return false;
  if (spec.kind === "multiSelect") {
    if (value === MULTI_SELECT_ALL || value === MULTI_SELECT_NONE) return true;
    try {
      const values: unknown = JSON.parse(value);
      return Array.isArray(values) && values.every((v) => typeof v === "string" && spec.options.some((o) => o.value === v));
    } catch { return false; }
  }
  if (spec.kind !== "select") return false;
  return optionsFor(spec, siblings).some((option) => option.value === value && !option.disabled);
}

function compatibleDefault(spec: LayerParamSpec, siblings: Record<string, unknown>): ParamValue {
  if (spec.kind !== "select" || !spec.optionsByParam) return spec.default;
  return optionsFor(spec, siblings).find((option) => !option.disabled)?.value ?? spec.default;
}

/** Persist only declared scalar controls; replay/animation switches restart paused. */
export function captureSceneParams(keys: readonly string[], all: Readonly<Record<string, Readonly<Record<string, unknown>>>>) {
  const params: Record<string, Record<string, ParamValue>> = {};
  for (const key of keys) {
    const current = all[key] ?? {};
    const out: Record<string, ParamValue> = {};
    for (const spec of specsFor(key)) {
      const value = /playing|autoplay/i.test(spec.name) ? spec.default : current[spec.name];
      if (validParam(spec, value, current)) out[spec.name] = value;
    }
    if (Object.keys(out).length) params[key] = out;
  }
  return params;
}

/** Resolve before applying anything: old keys and unauthorized controls are never restored. */
export function resolveSceneRestore(scene: MemberSceneSnapshot, knownKeys: ReadonlySet<string>, lockedKeys: ReadonlySet<string>, basemaps: readonly string[]) {
  const skipped: string[] = [];
  const layers = scene.layers.filter((key) => {
    if (!knownKeys.has(key)) { skipped.push(`${key}：已下架`); return false; }
    if (lockedKeys.has(key)) { skipped.push(`${key}：目前未授權`); return false; }
    return true;
  });
  const params: Record<string, Record<string, ParamValue>> = {};
  for (const key of layers) {
    const stored = scene.params[key] ?? {};
    const out: Record<string, ParamValue> = {};
    const specs = specsFor(key);
    // Resolve in declaration order. A dependent select only sees an already validated
    // parent value, never a stale or malformed value from the saved snapshot.
    const siblings: Record<string, ParamValue> = {};
    for (const spec of specs) {
      const supplied = stored[spec.name];
      const fallback = compatibleDefault(spec, siblings);
      const value = /playing|autoplay/i.test(spec.name) ? fallback : supplied;
      if (value !== undefined && validParam(spec, value, siblings)) out[spec.name] = value;
      else {
        out[spec.name] = fallback;
        if (supplied !== undefined) skipped.push(`${key}.${spec.name}：參數已不相容，使用預設`);
      }
      siblings[spec.name] = out[spec.name]!;
    }
    for (const name of Object.keys(stored)) if (!specs.some((s) => s.name === name)) skipped.push(`${key}.${name}：參數已移除`);
    params[key] = out;
  }
  const basemap = basemaps.includes(scene.basemap) ? scene.basemap : "dark";
  if (basemap !== scene.basemap) skipped.push(`${scene.basemap}：底圖已移除，使用 Dark`);
  return { layers, params, basemap, skipped };
}
