import { describe, expect, it } from "vitest";

import { buildTools } from "../../chat/tools/registry";
import type { MapBridge } from "../../chat/types";
import {
  assertWebsiteToolCapabilityCoverage,
  selectToolRoutingStrategy,
  surfaceForCapability,
  websiteJevCandidates,
} from "../toolCapabilityRegistry";

const bridge: MapBridge = {
  bulkSetVisibility: () => undefined,
  allOff: () => undefined,
  flyTo: () => undefined,
  jumpToPlace: () => true,
  highlightPoint: () => undefined,
  getVisibleLayerKeys: () => [],
  getCurrentTimeISO: () => "2026-09-20T00:00:00.000Z",
  getCamera: () => ({ lng: 121.5, lat: 25, zoom: 8 }),
};

describe("shared tool capability registry", () => {
  it("classifies every current website tool and keeps the small registry in one Choice", () => {
    const names = Object.keys(buildTools(bridge));
    expect(() => assertWebsiteToolCapabilityCoverage(names)).not.toThrow();
    expect(names).toHaveLength(11);
    expect(selectToolRoutingStrategy(names.length)).toBe("direct_choice");
  });

  it("does not expose the low-level RPC escape hatch to Jev", () => {
    const candidates = websiteJevCandidates(Object.keys(buildTools(bridge)));
    expect(candidates.map((candidate) => candidate.name)).not.toContain("call_rpc");
    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "search_layers", capability: "layer_discovery" }),
      expect.objectContaining({ name: "set_layers", capability: "map_presentation" }),
      expect.objectContaining({ name: "query_dataset", capability: "data_query" }),
      expect.objectContaining({ name: "rank_by_population", capability: "analysis" }),
    ]));
  });

  it("uses hierarchy only when the actual candidate set grows", () => {
    expect(selectToolRoutingStrategy(0)).toBe("deterministic");
    expect(selectToolRoutingStrategy(1)).toBe("deterministic");
    expect(selectToolRoutingStrategy(20)).toBe("direct_choice");
    expect(selectToolRoutingStrategy(21)).toBe("hierarchical_choice");
    expect(() => selectToolRoutingStrategy(-1)).toThrow();
  });

  it("routes map interaction to the website and data work to MCP", () => {
    expect(surfaceForCapability("layer_discovery")).toBe("website");
    expect(surfaceForCapability("map_presentation")).toBe("website");
    expect(surfaceForCapability("dataset_discovery")).toBe("mcp");
    expect(surfaceForCapability("data_query")).toBe("mcp");
    expect(surfaceForCapability("analysis")).toBe("mcp");
    expect(surfaceForCapability("session_state")).toBe("session");
  });
});
