// check-warehouse-gate.mjs 的型別（給 src/research/__tests__/warehouseGateDiff.test.ts）
export declare const CSV_PATH: string;
export declare function parseStatusCsv(text: string): Map<string, string>;
export declare function diffMissing(
  base: Map<string, string>,
  head: Map<string, string>,
): { added: string[]; removed: string[]; baseCount: number; headCount: number };
