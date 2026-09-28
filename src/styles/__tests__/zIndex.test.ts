import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Z_INDEX } from "../designTokens";

describe("Z_INDEX 層級規則", () => {
  it("相對順序：mapOverlay < floatingPanel < toolbar < popover < modal < toast", () => {
    const order = [Z_INDEX.mapOverlay, Z_INDEX.floatingPanel, Z_INDEX.toolbar, Z_INDEX.popover, Z_INDEX.modal, Z_INDEX.toast];
    for (let i = 1; i < order.length; i++) expect(order[i]!).toBeGreaterThan(order[i - 1]!);
  });

  it("TS ↔ CSS 同值（Z_INDEX.camelCase ↔ --z-kebab-case）", () => {
    const css = readFileSync(join(fileURLToPath(new URL("../../..", import.meta.url)), "src/styles/tokens.css"), "utf8");
    const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    for (const [key, value] of Object.entries(Z_INDEX)) {
      const m = new RegExp(`--z-${kebab(key)}:\\s*([^;]+);`).exec(css);
      expect(m?.[1]?.trim(), `Z_INDEX.${key}`).toBe(String(value));
    }
  });
});
