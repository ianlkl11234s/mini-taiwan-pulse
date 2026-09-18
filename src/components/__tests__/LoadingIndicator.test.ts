import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BORDER, COLORS, SURFACE } from "../../styles/designTokens";
import { useLoadingTasks } from "../../hooks/useLoadingTasks";
import { LoadingIndicator } from "../LoadingIndicator";

vi.mock("../../hooks/useLoadingTasks", () => ({
  useLoadingTasks: vi.fn(),
}));

const mockedUseLoadingTasks = vi.mocked(useLoadingTasks);

describe("LoadingIndicator", () => {
  beforeEach(() => mockedUseLoadingTasks.mockReset());

  it("does not render without an active loading task", () => {
    mockedUseLoadingTasks.mockReturnValue([]);
    expect(renderToStaticMarkup(createElement(LoadingIndicator))).toBe("");
  });

  it("uses the shared neutral panel tokens instead of the old blue surface", () => {
    mockedUseLoadingTasks.mockReturnValue([{ id: "example", label: "載入圖層" }]);
    const html = renderToStaticMarkup(createElement(LoadingIndicator));

    expect(html).toContain(`background: ${SURFACE.panel}`);
    expect(html).toContain(`border: 1px solid ${BORDER.panel}`);
    expect(html).toContain(`color: ${COLORS.textStrong}`);
    expect(html).not.toContain("rgba(15, 23, 42, 0.85)");
    expect(html).not.toContain("#93c5fd");
  });

  it("uses an opaque light surface with dark text on light basemaps", () => {
    mockedUseLoadingTasks.mockReturnValue([{ id: "example", label: "載入圖層" }]);
    const html = renderToStaticMarkup(
      createElement(LoadingIndicator, { isDarkTheme: false }),
    );

    expect(html).toContain("background: rgba(255, 255, 255, 0.96)");
    expect(html).toContain("border: 1px solid rgba(15, 23, 42, 0.18)");
    expect(html).toContain("color: #111827");
    expect(html).not.toContain(`background: ${SURFACE.panel}`);
  });
});
