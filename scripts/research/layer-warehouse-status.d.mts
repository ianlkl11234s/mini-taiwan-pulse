// 型別宣告：layer-warehouse-status.mjs（AG-13 入倉守門純函式）。
export declare const NO_UPSTREAM_FILE: string;
export declare const DISPLAY_ONLY_FILE: string;
export declare const BASELINE_FILE: string;
export declare const INDICATOR_FILE: string;
export declare const DERIVED_FILES: Set<string>;

export type WarehouseStatus = "warehouse" | "statistics" | "no_upstream" | "display_only" | "missing";
export interface RegistryFile { name: string; text: string }
export interface ListRow { reason: string; unlock: string }
export interface RegistryIndex {
  entries: Map<string, { id: string; hasWarehouse: boolean; file: string }[]>;
  stats: Set<string>;
  noUpstream: Map<string, ListRow>;
  displayOnly: Map<string, ListRow>;
  baseline: Map<string, ListRow>;
}
export interface GateLayer { key: string; datasets: string[] }

export declare function parsePulseLayers(text: string): string[];
export declare function hasWarehouseTables(text: string): boolean;
export declare function parseEntryId(text: string): string | null;
export declare function parseIndicatorDatasets(text: string): Set<string>;
export declare function parseLayerList(text: string): Map<string, ListRow>;
export declare function indexRegistry(files: RegistryFile[]): RegistryIndex;
export declare function warehouseStatus(key: string, datasets: string[], index: RegistryIndex): WarehouseStatus;
export declare function checkWarehouseGate(layers: GateLayer[], index: RegistryIndex): {
  status: Map<string, WarehouseStatus>;
  violations: string[];
  staleBaseline: string[];
  incompleteDisplayOnly: string[];
};
