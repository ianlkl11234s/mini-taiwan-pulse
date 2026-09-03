import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlobalEventPanel } from "../globalClimatePanels";
import { DARK_FEATURE, FeatureThemeProvider, LIGHT_FEATURE } from "../featureTheme";

const props = Object.freeze({
  title_zh_tw: "來源提供的事件標題", summary_zh_tw: "來源提供的摘要，不改写內容。",
  research_status: "ai_assessed", assessment_status: "assessed", category: "policy", severity: 2,
  taiwan_impact_zh_tw: "暫無已知直接影響", reason_zh_tw: "依據來源內容判斷",
  place_name: "來源地點", location_kind: "country_center", source_kind: "gdelt_metadata_mention",
  valid_from: "2026-09-02T08:30:00Z", location_source: "https://news.example.org/long/path?article=123&ref=source",
  confidence: 0.97, decision: "drop_noise", taiwan_relationship: "unrelated", original_lng: 12.34567, original_lat: 45.67891,
  display_offset: true, display_from: "2026-09-03T08:30:00Z", display_to: "2026-09-04T08:30:00Z",
  relation_kind: "association", location_lineage: "internal-lineage", publication_no: 3, lifecycle_state: "published",
  candidate_assessments: JSON.stringify([{ title: "內部候選甲" }, { title: "內部候選乙" }]),
});
const render = (values: Record<string, unknown> = props) => renderToStaticMarkup(createElement(GlobalEventPanel, { props: values }));

describe("Global Events concise popup", () => {
  it("shows only the requested fields in order, with 18px title and unchanged event content", () => {
    const markup = render();
    const labels = ["事件", "查證狀態", "摘要", "分類／嚴重度", "臺灣影響", "判斷理由", "地點", "落點語意", "來源收集時間", "位置來源"];
    const positions = labels.map((label) => markup.indexOf(`>${label}<`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(markup).toMatch(/<h3[^>]*font-size:18px[^>]*>來源提供的事件標題<\/h3>/);
    expect(markup).toContain(props.summary_zh_tw);
    expect(markup).toContain("政策 · 重大");
    expect(markup).toContain("新聞地理提及的概略位置，未核實精確發生地");
    for (const hidden of ["AI 判斷信心", "Qwen 分類", "臺灣關聯", "原始位置座標", "畫面避讓", "時間軸顯示", "位置依據", "關聯線", "生命週期", "發布版本", "97%", "drop_noise", "unrelated", "12.34567", "internal-lineage", "內部候選甲"]) {
      expect(markup).not.toContain(hidden);
    }
    expect(props.confidence).toBe(0.97);
    expect(props.location_lineage).toBe("internal-lineage");
  });

  it("labels source by hostname while preserving the exact URL and safe external-link attributes", () => {
    const markup = render();
    expect(markup).toContain('href="https://news.example.org/long/path?article=123&amp;ref=source"');
    expect(markup).toContain('target="_blank" rel="noopener noreferrer"');
    expect(markup).toContain(">news.example.org</a>");
    for (const location_source of ["javascript:alert(1)", "data:text/html,unsafe", "https://user:password@news.example.org", "internal/path.json#/places/0", null]) {
      expect(render({ ...props, location_source })).not.toContain("<a ");
    }
  });

  it("retains pending/researched status and never presents formal event time as collection time", () => {
    expect(render({ ...props, assessment_status: "pending" })).toContain("待 AI 判斷（尚未研究確認）");
    const formal = render({ ...props, research_status: "published" });
    expect(formal).toContain("已研究並正式發布");
    expect(formal).toMatch(/>來源收集時間<\/span><span[^>]*>—<\/span>/);
    const candidate = render();
    expect(candidate).not.toMatch(/>來源收集時間<\/span><span[^>]*>—<\/span>/);
    expect(render({ ...props, research_status: "published", observed_at: props.valid_from })).not.toMatch(/>來源收集時間<\/span><span[^>]*>—<\/span>/);
  });

  it("uses the existing dark/light theme palette without changing other panels", () => {
    for (const palette of [DARK_FEATURE, LIGHT_FEATURE]) {
      const markup = renderToStaticMarkup(createElement(FeatureThemeProvider, { palette, children: createElement(GlobalEventPanel, { props }) }));
      expect(markup).toContain(`color:${palette.textStrong};font-size:18px`);
      expect(markup).toContain(`color:${palette.link}`);
      expect(markup).not.toContain("color:inherit");
    }
  });
});
