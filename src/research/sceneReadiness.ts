import { loadingRegistry } from "../lib/loadingRegistry";

export type ScenePhase = "empty" | "loading" | "ready" | "error";
export interface IdleMap {
  on(type: "idle" | "render" | "error", callback: () => void): unknown;
  off(type: "idle" | "render" | "error", callback: () => void): unknown;
  triggerRepaint(): void;
}
/** Timeout is a failure, never a successful render acknowledgement. */
export function awaitSceneIdle(map: IdleMap, revision: number, report: (phase: ScenePhase) => void, timeoutMs = 10_000, failOnMapError = true): () => void {
  const task = `research:render:${revision}`;
  let finished = false;
  loadingRegistry.start(task, "研究成果呈現中");
  report("loading");
  const finish = (phase?: ScenePhase) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    map.off("idle", ready);
    if (failOnMapError) map.off("error", error);
    loadingRegistry.end(task);
    if (phase) report(phase);
  };
  const ready = () => finish("ready");
  const error = () => finish("error");
  const timer = setTimeout(error, timeoutMs);
  map.on("idle", ready);
  if (failOnMapError) map.on("error", error);
  map.triggerRepaint();
  return () => finish();
}

/** A camera command is ready after browser readback and one rendered frame. */
export function waitForSceneRender(map: IdleMap, revision: number, timeoutMs = 5_000): { promise: Promise<"ready" | "error">; cancel: () => void } {
  const task = `research:command-render:${revision}`;
  let settled = false;
  let finish!: (phase: "ready" | "error") => void;
  loadingRegistry.start(task, "研究鏡位呈現中");
  const promise = new Promise<"ready" | "error">(resolve => {
    finish = phase => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      map.off("render", rendered);
      loadingRegistry.end(task);
      resolve(phase);
    };
  });
  const rendered = () => finish("ready");
  const timer = setTimeout(() => finish("error"), timeoutMs);
  map.on("render", rendered);
  map.triggerRepaint();
  return {
    promise,
    cancel: () => finish("error"),
  };
}
