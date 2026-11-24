import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { BridgeClient } from "./bridgeClient";
import { compareContext, isRightScene, planRightScene, type RightMapReading } from "./compareBridge";

const reading: RightMapReading = {
  camera: { center: [-0.12, 51.5], zoom: 9.4 },
  bounds: [-0.6, 51.2, 0.4, 51.8],
  visibleLayerKeys: ["gbRailStations"],
  visibleSummary: { basis: "rendered_viewport", note: "", truncated: false, layers: [] },
  resultPresentation: { mode: "none", ready: true },
};
const collection = { items: [{ resultId: "wh-3", visible: true, groupId: null }], groups: [] };
const framing = { bounds: [-1, 51, 0, 52] as [number, number, number, number], padding: 20, maxZoom: 15 };

describe("map_context.compare (G2-3)", () => {
  it("reports mode off / slider without a right block, so old fields stay the left map", () => {
    expect(compareContext({ enabled: false, mode: "countries", rightCountry: "GB", scaleLocked: true }, null)).toEqual({ mode: "off" });
    expect(compareContext({ enabled: true, mode: "slider", rightCountry: null, scaleLocked: true }, reading)).toEqual({ mode: "slider" });
  });

  it("adds the right map's country, camera, bounds and summary while side by side", () => {
    expect(compareContext({ enabled: true, mode: "countries", rightCountry: "GB", scaleLocked: false }, reading)).toEqual({
      mode: "countries", scaleLocked: false,
      right: { country: "GB", ...reading },
    });
  });

  it("says map_not_ready instead of inventing a right map (still loading, or mobile A/B)", () => {
    expect(compareContext({ enabled: true, mode: "countries", rightCountry: "JP", scaleLocked: true }, null)).toEqual({
      mode: "countries", scaleLocked: true, right: { country: "JP", status: "map_not_ready" },
    });
  });
});

describe("right sub-scene routing (G2-3)", () => {
  it("does nothing when the command has no right key (old agents, left-only commands)", () => {
    expect(planRightScene(undefined, { country: "GB", camera: { center: [0, 51], zoom: 8 } }, "GB")).toEqual({ kind: "none" });
  });

  it("closes side by side on right:null", () => {
    expect(planRightScene(null, { country: "GB" }, "GB")).toEqual({ kind: "close" });
  });

  it("opens a new right country and re-applies camera and results on the rebuilt map", () => {
    const right = { country: "JP", camera: { center: [139.7, 35.7] as [number, number], zoom: 10 }, results: collection };
    expect(planRightScene(right, right, "GB")).toEqual({ kind: "apply", openCountry: "JP", move: { camera: right.camera }, results: collection });
  });

  it("moves the right map only when its camera or framing changed", () => {
    const previous = { country: "GB", camera: { center: [-0.1, 51.5] as [number, number], zoom: 9 } };
    expect(planRightScene({ ...previous }, previous, "GB")).toEqual({ kind: "apply", openCountry: null, move: null, results: undefined });
    const moved = { ...previous, camera: { center: [-2.2, 53.4] as [number, number], zoom: 10 }, framing: null };
    expect(planRightScene(moved, previous, "GB")).toMatchObject({ move: { camera: moved.camera } });
    expect(planRightScene({ country: "GB", framing, results: collection }, previous, "GB")).toEqual({ kind: "apply", openCountry: null, move: { framing }, results: collection });
  });

  it("an omitted country keeps the current right country (must already be side by side)", () => {
    expect(planRightScene({ camera: { center: [2.35, 48.85], zoom: 11 } }, null, "FR")).toMatchObject({ kind: "apply", openCountry: null });
  });
});

describe("bridge validation of the right sub-scene", () => {
  const isFraming = () => true;
  const isResults = () => true;
  it("accepts only the four declared keys and an ISO-2 country", () => {
    expect(isRightScene(null, isFraming, isResults)).toBe(true);
    expect(isRightScene({ country: "GB", camera: { center: [0, 51], zoom: 9 }, framing: null, results: null }, isFraming, isResults)).toBe(true);
    expect(isRightScene({ country: "gb" }, isFraming, isResults)).toBe(false);
    expect(isRightScene({ side: "right" }, isFraming, isResults)).toBe(false);
    expect(isRightScene({ camera: { center: [0, 99], zoom: 9 } }, isFraming, isResults)).toBe(false);
  });

  const state = { studyId: "study-1", tabId: "tab-1", revision: 3, scene: { camera: { center: [121.5, 25], zoom: 12 }, resultMode: "empty" }, view: { revision: 3, phase: "ready" }, connected: true, paused: false, pendingCommand: null };
  const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
  const command = (patch: unknown) => ({ protocolVersion: "1", sessionId: "s-1", studyId: "study-1", tabId: "tab-1", commandId: "c-1", expectedRevision: 3, expiresAt: 1e13, patch });

  it("accepts a pending command and scene that carry right (legacy result ids normalized)", async () => {
    const next = { ...state, scene: { ...state.scene, right: { country: "GB", results: { resultIds: ["wh-3"] } } }, pendingCommand: command({ right: { country: "GB", camera: { center: [-0.1, 51.5], zoom: 9 }, results: { resultIds: ["wh-3"] } } }) };
    const synced = await new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response(next))).sync("study-1", "tab-1");
    expect(synced.scene.right?.results).toEqual(collection);
    expect((synced.pendingCommand!.patch.right as { results: unknown }).results).toEqual(collection);
  });

  it("still rejects an unknown scene key and a malformed right", async () => {
    const bad = { ...state, pendingCommand: command({ right: { country: "GB", side: "right" } }) };
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response(bad))).sync("study-1", "tab-1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    const extra = { ...state, scene: { ...state.scene, side: "right" } };
    await expect(new BridgeClient(async () => "t", vi.fn().mockResolvedValue(response(extra))).sync("study-1", "tab-1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});

// MainMapConnection is the whole connection component; like mapContextCountry.test.ts these pin the wiring.
describe("MainMapConnection wiring (G2-3)", () => {
  const source = readFileSync("src/research/MainMapConnection.tsx", "utf8");
  it("map_context keeps the top level = left map and adds compare from compareContext", () => {
    const block = source.slice(source.indexOf('case "map_context": {'), source.indexOf('case "search_layers":'));
    expect(block).toContain("liveVisible.filter(key => shownOnLeft(key, true))");
    expect(block).toContain("const compare = compareContext(compareStore.getSnapshot(), rightReading)");
    expect(block).toMatch(/visibleSummary,\s*\/\/[^\n]*\n\s*compare \}/);
  });
  it("right-side work is planned from this command's patch only, and fails loudly when not side by side", () => {
    expect(source).toContain("planRightScene(patch?.right, previous.current?.right,");
    expect(source).toContain('throw new Error("COMPARE_NOT_ACTIVE")');
  });
  it("a captured (manual) scene carries right only after the gateway sent one", () => {
    expect(source).toContain('...(previous.current && "right" in previous.current ? { right: captureRight() } : {})');
  });
});
