// 型別宣告：check-doc-numbers.mjs
export declare const LAYER_STATUS_SUMMARY: string;
export declare const LAYER_STATUS_CSV: string;
export declare const TOOL_COUNT_PATH: string;
export declare const TOOL_COUNT_REQUIRED_IN: string[];
export declare const NUMBER_RULES: { layerCount: string; toolCount: string; toolMarker: string };
export declare function csvRowCount(text: string): number;
export declare function checkDocNumbers(input: {
  layerStatusSummary?: string | null;
  layerStatusCsv?: string | null;
  toolCount?: { core: number; full: number } | null;
  docs: Record<string, string>;
}): { file: string; line: number; rule: string; level: "error"; message: string }[];
