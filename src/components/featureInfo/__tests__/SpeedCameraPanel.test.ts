import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpeedCameraPanel } from "../policeJusticePanels";

// 資料的 facility_subtype 實際值（speed_cameras_20260824）：闖紅燈、平交道不帶 speed_camera_ 前綴（TWL-3）
describe("測速照相 popup 標題依類型", () => {
  const title = (facility_subtype: string) => renderToStaticMarkup(createElement(SpeedCameraPanel, { props: { facility_subtype } }));
  it.each([
    ["red_light_camera", "闖紅燈"],
    ["railway_crossing_camera", "鐵路平交道"],
    ["speed_camera_general", "一般測速"],
    ["speed_camera_freeway", "國道測速"],
  ])("%s → %s", (sub, label) => {
    expect(title(sub)).toContain(label);
  });
  it("未知類型退回泛稱", () => {
    expect(title("unknown")).toContain("測速照相");
  });
});
