import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { aggregateInternetHealthRows } from "../../../../data/internetHealthLoader";
import { TelecomStatusCardView } from "../TelecomStatusCard";

const freshNormal = (source: string) => ({
  row_type: "status",
  source_observation_id: `${source}-1`,
  entity_type: "country",
  entity_id: "TW",
  entity_name: "臺灣",
  source,
  evidence_family: "network",
  signal: "reachability",
  reported_status: "normal",
  effective_status: "normal",
  incident_kind: null,
  value: null,
  unit: null,
  baseline_value: null,
  change_ratio: null,
  confidence: "high",
  sample_count: 12,
  observed_at: "2026-08-30T04:00:00Z",
  source_updated_at: "2026-08-30T04:01:00Z",
  collected_at: "2026-08-30T04:02:00Z",
  age_seconds: 60,
  is_stale: false,
  active_incident_id: null,
  incident_status: null,
  metadata: {},
});

const renderCard = (
  summary: ReturnType<typeof aggregateInternetHealthRows>,
  phase: "loading" | "ready" | "error",
) => renderToStaticMarkup(createElement(TelecomStatusCardView, {
  summary, phase, nowTs: 1_788_060_000,
}));

describe("TelecomStatusCardView", () => {
  it("renders missing data as unknown, not a green normal state", () => {
    const html = renderCard(aggregateInternetHealthRows([]), "ready");
    expect(html).toContain("資料不足");
    expect(html).toContain("Cloudflare Radar");
    expect(html).toContain("internet-health-source-cloudflare");
    expect(html).not.toContain("目前正常");
  });

  it("shows normal only with two fresh independent network sources", () => {
    const html = renderCard(
      aggregateInternetHealthRows([freshNormal("cloudflare_radar"), freshNormal("ioda")]),
      "ready",
    );
    expect(html).toContain("目前正常");
    expect(html).toContain("2/3");
    expect(html).toContain("NCDR");
    expect(html).toContain("未通報／無資料");
  });

  it("a refresh error overrides a previous normal snapshot", () => {
    const summary = aggregateInternetHealthRows([freshNormal("cloudflare_radar"), freshNormal("ioda")]);
    const html = renderCard(summary, "error");
    expect(html).toContain("資料不足");
    expect(html).toContain("本次更新失敗");
    expect(html).not.toContain("目前正常");
  });
});
