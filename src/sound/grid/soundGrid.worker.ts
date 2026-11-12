/// <reference lib="webworker" />
/**
 * 聲景網格 Web Worker（W6-4）：七族網格與綜合網格都在這裡算，主執行緒只送資料、收幀、上傳貼圖。
 * 排程與計算見 gridWorkerHost／gridComputeCore（與同執行緒後備共用，不另寫一套 kernel）。
 */
import { createGridHost } from "./gridWorkerHost";
import type { ToWorker } from "./gridWire";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const host = createGridHost((msg, transfer) => scope.postMessage(msg, transfer));
scope.onmessage = (e: MessageEvent<ToWorker>) => host.onMessage(e.data);
