// 型別宣告：check-changelog-frozen.mjs（已發布 CHANGELOG 段落凍結檢查）。
export declare const CHANGELOG_PATH: string;
export interface VersionSection { version: string; heading: string; line: number; lines: string[] }
export interface LineDiff { op: "-" | "+"; text: string; line: number }
export interface FrozenResult {
  errors: { version: string; headLine: number; diff: LineDiff[] }[];
  missing: string[];
  checked: number;
}
export declare function versionOf(heading: string): string | null;
export declare function splitVersionSections(text: string): Map<string, VersionSection>;
export declare function diffLines(a: string[], b: string[]): LineDiff[];
export declare function checkChangelogFrozen(input: { master: string; head: string }): FrozenResult;
export declare function formatReport(result: FrozenResult, baseRef?: string): string[];
