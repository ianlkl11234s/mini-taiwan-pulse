import { describe, expect, it } from "vitest";

const helpersPath = "../../../scripts/research/layer-freshness-helpers.mjs";
type Spec = { schema: string; table: string; time_column: string; filter?: { column: string; value: string } };
const load = async () => await import(/* @vite-ignore */ helpersPath) as {
  snapshotKey: (spec: Spec) => string;
  filterClause: (filter?: { column: string; value: string }) => string | null;
};

describe("layer-freshness helpers", () => {
  it("keeps sibling feeds on one table in separate snapshot keys", async () => {
    const { snapshotKey } = await load();
    const base = { schema: "live", table: "marine_observation_current", time_column: "collected_at" };
    const cwa = snapshotKey({ ...base, filter: { column: "source_network", value: "cwa" } });
    const isohe = snapshotKey({ ...base, filter: { column: "source_network", value: "isohe" } });
    expect(new Set([cwa, isohe, snapshotKey(base)]).size).toBe(3);
    expect(snapshotKey(base)).toBe("live.marine_observation_current.collected_at");
  });

  it("builds a safe where clause and rejects injection", async () => {
    const { filterClause } = await load();
    expect(filterClause(undefined)).toBe("");
    expect(filterClause({ column: "source_network", value: "cwa" })).toBe(" where source_network = 'cwa'");
    expect(filterClause({ column: "source_network", value: "x'; drop table t;--" })).toBeNull();
    expect(filterClause({ column: "Source Network", value: "cwa" })).toBeNull();
  });
});
