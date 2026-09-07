import { describe, expect, it } from "vitest";
import { isAccessDenied } from "../layerGates";
describe("access denial classification", () => {
  it.each([{ code: "42501" }, { status: 401 }, { status: 403 }, { code: "403" }, { message: "permission denied" }])("recognizes %j", error => expect(isAccessDenied(error)).toBe(true));
  it.each([{ status: 500 }, Error("network error"), null])("keeps outages distinct from permission denial", error => expect(isAccessDenied(error)).toBe(false));
});
