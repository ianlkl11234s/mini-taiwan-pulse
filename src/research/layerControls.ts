import { LAYER_MANIFEST } from "../data/layerManifest";
import { getParamsSpec, resolveMultiSelectValues, type LayerParamSpec } from "../data/layerParamsSpec";
import { buildParamControls, visibleControlSpecs, type ParamControl } from "../state/layerParamsControls";
import { ensureLinkedSelects, linkedSelectSnapshot, type LinkedSelectStatus } from "../state/linkedSelect";
import { layerParamsStore } from "../state/layerParamsStore";
import { paletteById } from "../map/palettes";

export type LayerControlValue = number | boolean | string | string[];
export type LayerControlRequest = { layerKey: string; controlId: string; value: LayerControlValue; expectedValue: LayerControlValue };
type ControlDescription = {
  controlId: string; label: string; kind: "slider" | "toggle" | "select" | "multiSelect" | "palette" | "linkedSelect"; value: LayerControlValue;
  slider: { min: number; max: number; step: number } | null;
  options: { label: string; value: string; disabled: boolean }[];
  hidden: boolean; showWhen: { param: string; equals: number | boolean | string } | null;
  sharedGroup: string | null; cascade: readonly unknown[];
  /**
   * 連動選單（C 段）才有：選項的載入狀態與上游列。`options` 是**當下**（上游目前值之下）的可選值；
   * 改了上游，下游選項會重算——要再讀一次。status 不是 "ready" 時 set 會回 LAYER_CONTROL_OPTIONS_NOT_READY。
   */
  linked?: { status: LinkedSelectStatus; dependsOn: readonly string[]; error: string | null };
};

function fail(code: string): never { throw new Error(code); }
function equal(a: LayerControlValue, b: LayerControlValue): boolean {
  return Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((value, index) => value === b[index]) : a === b;
}
function kind(control: ParamControl | undefined, spec: LayerParamSpec): ControlDescription["kind"] {
  return control?.type ?? (spec.kind === "slider" ? "slider" : spec.kind);
}
function describe(layerKey: string, locked: ReadonlySet<string>): { controls: ControlDescription[]; actual: Map<string, ParamControl> } {
  if (!Object.prototype.hasOwnProperty.call(LAYER_MANIFEST, layerKey)) fail("LAYER_UNKNOWN");
  if (locked.has(layerKey)) fail("LAYER_DENIED");
  const spec = getParamsSpec(layerKey);
  if (!spec) return { controls: [], actual: new Map() };
  // 連動選單的選項要等 provider 載入；describe 順手觸發（重複呼叫無副作用）
  if (spec.some(item => item.kind === "linkedSelect")) ensureLinkedSelects(layerKey);
  // buildParamControls intentionally omits names; visibleControlSpecs has identical ordering (incl. linked-select visibility).
  const actual = new Map<string, ParamControl>();
  const visible = visibleControlSpecs(layerKey);
  (buildParamControls(layerKey) ?? []).forEach((control, index) => actual.set(visible[index]!.name, control));
  return {
    actual,
    controls: spec.map(item => {
      const control = actual.get(item.name);
      const controlKind = kind(control, item);
      const rawControl = control as any;
      const linked = item.kind === "linkedSelect" ? linkedSelectSnapshot(layerKey, item) : null;
      const value = control ? control.value : linked ? linked.value : (() => {
        const raw = layerParamsStore.getParam(layerKey, item.name);
        return item.kind === "multiSelect" ? resolveMultiSelectValues(typeof raw === "string" ? raw : item.default, item.options) : raw ?? item.default;
      })();
      return {
        controlId: item.name, label: control?.label ?? ("label" in item ? item.label : item.labelPrefix), kind: controlKind, value,
        slider: controlKind === "slider" ? { min: rawControl?.min ?? (item.kind === "slider" ? item.min : 0), max: rawControl?.max ?? (item.kind === "slider" ? item.max : 0), step: rawControl?.step ?? (item.kind === "slider" ? item.step : 1) } : null,
        options: controlKind === "palette"
          ? (item.kind === "palette" ? item.options : []).map((id) => ({ label: paletteById(id)?.zh ?? id, value: id, disabled: false }))
          : linked ? linked.options.map((option) => ({ label: option.label, value: option.value, disabled: option.disabled === true }))
          : controlKind === "select" || controlKind === "multiSelect" ? ((rawControl?.options ?? ("options" in item ? item.options : [])).map((option: { label: string; value: string; disabled?: boolean }) => ({ ...option, disabled: option.disabled === true }))) : [],
        hidden: !control, showWhen: item.showWhen ?? null, sharedGroup: item.sharedGroup ?? null, cascade: item.cascade ?? [],
        ...(linked && item.kind === "linkedSelect" ? { linked: { status: linked.status, dependsOn: item.dependsOn, error: linked.error ?? null } } : {}),
      };
    }),
  };
}

export function describeLayerControls(layerKey: string, locked: ReadonlySet<string>) {
  const result = describe(layerKey, locked);
  const output = { layerKey, controls: result.controls };
  if (new TextEncoder().encode(JSON.stringify(output)).byteLength > 24 * 1024) fail("LAYER_CONTROLS_RESPONSE_TOO_LARGE");
  return output;
}

function validate(control: ParamControl, value: LayerControlValue): void {
  const raw = control as any;
  if ((control.type ?? "slider") === "slider") {
    if (typeof value !== "number" || !Number.isFinite(value) || value < raw.min || value > raw.max || Math.abs((value - raw.min) / raw.step - Math.round((value - raw.min) / raw.step)) > 1e-9) fail("LAYER_CONTROL_VALUE_INVALID");
  } else if (control.type === "toggle") {
    if (typeof value !== "boolean") fail("LAYER_CONTROL_VALUE_INVALID");
  } else if (control.type === "linkedSelect") {
    if (control.status !== "ready" && control.options.length === 0) fail("LAYER_CONTROL_OPTIONS_NOT_READY");
    if (typeof value !== "string" || !control.options.some(option => option.value === value && !option.disabled)) fail("LAYER_CONTROL_VALUE_INVALID");
  } else if (control.type === "select" || control.type === "palette") {
    if (typeof value !== "string" || !raw.options.some((option: { value: string; disabled?: boolean }) => option.value === value && !option.disabled)) fail("LAYER_CONTROL_VALUE_INVALID");
  } else if (!Array.isArray(value) || value.some(item => typeof item !== "string") || new Set(value).size !== value.length || value.some(item => !raw.options.some((option: { value: string; disabled?: boolean }) => option.value === item && !option.disabled))) fail("LAYER_CONTROL_VALUE_INVALID");
}

function validatedControl(request: LayerControlRequest, locked: ReadonlySet<string>): ParamControl {
  const before = describe(request.layerKey, locked);
  const control = before.actual.get(request.controlId);
  if (!control) fail("LAYER_CONTROL_HIDDEN_OR_UNKNOWN");
  // 連動選單選項還沒載入時，目前值也還不可信 → 先回「未就緒」，Agent 重讀 layer_controls 再試
  if (control.type === "linkedSelect" && control.status !== "ready" && control.options.length === 0) fail("LAYER_CONTROL_OPTIONS_NOT_READY");
  if (!equal(control.value, request.expectedValue)) fail("LAYER_CONTROL_EXPECTED_VALUE_MISMATCH");
  validate(control, request.value);
  return control;
}

export function validateLayerControl(request: LayerControlRequest, locked: ReadonlySet<string>): void {
  void validatedControl(request, locked);
}

/**
 * 套用並讀回。連動選單的 onChange 可能是非同步（統計群組切換要先預載目標期別）→ 回 Promise，
 * 呼叫端 await；provider 拒絕（值已不在選項內、目標沒有同期別）一律回 LAYER_CONTROL_VALUE_INVALID。
 */
export function applyLayerControl(request: LayerControlRequest, locked: ReadonlySet<string>): LayerControlValue | Promise<LayerControlValue> {
  const control = validatedControl(request, locked);
  if (control.type === "linkedSelect") {
    let result: void | Promise<void>;
    try { result = control.onChange(request.value as string); } catch { fail("LAYER_CONTROL_VALUE_INVALID"); }
    return Promise.resolve(result).then(
      () => readBack(request, locked),
      () => fail("LAYER_CONTROL_VALUE_INVALID"),
    );
  }
  (control.onChange as (value: LayerControlValue) => void)(request.value);
  return readBack(request, locked);
}

function readBack(request: LayerControlRequest, locked: ReadonlySet<string>): LayerControlValue {
  const readback = describe(request.layerKey, locked).actual.get(request.controlId);
  if (!readback) fail("LAYER_CONTROL_HIDDEN_AFTER_CHANGE");
  const readbackValue = readback.value;
  const matches = Array.isArray(request.value) && Array.isArray(readbackValue)
    ? request.value.length === readbackValue.length && request.value.every(value => readbackValue.includes(value))
    : equal(readbackValue, request.value);
  if (!matches) fail("LAYER_CONTROL_READBACK_MISMATCH");
  return readbackValue;
}
