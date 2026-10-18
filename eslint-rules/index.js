// 本地 ESLint plugin「pulse」：只放取代既有原始碼守門測試的規則（docs/development-rules.md「自訂 ESLint 規則」）。
import * as css from "./rules/css.js";
import * as design from "./rules/design.js";
import * as guards from "./rules/guards.js";

export default {
  meta: { name: "eslint-plugin-pulse" },
  rules: {
    "design-web-font": design.webFont,
    "design-native-range": design.nativeRange,
    "design-triangle-chevron": design.triangleChevron,
    "design-english-control-label": design.englishControlLabel,
    "design-uppercase-eyebrow": design.uppercaseEyebrow,
    "design-font-data-on-cjk": design.fontDataOnCjk,
    "design-raw-z-index": design.rawZIndex,
    "design-internal-id-display": design.internalIdDisplay,
    "design-css-web-font": css.webFont,
    "design-css-hex-literal": css.hexLiteral,
    "design-css-triangle-chevron": css.triangleChevron,
    "design-css-uppercase-eyebrow": css.uppercaseEyebrow,
    "design-css-raw-z-index": css.rawZIndex,
    "map-ready-tick-deps": guards.mapReadyTickDeps,
    "no-zoom-circle-radius": guards.noZoomCircleRadius,
    "no-hand-rolled-stroke-opacity": guards.noHandRolledStrokeOpacity,
    "no-legacy-radius-helper": guards.noLegacyRadiusHelper,
    "no-fill-outline-color": guards.noFillOutlineColor,
    "monitor-no-manual-polling": guards.monitorNoManualPolling,
    "legend-no-letter-spacing": guards.legendNoLetterSpacing,
    "legend-no-hand-sized-swatch": guards.legendNoHandSizedSwatch,
    "no-current-time-deps": guards.noCurrentTimeDeps,
  },
};
