import { describe, expect, it } from "vitest";
import { parseSingleByteRange } from "./gfwV4Range";
describe("GFW v4 PMTiles staging Range contract", () => {
  it("accepts exact/open/suffix single ranges", () => { expect(parseSingleByteRange("bytes=2-5", 10)).toEqual({ start: 2, end: 5 }); expect(parseSingleByteRange("bytes=8-", 10)).toEqual({ start: 8, end: 9 }); expect(parseSingleByteRange("bytes=-3", 10)).toEqual({ start: 7, end: 9 }); });
  it("rejects multiple, malformed, and unsatisfiable ranges", () => { expect(parseSingleByteRange("bytes=0-1,3-4", 10)).toBe("invalid"); expect(parseSingleByteRange("bytes=10-11", 10)).toBe("invalid"); });
});
