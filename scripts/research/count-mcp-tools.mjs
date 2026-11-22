#!/usr/bin/env node
/**
 * MCP 工具數的唯一來源（RV27-2／項目 12）：從 MCP repo 原始碼計算，寫進 mcp-tool-count.json。
 * 文件裡的工具數用 `24<!-- gen:mcp-core=24 -->` 標記，npm run check:entry-docs 會比對這份檔。
 *
 *   core：src/research/toolsets.ts 的 CORE_TOOLS（PULSE_TOOLSET 預設值，Agent 實際看到的工具）
 *   full：src/research/server.test.ts 的 expectedToolNames（PULSE_TOOLSET=full；該測試保證它等於實際註冊清單）
 *
 * 用法：node scripts/research/count-mcp-tools.mjs [--mcp <MCP repo>] [--check]
 *   無 --check：寫檔；--check：與現有檔比對，不同就 exit 1（找不到 MCP repo 時略過並 exit 0）。
 * 零相依。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const OUTPUT_PATH = "docs/features/agent-research-workbench/mcp-tool-count.json";

/** 取出 `<marker> = [ ... ]` 陣列裡所有 "pulse_*" 字串（去重前的原始清單）。 */
export function toolNamesIn(text, marker) {
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`找不到 ${marker}`);
  const open = text.indexOf("[", start);
  // 取最早的結尾：`] as const;` 之後同檔案的其他 `];` 陣列不可算進來
  const ends = ["];", "] as const"].map(end => text.indexOf(end, open)).filter(i => i >= 0);
  const close = ends.length ? Math.min(...ends) : -1;
  if (open < 0 || close < 0) throw new Error(`${marker} 不是陣列`);
  return [...text.slice(open, close).matchAll(/"(pulse_[a-z0-9_]+)"/g)].map(m => m[1]);
}

export function countTools(toolsetsTs, serverTestTs) {
  const core = toolNamesIn(toolsetsTs, "export const CORE_TOOLS");
  const full = toolNamesIn(serverTestTs, "const expectedToolNames");
  if (new Set(core).size !== core.length || new Set(full).size !== full.length) throw new Error("工具清單有重複名稱");
  return { core: core.length, full: full.length };
}

function main() {
  const args = process.argv.slice(2);
  const opt = key => { const i = args.indexOf(key); return i >= 0 ? args[i + 1] : undefined; };
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../..");
  const mcp = [opt("--mcp"), process.env.PULSE_MCP_ROOT, resolve(root, "../mini-pulse-gis-mcp"), resolve(root, "../../../mini-pulse-gis-mcp")]
    .filter(Boolean).find(dir => existsSync(resolve(dir, "src/research/toolsets.ts")));
  const out = resolve(root, OUTPUT_PATH);
  if (!mcp) {
    if (args.includes("--check")) { console.log("count-mcp-tools：找不到 MCP repo，略過比對。"); return; }
    console.error("找不到 MCP repo；用 --mcp 或 PULSE_MCP_ROOT 指定。"); process.exit(1);
  }
  const counts = countTools(readFileSync(resolve(mcp, "src/research/toolsets.ts"), "utf8"), readFileSync(resolve(mcp, "src/research/server.test.ts"), "utf8"));
  const body = {
    _generatedBy: "scripts/research/count-mcp-tools.mjs（請勿手改）",
    core: counts.core,
    full: counts.full,
    coreSource: "mini-pulse-gis-mcp src/research/toolsets.ts CORE_TOOLS（PULSE_TOOLSET 預設值）",
    fullSource: "mini-pulse-gis-mcp src/research/server.test.ts expectedToolNames（PULSE_TOOLSET=full）",
  };
  const text = JSON.stringify(body, null, 2) + "\n";
  if (args.includes("--check")) {
    const current = existsSync(out) ? readFileSync(out, "utf8") : "";
    if (current !== text) { console.error(`mcp-tool-count.json 過期：core ${counts.core}／full ${counts.full}，請重跑 node scripts/research/count-mcp-tools.mjs`); process.exit(1); }
    console.log(`count-mcp-tools：一致（core ${counts.core}／full ${counts.full}）`);
    return;
  }
  writeFileSync(out, text);
  console.log(`core=${counts.core} full=${counts.full} → ${OUTPUT_PATH}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
