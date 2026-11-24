// 型別宣告：merge-develop.mjs（合併 develop 時自動處理共用檔衝突）。
export declare const GOLDEN: string;
export declare const INVENTORY: string;
export declare const CHANGELOG: string;
export declare const LOCALE_RE: RegExp;
export declare const SECTION_ORDER: string[];
export type RegenCommand = [string, string[]];
export declare const DEFAULT_REGEN: { golden: RegenCommand; inventory: RegenCommand };
export type MergeResult = { ok: true; text: string } | { ok: false; reason: string };
export declare function classify(path: string): "golden" | "inventory" | "changelog" | "locale" | null;
export declare function mergeChangelog(input: { base: string; ours: string; theirs: string }): MergeResult;
export declare function mergeJsonObject(input: { base: string; ours: string; theirs: string }): MergeResult;
export declare function runMergeDevelop(opts: {
  cwd: string;
  remote?: string;
  branch?: string;
  fetch?: boolean;
  dryRun?: boolean;
  regen?: { golden: RegenCommand; inventory: RegenCommand };
  env?: NodeJS.ProcessEnv;
  log?: (s: string) => void;
}): { code: number; touched: string[]; manual: string[] };
