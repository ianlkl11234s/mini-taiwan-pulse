// 型別宣告：check-entry-docs.mjs（單一入口文件檢查純函式）。
export declare const PROJECTS_PATH: string;
export declare const BACKLOG_PATH: string;
export declare const STATE_WHITELIST: string[];
export declare const RESULT_MARK: RegExp;
export declare const RULES: {
  closedId: string;
  unknownId: string;
  deadline: string;
  state: string;
  link: string;
  archive: string;
};
export declare const WARNING_RULES: Set<string>;
export interface EntryDocProblem { file: string; line: number; rule: string; level: "error" | "warning"; message: string }
export interface BacklogIndex {
  open: Map<string, number>;
  closed: Map<string, number>;
  rows: { line: number; raw: string; id: string; header: string[]; cells: string[] }[];
  lines: string[];
  end: number;
}
export declare function taipeiToday(now?: Date): string;
export declare function extractIds(text: string): string[];
export declare function parseBacklog(text: string): BacklogIndex;
export declare function checkEntryDocs(input: {
  projects: string;
  backlog: string;
  today: string;
  fileExists?: (repoRelPath: string) => boolean;
}): EntryDocProblem[];
