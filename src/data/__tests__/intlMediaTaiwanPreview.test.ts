import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchIntlMediaTaiwan,
  isIntlMediaPreviewEnabled,
  normalizeIntlMediaTaiwanRows,
  visibleIntlMediaTaiwan,
} from "../intlMediaTaiwanLoader";
import {
  INTL_MEDIA_TAIWAN_PREVIEW_EVALUATION_IDS,
  intlMediaTaiwanPreviewRows,
} from "../__fixtures__/intlMediaTaiwanPreview";

afterEach(() => vi.unstubAllGlobals());

describe("international media development preview", () => {
  it("requires both the exact query flag and a development build", () => {
    expect(isIntlMediaPreviewEnabled("?intlMediaPreview=1", true)).toBe(true);
    expect(isIntlMediaPreviewEnabled("?intlMediaPreview=0", true)).toBe(false);
    expect(isIntlMediaPreviewEnabled("?intlMediaPreview=1", false)).toBe(false);
  });

  it("contains exactly the nine joined study samples without summaries or reasons", () => {
    expect(intlMediaTaiwanPreviewRows.map((row) => row.evaluation_id)).toEqual(
      INTL_MEDIA_TAIWAN_PREVIEW_EVALUATION_IDS,
    );
    expect(intlMediaTaiwanPreviewRows).toHaveLength(9);
    for (const row of intlMediaTaiwanPreviewRows) {
      expect(row.summary_zh).toBeNull();
      expect(row).not.toHaveProperty("reason");
      expect(row).not.toHaveProperty("article_body");
      expect(row).not.toHaveProperty("quotation");
    }
  });

  it("uses only reviewed registry-v2 source locations", () => {
    const rows = new Map(
      intlMediaTaiwanPreviewRows.map((row) => [row.evaluation_id, row]),
    );
    expect(rows.get(110)).toMatchObject({
      source_country: "UK",
      source_city: "London",
      source_location_method: "outlet_registry",
    });
    expect(rows.get(147)).toMatchObject({
      source_country: "HK",
      source_city: "Hong Kong",
      source_location_method: "outlet_registry",
    });
    expect(rows.get(699)).toMatchObject({
      source_country: "JP",
      source_city: "Tokyo",
      source_location_method: "outlet_registry",
    });
    for (const id of [106, 369, 623, 769]) {
      expect(rows.get(id)).toMatchObject({
        source_country: null,
        source_city: null,
        source_location_method: null,
      });
    }
  });

  it("loads the fixture before the RPC path and keeps old samples visible", async () => {
    vi.stubGlobal("window", { location: { search: "?intlMediaPreview=1" } });
    const items = await fetchIntlMediaTaiwan();
    expect(items).toHaveLength(9);
    expect(items.every((item) => item.summaryZh == null)).toBe(true);
    expect(visibleIntlMediaTaiwan(items, 2_000_000_000, 2_000_000_100, true)).toBe(items);
    expect(visibleIntlMediaTaiwan(items, 2_000_000_000, 2_000_000_100)).toEqual([]);
  });

  it("normalizes every frozen row through the production RPC contract", () => {
    const items = normalizeIntlMediaTaiwanRows(intlMediaTaiwanPreviewRows);
    expect(items).toHaveLength(9);
    expect(items.map((item) => item.id)).toEqual(expect.arrayContaining([
      "preview-20", "preview-106", "preview-110", "preview-147", "preview-369",
      "preview-623", "preview-687", "preview-699", "preview-769",
    ]));
  });
});
