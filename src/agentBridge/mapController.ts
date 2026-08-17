import {
  getParamsSpec,
  resolveParamValues,
  resolveSelectOptions,
  type LayerParamSpec,
  type ParamValue,
} from "../data/layerParamsSpec";
import type {
  LayerParamWrite,
  LayerParamsStore,
} from "../state/layerParamsStore";
import type {
  Camera,
  MapCommandResult,
  MapScene,
  MapStateSummary,
} from "./protocol";

type Bounds = [number, number, number, number];
type Coordinate = [number, number];

export interface MapCameraSnapshot {
  center: Coordinate;
  zoom: number;
  pitch: number;
  bearing: number;
  bounds: Bounds;
}

/** Mapbox 的最小注入面；setCamera 必須用非動畫操作，讓 moveend 在呼叫內完成。 */
export interface MapCameraAdapter {
  getCamera(): MapCameraSnapshot;
  setCamera(camera: Camera): void;
  subscribeMoveEnd(listener: () => void): () => void;
}

export interface LayerPermission {
  allowed: boolean;
  reason?: string;
}

export interface MapVisibilityAdapter {
  getAll(): Readonly<object>;
  setBulk(values: Readonly<Record<string, boolean>>): void;
  subscribe(listener: () => void): () => void;
  permissionFor(layerId: string, visible: boolean): LayerPermission;
}

export interface MapTimelineSnapshot {
  /** Unix seconds. */
  at: number;
  playing: boolean;
  speed: number;
  windowStart: number;
  windowEnd: number;
}

export interface MapTimelineAdapter {
  getState(): MapTimelineSnapshot;
  setState(next: Partial<Pick<MapTimelineSnapshot, "at" | "playing" | "speed">>): void;
}

export interface MapControllerDependencies {
  camera: MapCameraAdapter;
  visibility: MapVisibilityAdapter;
  params: Pick<
    LayerParamsStore,
    "getParams" | "setParamsBulk" | "subscribe"
  >;
  timeline: MapTimelineAdapter;
}

export interface ApplySceneRequest {
  commandId: string;
  scene: MapScene;
  expectedRevision?: number;
}

export interface BrowserMapController {
  getMapState(): MapStateSummary;
  applyScene(request: ApplySceneRequest): MapCommandResult;
}

export type MapControllerErrorCode = "REVISION_CONFLICT";

export class MapControllerError extends Error {
  constructor(
    readonly code: MapControllerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MapControllerError";
  }
}

interface ScenePlan {
  camera?: Camera;
  visibility: Record<string, boolean>;
  params: LayerParamWrite[];
  timeline: Partial<Pick<MapTimelineSnapshot, "at" | "playing" | "speed">>;
  applied: string[];
  denied: MapCommandResult["denied"];
  warnings: string[];
}

function sameArray(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameCameraValue(current: MapCameraSnapshot, requested: Camera): boolean {
  if (requested.bounds !== undefined && !sameArray(current.bounds, requested.bounds)) return false;
  if (requested.center !== undefined && !sameArray(current.center, requested.center)) return false;
  if (requested.zoom !== undefined && current.zoom !== requested.zoom) return false;
  if (requested.pitch !== undefined && current.pitch !== requested.pitch) return false;
  if (requested.bearing !== undefined && current.bearing !== requested.bearing) return false;
  return true;
}

function paramError(
  spec: LayerParamSpec,
  value: ParamValue,
  allSpecs: readonly LayerParamSpec[],
  plannedValues: Readonly<Record<string, ParamValue>>,
): string | null {
  if (spec.kind === "slider") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "must be a finite number";
    }
    if (value < spec.min || value > spec.max) {
      return `must be between ${spec.min} and ${spec.max}`;
    }
    return null;
  }

  if (spec.kind === "toggle") {
    return typeof value === "boolean" ? null : "must be a boolean";
  }

  if (typeof value !== "string") return "must be a string option value";
  const resolved = resolveParamValues(allSpecs, plannedValues);
  const option = resolveSelectOptions(spec, resolved).find(
    (candidate) => candidate.value === value,
  );
  if (option === undefined) return `is not an allowed option: ${value}`;
  if (option.disabled) return `option is disabled: ${value}`;
  return null;
}

function finiteIsoSeconds(value: string): number | null {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds / 1_000 : null;
}

export class MapController implements BrowserMapController {
  private revision = 0;
  private trackingSuppressed = 0;
  private readonly unsubscribe: Array<() => void>;

  constructor(private readonly deps: MapControllerDependencies) {
    const onExternalChange = (): void => {
      if (this.trackingSuppressed === 0) this.revision += 1;
    };
    this.unsubscribe = [
      deps.visibility.subscribe(onExternalChange),
      deps.params.subscribe(onExternalChange),
      deps.camera.subscribeMoveEnd(onExternalChange),
    ];
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe.splice(0)) unsubscribe();
  }

  getMapState(): MapStateSummary {
    const camera = this.deps.camera.getCamera();
    const timeline = this.deps.timeline.getState();
    const layers = Object.entries(this.deps.visibility.getAll())
      .filter(([, visible]) => visible)
      .map(([id]) => {
        const paramsSpec = getParamsSpec(id);
        return {
          id,
          visible: true,
          ...(paramsSpec === null
            ? {}
            : { params: { ...this.deps.params.getParams(id) } }),
        };
      });

    return {
      revision: this.revision,
      camera: {
        center: [...camera.center],
        zoom: camera.zoom,
        pitch: camera.pitch,
        bearing: camera.bearing,
        bounds: [...camera.bounds],
      },
      layers,
      time: {
        at: new Date(timeline.at * 1_000).toISOString(),
        playing: timeline.playing,
        speed: timeline.speed,
      },
    };
  }

  applyScene(request: ApplySceneRequest): MapCommandResult {
    if (
      request.expectedRevision !== undefined
      && request.expectedRevision !== this.revision
    ) {
      throw new MapControllerError(
        "REVISION_CONFLICT",
        `expectedRevision ${request.expectedRevision} does not match current revision ${this.revision}`,
      );
    }

    const previousRevision = this.revision;
    const plan = this.planScene(request.scene);
    const changed =
      plan.camera !== undefined
      || Object.keys(plan.visibility).length > 0
      || plan.params.length > 0
      || Object.keys(plan.timeline).length > 0;

    if (changed) this.commit(plan);

    return {
      commandId: request.commandId,
      success: plan.denied.length === 0,
      previousRevision,
      newRevision: this.revision,
      applied: plan.applied,
      denied: plan.denied,
      warnings: plan.warnings,
      actualState: this.getMapState(),
    };
  }

  private planScene(scene: MapScene): ScenePlan {
    const currentVisibility = this.deps.visibility.getAll() as Readonly<Record<string, boolean>>;
    const currentCamera = this.deps.camera.getCamera();
    const currentTimeline = this.deps.timeline.getState();
    const plan: ScenePlan = {
      visibility: {},
      params: [],
      timeline: {},
      applied: [],
      denied: [],
      warnings: [],
    };
    const seenLayerIds = new Set<string>();

    if (scene.camera !== undefined) {
      const requested = { ...scene.camera };
      if (requested.bounds !== undefined) {
        if (requested.center !== undefined) {
          plan.denied.push({
            target: "camera.center",
            reason: "center cannot be combined with bounds",
          });
          delete requested.center;
        }
        if (requested.zoom !== undefined) {
          plan.denied.push({
            target: "camera.zoom",
            reason: "zoom cannot be combined with bounds",
          });
          delete requested.zoom;
        }
      } else if (requested.padding !== undefined) {
        plan.denied.push({
          target: "camera.padding",
          reason: "padding is only supported with bounds",
        });
        delete requested.padding;
      }
      if (Object.keys(requested).length > 0 && !sameCameraValue(currentCamera, requested)) {
        plan.camera = requested;
        plan.applied.push("camera");
      }
    }

    for (const layer of scene.layers) {
      if (seenLayerIds.has(layer.id)) {
        plan.denied.push({
          target: `layers.${layer.id}`,
          reason: "duplicate layer id; only the first occurrence is considered",
        });
        continue;
      }
      seenLayerIds.add(layer.id);

      if (!(layer.id in currentVisibility)) {
        plan.denied.push({
          target: `layers.${layer.id}`,
          reason: "unknown layer id",
        });
        continue;
      }

      if (layer.opacity !== undefined) {
        plan.denied.push({
          target: `layers.${layer.id}.opacity`,
          reason: "generic opacity is not supported; use a registered layer param",
        });
      }

      if (currentVisibility[layer.id] !== layer.visible) {
        const permission = this.deps.visibility.permissionFor(layer.id, layer.visible);
        if (permission.allowed) {
          plan.visibility[layer.id] = layer.visible;
          plan.applied.push(`layers.${layer.id}.visible`);
        } else {
          plan.denied.push({
            target: `layers.${layer.id}.visible`,
            reason: permission.reason ?? "layer visibility change is not permitted",
          });
        }
      }

      if (layer.params === undefined) continue;
      const specs = getParamsSpec(layer.id);
      if (specs === null) {
        for (const name of Object.keys(layer.params)) {
          plan.denied.push({
            target: `layers.${layer.id}.params.${name}`,
            reason: "layer has no registered params",
          });
        }
        continue;
      }

      const paramsPermission = this.deps.visibility.permissionFor(layer.id, true);
      if (!paramsPermission.allowed) {
        for (const name of Object.keys(layer.params)) {
          plan.denied.push({
            target: `layers.${layer.id}.params.${name}`,
            reason: paramsPermission.reason ?? "layer params change is not permitted",
          });
        }
        continue;
      }

      const currentParams = this.deps.params.getParams(layer.id);
      const plannedValues: Record<string, ParamValue> = { ...currentParams };
      const byName = new Map(specs.map((spec) => [spec.name, spec]));
      const paramEntries = Object.entries(layer.params).sort(([left], [right]) => {
        const dependencyRank = (name: string): number => {
          const spec = byName.get(name);
          return spec?.kind === "select"
            && (spec.optionsByParam !== undefined || spec.disableRule !== undefined)
            ? 1
            : 0;
        };
        return dependencyRank(left) - dependencyRank(right);
      });
      for (const [name, value] of paramEntries) {
        const spec = byName.get(name);
        if (spec === undefined) {
          plan.denied.push({
            target: `layers.${layer.id}.params.${name}`,
            reason: "unknown registered param",
          });
          continue;
        }
        const reason = paramError(spec, value, specs, plannedValues);
        if (reason !== null) {
          plan.denied.push({
            target: `layers.${layer.id}.params.${name}`,
            reason,
          });
          continue;
        }
        plannedValues[name] = value;
        if (currentParams[name] !== value) {
          plan.params.push({ key: layer.id, name, value });
          plan.applied.push(`layers.${layer.id}.params.${name}`);
        }
      }
    }

    if (scene.time !== undefined) {
      if (scene.time.from !== undefined) {
        plan.denied.push({
          target: "time.from",
          reason: "time ranges are not supported; use time.at",
        });
      }
      if (scene.time.to !== undefined) {
        plan.denied.push({
          target: "time.to",
          reason: "time ranges are not supported; use time.at",
        });
      }
      if (scene.time.at !== undefined) {
        const at = finiteIsoSeconds(scene.time.at);
        if (at === null || at < currentTimeline.windowStart || at > currentTimeline.windowEnd) {
          plan.denied.push({
            target: "time.at",
            reason: "time.at must fall inside the current timeline window",
          });
        } else if (at !== currentTimeline.at) {
          plan.timeline.at = at;
          plan.applied.push("time.at");
        }
      }
      if (
        scene.time.playing !== undefined
        && scene.time.playing !== currentTimeline.playing
      ) {
        plan.timeline.playing = scene.time.playing;
        plan.applied.push("time.playing");
      }
      if (scene.time.speed !== undefined && scene.time.speed !== currentTimeline.speed) {
        plan.timeline.speed = scene.time.speed;
        plan.applied.push("time.speed");
      }
    }

    if (scene.selection !== undefined) {
      plan.denied.push({
        target: "selection",
        reason: "selection is not supported by the current map controller",
      });
    }
    if (scene.resultOverlay !== undefined) {
      plan.denied.push({
        target: "resultOverlay",
        reason: "result overlays are not supported by the current map controller",
      });
    }
    if (scene.narration !== undefined) {
      plan.warnings.push("narration is metadata only and was not rendered");
    }
    if (scene.citations !== undefined) {
      plan.warnings.push("citations are metadata only and were not rendered");
    }

    return plan;
  }

  private commit(plan: ScenePlan): void {
    const previousCamera = this.deps.camera.getCamera();
    const previousTimeline = this.deps.timeline.getState();
    const previousVisibility = this.deps.visibility.getAll() as Readonly<Record<string, boolean>>;
    const previousParams = plan.params.map(({ key, name }) => ({
      key,
      name,
      value: this.deps.params.getParams(key)[name],
    })).filter(
      (write): write is LayerParamWrite => write.value !== undefined,
    );

    this.trackingSuppressed += 1;
    try {
      if (Object.keys(plan.visibility).length > 0) {
        this.deps.visibility.setBulk(plan.visibility);
      }
      if (plan.params.length > 0) this.deps.params.setParamsBulk(plan.params);
      if (Object.keys(plan.timeline).length > 0) this.deps.timeline.setState(plan.timeline);
      if (plan.camera !== undefined) this.deps.camera.setCamera(plan.camera);
      this.revision += 1;
    } catch (error) {
      try {
        if (plan.camera !== undefined) {
          this.deps.camera.setCamera({
            center: previousCamera.center,
            zoom: previousCamera.zoom,
            pitch: previousCamera.pitch,
            bearing: previousCamera.bearing,
          });
        }
        if (Object.keys(plan.timeline).length > 0) {
          this.deps.timeline.setState({
            at: previousTimeline.at,
            playing: previousTimeline.playing,
            speed: previousTimeline.speed,
          });
        }
        if (previousParams.length > 0) this.deps.params.setParamsBulk(previousParams);
        if (Object.keys(plan.visibility).length > 0) {
          this.deps.visibility.setBulk(
            Object.fromEntries(
              Object.keys(plan.visibility).map((key) => [key, previousVisibility[key] ?? false]),
            ),
          );
        }
      } catch {
        // 保留最初的 commit error；adapter 應維持同步、可回滾的窄契約。
      }
      throw error;
    } finally {
      this.trackingSuppressed -= 1;
    }
  }
}
