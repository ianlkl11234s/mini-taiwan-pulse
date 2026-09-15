import { describe, expect, it } from "vitest";
import { allenCoralFilter, allenCoralSource, allenCoralColor, ALLEN_CORAL_SOURCES } from "../allenCoralAtlasTypes";
describe("Allen thematic semantics", () => {
  it("default view selects only the combined Coral/Algae class, region is an intersection", () => {
    expect(allenCoralFilter("coralAlgae", "taiwan")).toEqual(["all", ["==", ["get", "class_name"], "Coral/Algae"], ["==", ["get", "region"], "taiwan"]]);
    expect(allenCoralFilter("geomorphic", "okinawa")).toEqual(["all", ["==", ["get", "region"], "okinawa"]]);
    expect(allenCoralFilter("benthic", "all")).toEqual(["all"]);
  });
  it("uses distinct authenticated source endpoints and neutral unknown color", () => {
    expect(allenCoralSource("coralAlgae")).toBe(ALLEN_CORAL_SOURCES.benthic);
    expect(allenCoralSource("geomorphic")).toBe(ALLEN_CORAL_SOURCES.geomorphic);
    expect(allenCoralSource("benthic").url).toBe("/api/private-research/allen-coral-atlas/benthic");
    expect(allenCoralColor("benthic").slice(-1)[0]).toBe("#a0a0a0");
    expect(ALLEN_CORAL_SOURCES.benthic.legend).toHaveLength(6);
    expect(ALLEN_CORAL_SOURCES.geomorphic.legend).toHaveLength(10);
  });
});
