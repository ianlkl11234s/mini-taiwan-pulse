import { describe, expect, it } from "vitest";

import {
  MAX_MAP_STATE_LAYERS,
  MAX_SCENE_LAYERS,
  browserClientMessageSchema,
  browserServerMessageSchema,
  mapCommandResultSchema,
  mapSceneSchema,
  mapStateSummarySchema,
} from "../protocol";

const state = {
  revision: 3,
  camera: { center: [121.5, 25.05] as [number, number], zoom: 10 },
  layers: [{ id: "aquaculture", visible: true, opacity: 0.7 }],
};

describe("browser protocol v1", () => {
  it("accepts a browser hello", () => {
    expect(
      browserClientMessageSchema.safeParse({
        type: "hello",
        protocolVersion: "1",
        token: "local-secret-token",
        sessionId: "map-tab-1",
        client: { name: "mini-taiwan-pulse", version: "0.1.0" },
      }).success,
    ).toBe(true);
  });

  it("accepts get_map_state and its result", () => {
    expect(
      browserServerMessageSchema.safeParse({
        type: "command",
        protocolVersion: "1",
        commandId: "cmd-get-1",
        command: { type: "get_map_state" },
      }).success,
    ).toBe(true);

    expect(mapStateSummarySchema.safeParse(state).success).toBe(true);
    expect(
      browserClientMessageSchema.safeParse({
        type: "result",
        protocolVersion: "1",
        commandId: "cmd-get-1",
        ok: true,
        result: state,
      }).success,
    ).toBe(true);
  });

  it("accepts apply_scene and its acknowledged result", () => {
    const scene = {
      camera: { bounds: [120, 21.8, 122, 25.4], padding: 24 },
      layers: [
        {
          id: "aquaculture",
          visible: true,
          opacity: 0.8,
          params: { year: 2025, category: "fishpond", labels: true },
        },
      ],
    };

    expect(mapSceneSchema.safeParse(scene).success).toBe(true);
    expect(
      browserServerMessageSchema.safeParse({
        type: "command",
        protocolVersion: "1",
        commandId: "cmd-apply-1",
        command: { type: "apply_scene", scene, expectedRevision: 3 },
      }).success,
    ).toBe(true);

    expect(
      mapCommandResultSchema.safeParse({
        commandId: "cmd-apply-1",
        success: true,
        previousRevision: 3,
        newRevision: 4,
        applied: ["layers.aquaculture"],
        denied: [],
        warnings: [],
        actualState: { ...state, revision: 4 },
      }).success,
    ).toBe(true);
  });

  it.each([
    {
      type: "command",
      protocolVersion: "1",
      commandId: "cmd-1",
      command: { type: "get_map_state", unknown: true },
    },
    {
      type: "command",
      protocolVersion: "2",
      commandId: "cmd-1",
      command: { type: "get_map_state" },
    },
    {
      type: "command",
      protocolVersion: "1",
      commandId: "cmd-1",
      command: { type: "unknown_command" },
    },
    {
      type: "command",
      protocolVersion: "1",
      commandId: "cmd-1",
      command: {
        type: "apply_scene",
        scene: { layers: [{ id: "layer", visible: true, filter: [] }] },
      },
    },
  ])("rejects unknown protocol content", (message) => {
    expect(browserServerMessageSchema.safeParse(message).success).toBe(false);
  });

  it("rejects invalid scene bounds and limits", () => {
    expect(
      mapSceneSchema.safeParse({
        camera: { center: [181, 25], zoom: 25 },
        layers: [],
      }).success,
    ).toBe(false);
    expect(
      mapSceneSchema.safeParse({
        camera: { bounds: [122, 20, 120, 25] },
        layers: [],
      }).success,
    ).toBe(false);
    expect(
      mapSceneSchema.safeParse({
        layers: Array.from({ length: MAX_SCENE_LAYERS + 1 }, (_, index) => ({
          id: `layer-${index}`,
          visible: true,
        })),
      }).success,
    ).toBe(false);
    expect(
      mapSceneSchema.safeParse({
        layers: [{ id: "x", visible: true, opacity: 1.1 }],
      }).success,
    ).toBe(false);
    expect(
      mapSceneSchema.safeParse({
        layers: [{ id: "x", visible: true, params: { nested: { value: 1 } } }],
      }).success,
    ).toBe(false);
  });

  it("allows a complete map state beyond the scene mutation limit", () => {
    const stateLayers = Array.from({ length: MAX_SCENE_LAYERS + 1 }, (_, index) => ({
      id: `layer-${index}`,
      visible: index % 2 === 0,
    }));

    expect(
      mapStateSummarySchema.safeParse({ revision: 1, camera: {}, layers: stateLayers }).success,
    ).toBe(true);
    expect(
      mapStateSummarySchema.safeParse({
        revision: 1,
        camera: {},
        layers: Array.from({ length: MAX_MAP_STATE_LAYERS + 1 }, (_, index) => ({
          id: `layer-${index}`,
          visible: false,
        })),
      }).success,
    ).toBe(false);
  });
});
