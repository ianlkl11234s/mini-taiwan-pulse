import { afterEach, describe, expect, it, vi } from "vitest";

// SPEC-prod-connect §2.6: the loopback test identity exists only in a DEV build with the flag.
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
async function load(dev: boolean, flag: string | undefined) {
  vi.stubEnv("DEV", dev);
  if (flag !== undefined) vi.stubEnv("VITE_RESEARCH_TEST_IDENTITY", flag);
  return import("../testIdentity");
}

describe("testIdentity", () => {
  it("is active only in DEV with VITE_RESEARCH_TEST_IDENTITY=1", async () => {
    const on = await load(true, "1");
    expect(on.TEST_IDENTITY).toBe(true);
    expect(on.TEST_BROWSER_TOKEN).toBe("test-local");
  });

  it("is off without the flag or with any other value", async () => {
    for (const flag of [undefined, "", "0", "true"]) {
      vi.resetModules(); vi.unstubAllEnvs();
      const off = await load(true, flag);
      expect(off.TEST_IDENTITY).toBe(false);
      expect(off.TEST_BROWSER_TOKEN).toBe("");
    }
  });

  it("is off in a production build even with the flag", async () => {
    const prod = await load(false, "1");
    expect(prod.TEST_IDENTITY).toBe(false);
    expect(prod.TEST_BROWSER_TOKEN).toBe("");
  });
});
