import { describe, expect, it } from "vitest";
import { isNewsLocationEvidencePocEnabled, shouldMountNewsLocationEvidencePoc } from "../newsLocationEvidencePocFlag";

describe("news location evidence POC gate", () => {
  it("is production-safe by default and only accepts the explicit true string", () => {
    expect(isNewsLocationEvidencePocEnabled({})).toBe(false);
    expect(isNewsLocationEvidencePocEnabled({ VITE_NEWS_LOCATION_EVIDENCE_POC: true })).toBe(false);
    expect(isNewsLocationEvidencePocEnabled({ VITE_NEWS_LOCATION_EVIDENCE_POC: "1" })).toBe(false);
    expect(isNewsLocationEvidencePocEnabled({ VITE_NEWS_LOCATION_EVIDENCE_POC: "true" })).toBe(true);
  });

  it("does not mount the POC query while Monitor is closed or the flag is off", () => {
    expect(shouldMountNewsLocationEvidencePoc(false, true)).toBe(false);
    expect(shouldMountNewsLocationEvidencePoc(true, false)).toBe(false);
    expect(shouldMountNewsLocationEvidencePoc(true, true)).toBe(true);
  });
});
