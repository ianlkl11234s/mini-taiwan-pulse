import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = ["AirportPaxCard", "ERCard", "PlaBoard", "VesselZoneCard", "FoodPriceBoard", "TraDelayBoard", "HazardCards"];

describe("Monitor resource cards", () => {
  it.each(files)("routes %s polling and status through the shared monitor resource", (name) => {
    const source = readFileSync(new URL(`../${name}.tsx`, import.meta.url), "utf8");
    expect(source).toContain("useMonitorResource");
    expect(source).toContain("MonitorDataStatus");
    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("let cancelled");
  });

  it("keeps the independently failing ER queries independent", () => {
    const source = readFileSync(new URL("../ERCard.tsx", import.meta.url), "utf8");
    for (const key of ["er-latest", "er-24h", "er-14d"]) expect(source).toContain(`queryKey: \"${key}\"`);
  });
});
