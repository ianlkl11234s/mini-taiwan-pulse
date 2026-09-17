import { beforeEach, describe, expect, it } from "vitest";
import { applyLayerControl, describeLayerControls } from "../layerControls";
import { layerParamsStore } from "../../state/layerParamsStore";

beforeEach(() => layerParamsStore.reset());

describe("research layer controls", () => {
  it("describes stable controls and applies a slider through its existing onChange", () => {
    const details = describeLayerControls("religionTemples", new Set());
    const opacity = details.controls.find(control => control.controlId === "religionTemplesOpacity")!;
    expect(opacity).toMatchObject({ kind: "slider", value: 0.8, slider: { min: 0.1, max: 1, step: 0.05 } });
    expect(applyLayerControl({ layerKey: "religionTemples", controlId: opacity.controlId, expectedValue: opacity.value, value: 0.5 }, new Set())).toBe(0.5);
    expect(layerParamsStore.getParam("religionTemples", opacity.controlId)).toBe(0.5);
  });

  it("keeps multi-select values decoded and rejects stale, disabled, hidden, locked, and invalid writes", () => {
    const details = describeLayerControls("religionTemples", new Set());
    const multi = details.controls.find(control => control.kind === "multiSelect")!;
    const option = multi.options[0]!;
    expect(applyLayerControl({ layerKey: "religionTemples", controlId: multi.controlId, expectedValue: multi.value, value: [option.value] }, new Set())).toEqual([option.value]);
    expect(() => applyLayerControl({ layerKey: "religionTemples", controlId: multi.controlId, expectedValue: [], value: [option.value] }, new Set())).toThrow("LAYER_CONTROL_EXPECTED_VALUE_MISMATCH");
    expect(() => describeLayerControls("religionTemples", new Set(["religionTemples"]))).toThrow("LAYER_DENIED");
    expect(() => applyLayerControl({ layerKey: "religionTemples", controlId: "religionTemplesOpacity", expectedValue: 0.8, value: 0.51 }, new Set())).toThrow("LAYER_CONTROL_VALUE_INVALID");
    const hidden = describeLayerControls("propertyValueGrid", new Set()).controls.find(control => control.hidden)!;
    expect(hidden.showWhen).toEqual({ param: "propertyValueGridExtruded", equals: true });
    expect(() => applyLayerControl({ layerKey: "propertyValueGrid", controlId: hidden.controlId, expectedValue: hidden.value, value: hidden.value }, new Set())).toThrow("LAYER_CONTROL_HIDDEN_OR_UNKNOWN");
  });

  it("exposes disabled options and applies cascade writes through the control callback", () => {
    const property = describeLayerControls("propertyValueGrid", new Set());
    const disabled = property.controls.find(control => control.options.some(option => option.disabled))!;
    const option = disabled.options.find(item => item.disabled)!;
    expect(() => applyLayerControl({ layerKey: "propertyValueGrid", controlId: disabled.controlId, expectedValue: disabled.value, value: option.value }, new Set())).toThrow("LAYER_CONTROL_VALUE_INVALID");
    const penalty = describeLayerControls("pollutionPenaltyCritical", new Set());
    const year = penalty.controls.find(control => control.controlId === "pollutionPenaltyYear")!;
    const playing = penalty.controls.find(control => control.controlId === "pollutionPenaltyPlaying")!;
    applyLayerControl({ layerKey: "pollutionPenaltyCritical", controlId: playing.controlId, expectedValue: playing.value, value: true }, new Set());
    expect(layerParamsStore.getParam("pollutionPenaltyCritical", "pollutionPenaltyYear")).not.toBe(year.value);
  });
});
