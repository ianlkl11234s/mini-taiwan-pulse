import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { layerParamsStore } from "../../state/layerParamsStore";
import {
  MapController,
  MapControllerError,
  type MapCameraAdapter,
  type MapCameraSnapshot,
  type MapTimelineAdapter,
  type MapTimelineSnapshot,
  type MapVisibilityAdapter,
} from "../mapController";
import type { Camera, MapScene } from "../protocol";

const WINDOW_START = Date.parse("2026-01-01T00:00:00Z") / 1_000;
const WINDOW_END = Date.parse("2026-01-31T23:59:59Z") / 1_000;

class FakeCamera implements MapCameraAdapter {
  state: MapCameraSnapshot = {
    center: [120.9, 23.7],
    zoom: 7,
    pitch: 10,
    bearing: 0,
    bounds: [119.5, 21.8, 122.1, 25.4],
  };
  private readonly listeners = new Set<() => void>();

  getCamera(): MapCameraSnapshot {
    return {
      ...this.state,
      center: [...this.state.center],
      bounds: [...this.state.bounds],
    };
  }

  setCamera(camera: Camera): void {
    this.state = {
      center: camera.center ?? this.state.center,
      zoom: camera.zoom ?? this.state.zoom,
      pitch: camera.pitch ?? this.state.pitch,
      bearing: camera.bearing ?? this.state.bearing,
      bounds: camera.bounds ?? this.state.bounds,
    };
    this.emit();
  }

  subscribeMoveEnd(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  externalMove(center: [number, number]): void {
    this.state = { ...this.state, center };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

class FakeVisibility implements MapVisibilityAdapter {
  state: Record<string, boolean> = {
    cemeteryOsm: false,
    religionTemples: true,
    indicators: true,
    propertyValueGrid: false,
    privateOverlay: false,
  };
  private readonly listeners = new Set<() => void>();
  private readonly locked = new Set(["religionTemples", "privateOverlay"]);

  getAll(): Readonly<Record<string, boolean>> {
    return { ...this.state };
  }

  setBulk(values: Readonly<Record<string, boolean>>): void {
    this.state = { ...this.state, ...values };
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  permissionFor(layerId: string): { allowed: boolean; reason?: string } {
    return this.locked.has(layerId)
      ? { allowed: false, reason: "layer is controlled by the host" }
      : { allowed: true };
  }

  externalSet(layerId: string, visible: boolean): void {
    this.state = { ...this.state, [layerId]: visible };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

class FakeTimeline implements MapTimelineAdapter {
  state: MapTimelineSnapshot = {
    at: Date.parse("2026-01-10T00:00:00Z") / 1_000,
    playing: false,
    speed: 1,
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
  };

  getState(): MapTimelineSnapshot {
    return { ...this.state };
  }

  setState(next: Partial<Pick<MapTimelineSnapshot, "at" | "playing" | "speed">>): void {
    this.state = { ...this.state, ...next };
  }
}

interface Harness {
  controller: MapController;
  camera: FakeCamera;
  visibility: FakeVisibility;
  timeline: FakeTimeline;
}

const activeControllers: MapController[] = [];

function createHarness(): Harness {
  const camera = new FakeCamera();
  const visibility = new FakeVisibility();
  const timeline = new FakeTimeline();
  const controller = new MapController({
    camera,
    visibility,
    params: layerParamsStore,
    timeline,
  });
  activeControllers.push(controller);
  return { controller, camera, visibility, timeline };
}

beforeEach(() => layerParamsStore.reset());
afterEach(() => {
  for (const controller of activeControllers.splice(0)) controller.dispose();
});

describe("MapController", () => {
  it("getMapState 只回傳 visible layers、已登記 params、camera bounds 與 timeline", () => {
    const { controller } = createHarness();

    const state = controller.getMapState();

    expect(state.revision).toBe(0);
    expect(state.camera).toEqual({
      center: [120.9, 23.7],
      zoom: 7,
      pitch: 10,
      bearing: 0,
      bounds: [119.5, 21.8, 122.1, 25.4],
    });
    expect(state.layers.map(({ id }) => id)).toEqual(["religionTemples", "indicators"]);
    expect(state.layers[0]?.params?.religionTemplesOpacity).toBe(0.8);
    expect(state.time).toEqual({
      at: "2026-01-10T00:00:00.000Z",
      playing: false,
      speed: 1,
    });
  });

  it("scene 的 camera、visibility、params、time 原子套用且只 bump 一次", () => {
    const { controller } = createHarness();
    const scene: MapScene = {
      camera: { center: [121.2, 24.1], zoom: 9, pitch: 20, bearing: 5 },
      layers: [{
        id: "cemeteryOsm",
        visible: true,
        params: { cemeteryOsmOpacity: 0.9 },
      }],
      time: { at: "2026-01-20T00:00:00Z", playing: true, speed: 2 },
    };

    const result = controller.applyScene({ commandId: "command-1", scene, expectedRevision: 0 });

    expect(result.commandId).toBe("command-1");
    expect(result.success).toBe(true);
    expect([result.previousRevision, result.newRevision]).toEqual([0, 1]);
    expect(result.applied).toEqual([
      "camera",
      "layers.cemeteryOsm.visible",
      "layers.cemeteryOsm.params.cemeteryOsmOpacity",
      "time.at",
      "time.playing",
      "time.speed",
    ]);
    expect(result.actualState.camera).toMatchObject({
      center: [121.2, 24.1], zoom: 9, pitch: 20, bearing: 5,
    });
    expect(result.actualState.layers.find(({ id }) => id === "cemeteryOsm")?.params)
      .toMatchObject({ cemeteryOsmOpacity: 0.9 });
    expect(result.actualState.time).toMatchObject({ playing: true, speed: 2 });

    const repeated = controller.applyScene({ commandId: "command-2", scene, expectedRevision: 1 });
    expect([repeated.previousRevision, repeated.newRevision]).toEqual([1, 1]);
    expect(repeated.applied).toEqual([]);
  });

  it("denied 目標不進 plan，duplicate layer 只接受第一筆", () => {
    const { controller } = createHarness();
    const result = controller.applyScene({ commandId: "command-denied", scene: {
      layers: [
        {
          id: "religionTemples",
          visible: true,
          params: { religionTemplesOpacity: 0.2 },
        },
        {
          id: "cemeteryOsm",
          visible: true,
          opacity: 0.5,
          params: { cemeteryOsmOpacity: 5, notAParam: 1 },
        },
        { id: "cemeteryOsm", visible: false },
        {
          id: "indicators",
          visible: true,
          params: { indCategory: "invalid", indMetric: "m" },
        },
      ],
      time: {
        at: "2025-12-01T00:00:00Z",
        from: "2026-01-01T00:00:00Z",
        to: "2026-01-02T00:00:00Z",
      },
      selection: { layerId: "indicators", featureIds: ["1"] },
      resultOverlay: { analysisId: "a", stylePreset: "heat" },
      narration: "metadata",
      citations: [{ datasetId: "dataset-1" }],
    } });

    expect(result.success).toBe(false);
    expect(result.denied.map(({ target }) => target)).toEqual(expect.arrayContaining([
      "layers.religionTemples.params.religionTemplesOpacity",
      "layers.cemeteryOsm.opacity",
      "layers.cemeteryOsm.params.cemeteryOsmOpacity",
      "layers.cemeteryOsm.params.notAParam",
      "layers.cemeteryOsm",
      "layers.indicators.params.indCategory",
      "time.at",
      "time.from",
      "time.to",
      "selection",
      "resultOverlay",
    ]));
    expect(result.warnings).toHaveLength(2);
    expect(result.actualState.layers.some(({ id }) => id === "cemeteryOsm")).toBe(true);
    expect(layerParamsStore.getParam("cemeteryOsm", "cemeteryOsmOpacity")).toBe(0.45);
    // invalid companion 不會汙染 dynamic options；m 仍依 current category=count 通過。
    expect(layerParamsStore.getParam("indicators", "indMetric")).toBe("m");
  });

  it("bulk params 保留既有 cascade，顯式 target 值優先", () => {
    const { controller } = createHarness();

    controller.applyScene({
      commandId: "cascade-1",
      scene: {
        layers: [{ id: "indicators", visible: true, params: { indCategory: "burden" } }],
      },
    });
    expect(layerParamsStore.getParam("indicators", "indMetric")).toBe("dr");

    controller.applyScene({
      commandId: "cascade-2",
      scene: {
        layers: [{
          id: "indicators",
          visible: true,
          // 故意將 dependent param 放前面，驗證 planning 不依賴 JSON property order。
          params: { indMetric: "pph", indCategory: "struct" },
        }],
      },
    });
    expect(layerParamsStore.getParam("indicators", "indMetric")).toBe("pph");
  });

  it("expectedRevision 不合時拋出 typed REVISION_CONFLICT", () => {
    const { controller, visibility } = createHarness();
    visibility.externalSet("cemeteryOsm", true);

    try {
      controller.applyScene({
        commandId: "stale",
        scene: { layers: [] },
        expectedRevision: 0,
      });
      throw new Error("expected revision conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(MapControllerError);
      expect((error as MapControllerError).code).toBe("REVISION_CONFLICT");
    }
    expect(controller.getMapState().revision).toBe(1);
  });

  it("external visibility、params、map moveend 各自 bump revision", () => {
    const { controller, camera, visibility } = createHarness();

    visibility.externalSet("cemeteryOsm", true);
    layerParamsStore.setParam("cemeteryOsm", "cemeteryOsmOpacity", 0.9);
    camera.externalMove([121.5, 24.5]);

    expect(controller.getMapState().revision).toBe(3);
  });
});
