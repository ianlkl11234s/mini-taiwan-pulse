import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { GlobalEventsList } from "../GlobalEventsList";
import { DARK_FEATURE, LIGHT_FEATURE } from "../../featureInfo/featureTheme";
import { globalEventsViewStore } from "../../../state/globalEventsViewStore";
import { parseGlobalEventRecord } from "../../../data/globalEventsLoader";

describe("Global Events list contrast", () => {
  afterEach(() => globalEventsViewStore.set({ entries: [], status: "idle", message: null, windowLabel: "最近七天" }));
  it("uses explicit theme text and border colors, with 11px list and action text", () => {
    globalEventsViewStore.set({ entries: [parseGlobalEventRecord({ event_id: "event", geometry: { type: "Point", coordinates: [50, 25] } })], status: "ready", message: null, windowLabel: "最近七天" });
    const dark = renderToStaticMarkup(createElement(GlobalEventsList, { palette: DARK_FEATURE }));
    const light = renderToStaticMarkup(createElement(GlobalEventsList, { palette: LIGHT_FEATURE }));
    expect(dark).toContain(`font-size:11px;color:${DARK_FEATURE.textStrong}`);
    expect(light).toContain(`font-size:11px;color:${LIGHT_FEATURE.textStrong}`);
    expect(dark).toContain(`border-top:1px solid ${DARK_FEATURE.border}`);
    expect(dark).not.toContain("font-size:9px");
    expect(dark).not.toContain("color:inherit");
    expect(dark.match(/font-size:11px/g)).toHaveLength(2);
  });
});
