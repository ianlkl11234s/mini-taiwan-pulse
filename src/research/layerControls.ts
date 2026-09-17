import { LAYER_MANIFEST } from "../data/layerManifest";
import { getParamsSpec, resolveMultiSelectValues, visibleParamsSpec, type LayerParamSpec } from "../data/layerParamsSpec";
import { buildParamControls, type ParamControl } from "../state/layerParamsControls";
import { layerParamsStore } from "../state/layerParamsStore";

export type LayerControlValue = number | boolean | string | string[];
export type LayerControlRequest = { layerKey: string; controlId: string; value: LayerControlValue; expectedValue: LayerControlValue };
type ControlDescription = {
  controlId: string; label: string; kind: "slider" | "toggle" | "select" | "multiSelect"; value: LayerControlValue;
  slider: { min: number; max: number; step: number } | null;
  options: { label: string; value: string; disabled: boolean }[];
  hidden: boolean; showWhen: { param: string; equals: number | boolean | string } | null;
  sharedGroup: string | null; cascade: readonly unknown[];
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
  // buildParamControls intentionally omits names; visibleParamsSpec has identical ordering.
  const actual = new Map<string, ParamControl>();
  const visible = visibleParamsSpec(spec, layerParamsStore.getParams(layerKey));
  (buildParamControls(layerKey) ?? []).forEach((control, index) => actual.set(visible[index]!.name, control));
  return {
    actual,
    controls: spec.map(item => {
      const control = actual.get(item.name);
      const controlKind = kind(control, item);
      const rawControl = control as any;
      const value = control ? control.value : (() => {
        const raw = layerParamsStore.getParam(layerKey, item.name);
        return item.kind === "multiSelect" ? resolveMultiSelectValues(typeof raw === "string" ? raw : item.default, item.options) : raw ?? item.default;
      })();
      return {
        controlId: item.name, label: control?.label ?? ("label" in item ? item.label : item.labelPrefix), kind: controlKind, value,
        slider: controlKind === "slider" ? { min: rawControl?.min ?? (item.kind === "slider" ? item.min : 0), max: rawControl?.max ?? (item.kind === "slider" ? item.max : 0), step: rawControl?.step ?? (item.kind === "slider" ? item.step : 1) } : null,
        options: controlKind === "select" || controlKind === "multiSelect" ? ((rawControl?.options ?? ("options" in item ? item.options : [])).map((option: { label: string; value: string; disabled?: boolean }) => ({ ...option, disabled: option.disabled === true }))) : [],
        hidden: !control, showWhen: item.showWhen ?? null, sharedGroup: item.sharedGroup ?? null, cascade: item.cascade ?? [],
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
  } else if (control.type === "select") {
    if (typeof value !== "string" || !raw.options.some((option: { value: string; disabled?: boolean }) => option.value === value && !option.disabled)) fail("LAYER_CONTROL_VALUE_INVALID");
  } else if (!Array.isArray(value) || value.some(item => typeof item !== "string") || new Set(value).size !== value.length || value.some(item => !raw.options.some((option: { value: string; disabled?: boolean }) => option.value === item && !option.disabled))) fail("LAYER_CONTROL_VALUE_INVALID");
}

function validatedControl(request: LayerControlRequest, locked: ReadonlySet<string>): ParamControl {
  const before = describe(request.layerKey, locked);
  const control = before.actual.get(request.controlId);
  if (!control) fail("LAYER_CONTROL_HIDDEN_OR_UNKNOWN");
  if (!equal(control.value, request.expectedValue)) fail("LAYER_CONTROL_EXPECTED_VALUE_MISMATCH");
  validate(control, request.value);
  return control;
}

export function validateLayerControl(request: LayerControlRequest, locked: ReadonlySet<string>): void {
  void validatedControl(request, locked);
}

export function applyLayerControl(request: LayerControlRequest, locked: ReadonlySet<string>): LayerControlValue {
  const control = validatedControl(request, locked);
  (control.onChange as (value: LayerControlValue) => void)(request.value);
  const readback = describe(request.layerKey, locked).actual.get(request.controlId);
  if (!readback) fail("LAYER_CONTROL_HIDDEN_AFTER_CHANGE");
  const readbackValue = readback.value;
  const matches = Array.isArray(request.value) && Array.isArray(readbackValue)
    ? request.value.length === readbackValue.length && request.value.every(value => readbackValue.includes(value))
    : equal(readbackValue, request.value);
  if (!matches) fail("LAYER_CONTROL_READBACK_MISMATCH");
  return readbackValue;
}
