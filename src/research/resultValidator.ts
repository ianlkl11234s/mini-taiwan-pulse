import { validateResult, type ResearchResult } from "./contracts/result-validator.mjs";

export const MAX_RESULT_BYTES = 5 * 1024 * 1024;
export function parseResult(text: string): ResearchResult {
  if (new TextEncoder().encode(text).byteLength > MAX_RESULT_BYTES) throw new Error("RESULT_TOO_LARGE：成果不得超過 5 MiB。");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("INVALID_JSON：請提供有效 JSON。"); }
  const checked = validateResult(value);
  if (!checked.valid) throw new Error(checked.errors.slice(0, 3).map(e => `${e.code} · ${e.path}`).join("；"));
  return value as ResearchResult;
}
