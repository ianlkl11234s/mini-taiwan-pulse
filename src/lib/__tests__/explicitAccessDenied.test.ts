import { describe, expect, it } from "vitest";
import { isExplicitAccessDenied } from "../accessDenied";

describe("explicit access denial classification", () => {
  it.each([{ code: "42501" }, { status: 401 }, { statusCode: 403 }, new Error("authentication failed")])("recognizes %j", error => {
    expect(isExplicitAccessDenied(error)).toBe(true);
  });
  it.each([{ status: 500 }, Error("network error"), Error("Failed to fetch"), null])("keeps retryable errors distinct: %j", error => {
    expect(isExplicitAccessDenied(error)).toBe(false);
  });
});
