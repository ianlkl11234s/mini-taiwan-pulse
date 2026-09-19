import { loadingRegistry } from "../lib/loadingRegistry";

export type ScenePhase = "empty" | "loading" | "ready" | "error";
export interface IdleMap {
  on(type: "idle" | "error", callback: () => void): unknown;
  off(type: "idle" | "error", callback: () => void): unknown;
  triggerRepaint(): void;
}
/** Timeout is a failure, never a successful render acknowledgement. */
export function awaitSceneIdle(map: IdleMap, revision: number, report: (phase: ScenePhase) => void, timeoutMs = 10_000): () => void {
  const task = `research:render:${revision}`;
  let finished = false;
  loadingRegistry.start(task, "研究成果呈現中");
  report("loading");
  const finish = (phase?: ScenePhase) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    map.off("idle", ready);
    map.off("error", error);
    loadingRegistry.end(task);
    if (phase) report(phase);
  };
  const ready = () => finish("ready");
  const error = () => finish("error");
  const timer = setTimeout(error, timeoutMs);
  map.on("idle", ready);
  map.on("error", error);
  map.triggerRepaint();
  return () => finish();
}
