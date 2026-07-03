// 截斷鐵則 — 任何 tool 回傳給 LLM 的清單資料都必須先過這裡，
// 避免把數千筆 row 塞進 context。超上限時只回前 N 筆樣本 + 統計值。

export interface CapOptions {
  maxItems?: number;
  maxChars?: number;
}

export interface CappedResult<T> {
  truncated: true;
  total: number;
  sample: T[];
  note: string;
}

const DEFAULT_MAX_ITEMS = 20;
const DEFAULT_MAX_CHARS = 4000;

/**
 * 若 data 在上限內 → 原樣回傳陣列；
 * 超過 maxItems 或序列化後超過 maxChars → 回 { truncated, total, sample, note }。
 */
export function capToolResult<T>(
  data: T[],
  opts: CapOptions = {},
): T[] | CappedResult<T> {
  const maxItems = opts.maxItems ?? DEFAULT_MAX_ITEMS;
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;

  const total = data.length;
  let sample = data;
  let truncated = false;

  if (total > maxItems) {
    sample = data.slice(0, maxItems);
    truncated = true;
  }

  // 再依字元預算收斂（避免單筆過大撐爆 context）
  while (sample.length > 0 && JSON.stringify(sample).length > maxChars) {
    sample = sample.slice(0, sample.length - 1);
    truncated = true;
  }

  if (!truncated) return data;

  return {
    truncated: true,
    total,
    sample,
    note: `僅示範前 ${sample.length} 筆（共 ${total} 筆），請以統計值回答，不要逐筆列舉`,
  };
}
