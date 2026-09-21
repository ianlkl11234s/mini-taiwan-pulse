export type ToolCapabilityId =
  | "layer_discovery"
  | "dataset_discovery"
  | "data_query"
  | "analysis"
  | "map_presentation"
  | "map_context"
  | "session_state";

export interface ToolCapabilityDescriptor {
  id: ToolCapabilityId;
  what: string;
  notFor: string;
  examples: readonly string[];
}

/**
 * Shared routing vocabulary for the website and MCP surfaces.
 *
 * It describes user-facing capabilities, not transport-specific tool names.
 * Jev may rank these closed choices, but authorization and execution remain in
 * the owning website/MCP tool registry.
 */
export const TOOL_CAPABILITIES = {
  layer_discovery: {
    id: "layer_discovery",
    what: "Find or explain an existing map layer that can be shown on the Pulse map.",
    notFor: "Reading dataset records, calculating statistics, or claiming that a registered layer is loaded and healthy.",
    examples: ["有哪些醫療圖層", "找台中醫院圖層", "這個圖層資料來自哪裡"],
  },
  dataset_discovery: {
    id: "dataset_discovery",
    what: "Find or describe a dataset's grain, fields, geometry, version, access policy, semantics, and supported operations.",
    notFor: "Changing the map or treating catalog metadata as proof that records are readable.",
    examples: ["有哪些資料可以分析", "這份資料每一筆代表什麼", "缺值是什麼意思"],
  },
  data_query: {
    id: "data_query",
    what: "Read a bounded, authorized set of dataset records with declared filters, projection, pagination, space, or time limits.",
    notFor: "Arbitrary SQL, URLs, files, full exports, or changing map presentation.",
    examples: ["列出台中市的醫院", "查這個範圍內前二十筆學校", "下一頁"],
  },
  analysis: {
    id: "analysis",
    what: "Calculate a declared summary, ranking, comparison, quality check, or spatial analysis from authorized data.",
    notFor: "Simple layer discovery, map controls, or unsupported causal and coverage claims.",
    examples: ["各區醫院數量比較", "依人口網格排序", "檢查缺值比例"],
  },
  map_presentation: {
    id: "map_presentation",
    what: "Change the visible map through typed layer, camera, time, style, or result-presentation commands.",
    notFor: "Querying source records or claiming a command receipt proves that data finished loading.",
    examples: ["打開學校圖層", "框住這批結果", "把透明度調低"],
  },
  map_context: {
    id: "map_context",
    what: "Read the current camera, visible layers, controls, loading state, or scene revision without changing it.",
    notFor: "Full-source counts, dataset freshness, or geometry completeness.",
    examples: ["現在地圖開了什麼", "畫面是否還在載入", "目前鏡頭在哪裡"],
  },
  session_state: {
    id: "session_state",
    what: "Pair, inspect, wait for, or revoke the bounded website/MCP session and its receipts.",
    notFor: "Discovering data, analyzing records, or changing the map without a valid session.",
    examples: ["連接目前網站", "確認命令是否 ready", "撤銷連線"],
  },
} as const satisfies Record<ToolCapabilityId, ToolCapabilityDescriptor>;

export interface WebsiteToolCapabilityBinding {
  capability: ToolCapabilityId;
  purpose: string;
  /** False means the tool remains for compatibility but must not be offered to Jev. */
  jevEligible: boolean;
  note?: string;
}

/**
 * Compatibility projection for the current website chat registry.
 * New website tools must be classified here; the coverage test fails closed.
 */
export const WEBSITE_TOOL_CAPABILITIES = {
  list_layers: { capability: "layer_discovery", purpose: "List every registered layer inside one already-known theme.", jevEligible: true },
  search_layers: { capability: "layer_discovery", purpose: "Search registered layers by a natural-language topic or name.", jevEligible: true },
  get_layer_details: { capability: "layer_discovery", purpose: "Explain the source, theme, visibility, and relationship of a small known layer-key set.", jevEligible: true },
  set_layers: { capability: "map_presentation", purpose: "Turn a known set of valid layer keys on or off.", jevEligible: true },
  all_layers_off: { capability: "map_presentation", purpose: "Turn off every currently visible layer to reset the map.", jevEligible: true },
  fly_to: { capability: "map_presentation", purpose: "Move the camera to an explicit Taiwan coordinate and optional zoom.", jevEligible: true },
  jump_to_place: { capability: "map_presentation", purpose: "Move the camera to one registered named viewpoint or scene.", jevEligible: true },
  highlight_point: { capability: "map_presentation", purpose: "Place a visual marker at one explicit coordinate.", jevEligible: true },
  query_dataset: {
    capability: "data_query",
    purpose: "Run one legacy bounded count, grouping, declared filter, or nearest-point query over an allowed static point dataset.",
    jevEligible: true,
    note: "Legacy bounded website query; migrate behind DatasetDescriptor adapters.",
  },
  rank_by_population: {
    capability: "analysis",
    purpose: "Rank point records by the day or night population of the H3 cell containing each point.",
    jevEligible: true,
    note: "Specialized H3-grid ranking, not service coverage or nearby population.",
  },
  call_rpc: {
    capability: "data_query",
    purpose: "Call one low-level allowlisted Supabase RPC for compatibility.",
    jevEligible: false,
    note: "Transport implementation detail; Dataset adapters should choose declared RPCs.",
  },
} as const satisfies Record<string, WebsiteToolCapabilityBinding>;

export type ToolRoutingStrategy = "deterministic" | "direct_choice" | "hierarchical_choice";
export type ToolRoutingSurface = "website" | "mcp" | "session";

export function surfaceForCapability(capability: ToolCapabilityId): ToolRoutingSurface {
  switch (capability) {
    case "layer_discovery":
    case "map_presentation":
    case "map_context":
      return "website";
    case "dataset_discovery":
    case "data_query":
    case "analysis":
      return "mcp";
    case "session_state":
      return "session";
  }
}

export function selectToolRoutingStrategy(candidateCount: number): ToolRoutingStrategy {
  if (!Number.isInteger(candidateCount) || candidateCount < 0) {
    throw new Error("candidateCount must be a non-negative integer");
  }
  if (candidateCount <= 1) return "deterministic";
  if (candidateCount <= 20) return "direct_choice";
  return "hierarchical_choice";
}

export function assertWebsiteToolCapabilityCoverage(toolNames: readonly string[]): void {
  const actual = new Set(toolNames);
  const declared = new Set(Object.keys(WEBSITE_TOOL_CAPABILITIES));
  const missing = [...actual].filter((name) => !declared.has(name));
  const stale = [...declared].filter((name) => !actual.has(name));
  if (missing.length > 0 || stale.length > 0) {
    throw new Error(`Website tool capability drift: missing=[${missing.join(",")}], stale=[${stale.join(",")}]`);
  }
}

export function websiteJevCandidates(toolNames: readonly string[]) {
  assertWebsiteToolCapabilityCoverage(toolNames);
  return toolNames.flatMap((name) => {
    const binding = WEBSITE_TOOL_CAPABILITIES[name as keyof typeof WEBSITE_TOOL_CAPABILITIES];
    if (!binding.jevEligible) return [];
    return [{ name, capability: binding.capability, purpose: binding.purpose, criteria: TOOL_CAPABILITIES[binding.capability] }];
  });
}
