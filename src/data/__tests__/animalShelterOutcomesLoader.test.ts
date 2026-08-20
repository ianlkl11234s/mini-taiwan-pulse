import { describe, expect, it } from "vitest";
import {
  parseAnimalShelterOutcomeMonth, parseAnimalShelterPressure,
} from "../animalShelterOutcomesLoader";

describe("animal shelter outcome RPC contract", () => {
  it("preserves canonical month fields and official metrics without inventing totals", () => {
    expect(parseAnimalShelterOutcomeMonth({
      source_dataset_id: "animal_shelter_outcomes", source_record_id: "record-1",
      report_year: 2025, source_report_year: 114, report_month: 12, period_start: "2025-12-01",
      county_code: "City000002", name: "臺北市", report_grain_key: "114:12:City000002",
      official_metrics: { adopt_count: 15 }, quality_flags: ["verified"], source_retrieved_at: "2026-01-03T00:00:00Z",
    })).toMatchObject({ county_name: "臺北市", report_month: 12, report_grain_key: "114:12:City000002", official_metrics: { adopt_count: 15 }, quality_flags: ["verified"] });
  });

  it("uses source utilization or derives it only from complete in-shelter and capacity values", () => {
    expect(parseAnimalShelterPressure({
      official_metrics: { fe_sum_count: 81, max_stay_dog_count: 60, max_stay_cat_count: 30 }, county_code: "City000002",
    }).capacity_utilization).toBe(90);
    expect(parseAnimalShelterPressure({
      official_metrics: { fe_sum_count: 81, max_stay_dog_count: 60 }, county_code: "City000002",
    }).capacity_utilization).toBeNull();
    expect(parseAnimalShelterPressure({
      official_metrics: { capacity_utilization: 0.8 }, county_code: "63000",
    }).capacity_utilization).toBe(80);
  });

  it("keeps duplicate-grain metadata and defaults ambiguous rows to false", () => {
    const parsed = parseAnimalShelterPressure({
      county_code: "City000002", revision_index: 2, duplicate_grain_count: 1,
      excluded_ambiguous_grain_count: 3, official_metrics: {}, quality_flags: [],
    });
    expect(parsed).toMatchObject({ revision_index: 2, duplicate_grain_count: 1, excluded_ambiguous_grain_count: 3, is_ambiguous: false });
  });
});
