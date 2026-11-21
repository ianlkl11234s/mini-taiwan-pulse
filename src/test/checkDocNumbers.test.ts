/** 文件數字 ↔ 產生檔檢查（scripts/dev/check-doc-numbers.mjs、count-mcp-tools.mjs）的 fixture 測試。 */
import { describe, expect, it } from "vitest";
import { checkDocNumbers, csvRowCount, TOOL_COUNT_REQUIRED_IN } from "../../scripts/dev/check-doc-numbers.mjs";
import { countTools } from "../../scripts/research/count-mcp-tools.mjs";

const ARCH = "docs/features/agent-research-workbench/ARCHITECTURE.md";
const REQUIRED = TOOL_COUNT_REQUIRED_IN;
const toolCount = { core: 24, full: 65 };

describe("csvRowCount", () => {
  it("counts data rows, ignoring header, quoted newlines and a trailing newline", () => {
    expect(csvRowCount('a,b\n1,"x\ny"\n2,"he said ""hi"""\n')).toBe(2);
    expect(csvRowCount("a,b\n")).toBe(0);
  });
});

describe("checkDocNumbers: layer-status", () => {
  const csv = "k,v\na,1\nb,2\n";
  it("passes when summary total equals csv rows", () => {
    expect(checkDocNumbers({ layerStatusSummary: "- 圖層總數：**2**；", layerStatusCsv: csv, docs: {} })).toEqual([]);
  });
  it("fails when they differ (2,008 vs 2,018 case)", () => {
    const problems = checkDocNumbers({ layerStatusSummary: "- 圖層總數：**3**；", layerStatusCsv: csv, docs: {} });
    expect(problems.map(p => p.rule)).toEqual(["layer-count"]);
  });
  it("fails when the summary has no total", () => {
    expect(checkDocNumbers({ layerStatusSummary: "nothing", layerStatusCsv: csv, docs: {} })[0]?.rule).toBe("layer-count");
  });
});

describe("checkDocNumbers: MCP tool count markers", () => {
  const docs = (text: string) => ({ [ARCH]: text });
  it("passes when markers and adjacent numbers match the generated file", () => {
    expect(checkDocNumbers({ toolCount, docs: docs("core 24<!-- gen:mcp-core=24 --> 個；full 65 <!-- gen:mcp-full=65 -->") })).toEqual([]);
  });
  it("fails when a marker disagrees with the generated file", () => {
    const problems = checkDocNumbers({ toolCount, docs: docs("core 23<!-- gen:mcp-core=23 -->") });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ rule: "tool-count", line: 1 });
  });
  it("fails when the visible number was edited but the marker was not", () => {
    expect(checkDocNumbers({ toolCount, docs: docs("core 50<!-- gen:mcp-core=24 -->") })[0]?.rule).toBe("tool-count");
  });
  it("requires ARCHITECTURE to keep a core marker", () => {
    expect(REQUIRED).toContain(ARCH);
    expect(checkDocNumbers({ toolCount, docs: docs("core 24 個工具（手寫）") })[0]?.rule).toBe("tool-marker");
  });
});

describe("countTools", () => {
  it("counts CORE_TOOLS and expectedToolNames from source text", () => {
    const toolsets = 'export const CORE_TOOLS = [\n  "pulse_a", "pulse_b",\n  "pulse_c",\n] as const;';
    const test = 'const expectedToolNames = [\n  "pulse_a", "pulse_b",\n  "pulse_c", "pulse_d",\n];\n';
    expect(countTools(toolsets, test)).toEqual({ core: 3, full: 4 });
  });
  it("rejects duplicate names", () => {
    expect(() => countTools('export const CORE_TOOLS = ["pulse_a", "pulse_a"] as const;', 'const expectedToolNames = ["pulse_a"];\n')).toThrow();
  });
});
