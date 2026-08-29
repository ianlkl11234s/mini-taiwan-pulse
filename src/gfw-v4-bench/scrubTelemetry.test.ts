import { describe, expect, it } from "vitest";
import { measureControlledScrub } from "./scrubTelemetry";
describe("controlled scrub telemetry", () => {
  it("records exactly 96 completed RAF samples", async () => { let clock = 0; const result = await measureControlledScrub(() => undefined, 96, (callback) => { clock += 16; callback(clock); return 1; }); expect(result.samples).toBe(96); expect(result.p95Ms).toBe(16); });
  it("rejects an invalid sample budget", async () => { await expect(measureControlledScrub(() => undefined, 1, (() => 1) as never)).rejects.toThrow("at least two"); });
});
