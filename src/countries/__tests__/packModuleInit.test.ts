/**
 * B1 P5b：國家包的模組（hook、圖例、popup…）在 ensureCountryPack 登記 records「之前」就會先執行完。
 * 所以包裡的模組不可在模組載入時就讀登記簿（例：`const OPACITY_DEFAULT = Number(paramDefault(...))`
 * 會拿到 undefined→NaN，透明度就壞了）；要用時再讀（寫成函式）。
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../", import.meta.url);
const READS = /paramDefault\(|LAYER_MANIFEST\b|LAYER_PARAMS_SPEC\b|LAYER_SOURCE_INFO\b|getLayerEntry\(|paletteSpecOf\(|getAtlasRecipe\(|\b(\w*[oO]pacityDefault|\w*[sS]caleDefault|defaultOpacity)\(/;
const LAZY = /^(export )?(const|let) \w+(\s*:[^=]+)?\s*=\s*(async\s*)?(\([^)]*\)|\w+)\s*(:[^=]+)?=>/;

/** 頂層的 const／let 宣告（跨行時合成一句）；註解先拿掉。 */
function topLevelDeclarations(text: string): { line: number; text: string }[] {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, "")).replace(/\/\/.*$/gm, "");
  const out: { line: number; text: string }[] = [];
  let depth = 0;
  let stmt: string[] = [];
  let start = 0;
  src.split("\n").forEach((line, i) => {
    if (depth === 0) { stmt = [line]; start = i + 1; } else stmt.push(line);
    for (const ch of line) {
      if ("{([".includes(ch)) depth++;
      else if ("})]".includes(ch)) depth--;
    }
    if (depth <= 0) {
      depth = 0;
      const s = stmt.join("\n").trim();
      if (/^(export )?(const|let|var) /.test(s)) out.push({ line: start, text: s });
    }
  });
  return out;
}

describe("國家包模組不在載入時讀登記簿", () => {
  const dirs = readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^[a-z]{2}$/.test(d.name))
    .map((d) => d.name);
  it("有國家包目錄", () => expect(dirs.length).toBeGreaterThan(0));
  it.each(dirs)("%s", (dir) => {
    const offending: string[] = [];
    for (const f of readdirSync(new URL(`${dir}/`, ROOT))) {
      if (!/\.tsx?$/.test(f)) continue;
      const text = readFileSync(new URL(`${dir}/${f}`, ROOT), "utf8");
      for (const d of topLevelDeclarations(text)) {
        // getter（get x() { … }）與箭頭函式一樣是用時才讀
        const eager = d.text.replace(/\bget \w+\(\)\s*\{[^}]*\}/g, "");
        if (READS.test(eager) && !LAZY.test(eager)) offending.push(`${dir}/${f}:${d.line} ${d.text.split("\n")[0]}`);
      }
    }
    expect(offending).toEqual([]);
  });
});
