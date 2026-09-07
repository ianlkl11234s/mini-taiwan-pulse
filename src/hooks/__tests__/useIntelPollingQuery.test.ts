import { describe, expect, it } from "vitest";
import {
  applyIntelQueryResult,
  initialIntelQueryState,
} from "../useIntelPollingQuery";

describe("Intel polling query state", () => {
  it("keeps the last successful value and marks a refresh outage", () => {
    const ready = applyIntelQueryResult(initialIntelQueryState<number[]>([], "today"), {
      status: "ready", data: [7], lastSuccessAt: 100,
    }, []);
    expect(applyIntelQueryResult(ready, {
      status: "error", data: [], lastSuccessAt: null, message: "timeout",
    }, [])).toMatchObject({ status: "error", data: [7], lastSuccessAt: 100, queryKey: "today" });
  });

  it("treats a successful empty response as a real clear state", () => {
    const previous = initialIntelQueryState<number[]>([7], "today");
    expect(applyIntelQueryResult(previous, {
      status: "ready", data: [], lastSuccessAt: 200,
    }, [])).toMatchObject({ status: "ready", data: [], lastSuccessAt: 200 });
  });

  it("clears retained data when access is denied", () => {
    const previous = applyIntelQueryResult(initialIntelQueryState<number[]>([], "today"), {
      status: "ready", data: [7], lastSuccessAt: 100,
    }, []);
    expect(applyIntelQueryResult(previous, {
      status: "denied", data: [], lastSuccessAt: null,
    }, [])).toMatchObject({ status: "denied", data: [], lastSuccessAt: null });
  });

  it("starts a changed query as unknown so old-range data cannot render", () => {
    const old = applyIntelQueryResult(initialIntelQueryState<number[]>([], "2026-09-06"), {
      status: "ready", data: [7], lastSuccessAt: 100,
    }, []);
    const changed = initialIntelQueryState<number[]>([], "2026-09-07");
    expect(old.queryKey).not.toBe(changed.queryKey);
    expect(changed).toMatchObject({ status: "unknown", data: [] });
  });
});
