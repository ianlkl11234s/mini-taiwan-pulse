import { describe, expect, it } from "vitest";
import fixture from "../contracts/fixture.json";
import { MAX_RESULT_BYTES, parseResult } from "../resultValidator";

describe("research file boundary", () => {
  it("accepts the canonical synthetic fixture without changing its null or source semantics", () => {
    const parsed = parseResult(JSON.stringify(fixture));
    expect(parsed.inputMode).toBe("synthetic");
    expect(parsed.quality.freshness.observedAt).toBeNull();
    expect(parsed.metrics[0]?.value).toBe(1.5);
  });
  it("rejects oversized raw JSON even if most of its bytes are whitespace", () => {
    expect(() => parseResult(" ".repeat(MAX_RESULT_BYTES) + "{}")).toThrow("RESULT_TOO_LARGE");
  });
  it("refuses zero denominator and unsupported real-data input modes", () => {
    const invalid = structuredClone(fixture);
    invalid.metrics[0]!.denominator.value = 0;
    expect(() => parseResult(JSON.stringify(invalid))).toThrow("RATIO_DENOMINATOR");
    expect(() => parseResult(JSON.stringify({ ...fixture, inputMode: "receipt" }))).toThrow("UNSUPPORTED_INPUT_MODE");
  });
});
