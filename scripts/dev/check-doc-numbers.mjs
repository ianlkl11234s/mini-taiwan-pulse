// 文件數字 ↔ 產生檔一致性檢查（RV27-2／HANDOFF 項目 12）。零相依，由 check-entry-docs.mjs 一併呼叫。
//
//   1. layer-status-summary.md 的「圖層總數」必須等於 layer-status.csv 的資料列數（同一次產生才會相等）。
//   2. 文件中的 MCP 工具數寫成 `24<!-- gen:mcp-core=24 -->`／`65<!-- gen:mcp-full=65 -->`，
//      標記值必須等於 mcp-tool-count.json（scripts/research/count-mcp-tools.mjs 產生）；標記前緊鄰的數字也要一致（數字後可隔 Markdown 強調符號，如 `**core 24**<!-- … -->`）。
//      ARCHITECTURE.md 至少要有 core 標記，避免有人改回手寫數字。
// 重產：npm run research:layer-status（需 PULSE_WAREHOUSE_DIR 等，見腳本檔頭）／node scripts/research/count-mcp-tools.mjs。

export const LAYER_STATUS_SUMMARY = "docs/features/general-analysis/layer-status-summary.md";
export const LAYER_STATUS_CSV = "docs/features/general-analysis/layer-status.csv";
export const TOOL_COUNT_PATH = "docs/features/agent-research-workbench/mcp-tool-count.json";
export const TOOL_COUNT_REQUIRED_IN = ["docs/features/agent-research-workbench/ARCHITECTURE.md"];

export const NUMBER_RULES = { layerCount: "layer-count", toolCount: "tool-count", toolMarker: "tool-marker" };

const MARKER = /(?:(\d+)[*_`~]*)?[ \t]*<!--\s*gen:mcp-(core|full)=(\d+)\s*-->/g;

/** 資料列數（不含表頭）；欄位可含雙引號與換行。 */
export function csvRowCount(text) {
  let rows = 0, inQuote = false, lineHasContent = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (inQuote && text[i + 1] === '"') i++; else inQuote = !inQuote; lineHasContent = true; }
    else if (ch === "\n" && !inQuote) { if (lineHasContent) rows++; lineHasContent = false; }
    else if (ch !== "\r") lineHasContent = true;
  }
  if (lineHasContent) rows++;
  return Math.max(0, rows - 1);
}

export function checkDocNumbers({ layerStatusSummary, layerStatusCsv, toolCount, docs }) {
  const problems = [];
  const push = (file, line, rule, message) => problems.push({ file, line, rule, level: "error", message });

  if (layerStatusSummary != null && layerStatusCsv != null) {
    const m = layerStatusSummary.match(/圖層總數：\*\*(\d+)\*\*/);
    const rows = csvRowCount(layerStatusCsv);
    if (!m) push(LAYER_STATUS_SUMMARY, 1, NUMBER_RULES.layerCount, "找不到「圖層總數：**N**」，無法比對 layer-status.csv");
    else if (Number(m[1]) !== rows) push(LAYER_STATUS_SUMMARY, 1, NUMBER_RULES.layerCount, `summary 寫 ${m[1]} 層，layer-status.csv 有 ${rows} 列；請一起重產（npm run research:layer-status）`);
  }

  if (toolCount) {
    for (const [file, text] of Object.entries(docs)) {
      text.split("\n").forEach((line, index) => {
        for (const m of line.matchAll(MARKER)) {
          const [, shown, kind, marked] = m;
          const expected = toolCount[kind];
          if (Number(marked) !== expected) push(file, index + 1, NUMBER_RULES.toolCount, `MCP ${kind} 工具數標記 ${marked}，產生檔 mcp-tool-count.json 為 ${expected}；請改文件數字（或先重跑 count-mcp-tools.mjs）`);
          else if (shown !== undefined && Number(shown) !== expected) push(file, index + 1, NUMBER_RULES.toolCount, `MCP ${kind} 工具數寫 ${shown}，產生檔為 ${expected}`);
        }
      });
    }
    for (const file of TOOL_COUNT_REQUIRED_IN)
      if (docs[file] != null && !/gen:mcp-core=\d+/.test(docs[file])) push(file, 1, NUMBER_RULES.toolMarker, "缺少 `<!-- gen:mcp-core=N -->` 標記：工具數請用腳本產生的數字，不要手寫");
  }
  return problems;
}
