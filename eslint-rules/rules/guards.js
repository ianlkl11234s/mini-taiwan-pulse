// 取代原本「讀原始碼＋regex」測試的守門規則。套用範圍（哪些檔）在 eslint.config.js。
import { propName, selectorRule, someNode, walk } from "../utils.js";

const isFn = (n) => n?.type === "ArrowFunctionExpression" || n?.type === "FunctionExpression";
const calleeName = (call) =>
  call.callee.type === "Identifier" ? call.callee.name : call.callee.type === "MemberExpression" && !call.callee.computed ? call.callee.property.name : null;

/** `useX(() => {...}, [deps])` 的 deps 陣列；不是這種形狀回傳 null。 */
function hookDeps(call) {
  const args = call.arguments;
  const deps = args[args.length - 1];
  if (args.length < 2 || deps.type !== "ArrayExpression" || !isFn(args[args.length - 2])) return null;
  return deps;
}

const identifiersIn = (root) => {
  const names = new Set();
  walk(root, (n) => {
    if (n.type === "Identifier") names.add(n.name);
    return true;
  });
  return names;
};

// 原 src/hooks/__tests__/mapReadyTickCoverage.test.ts：mapRef.current 變動不觸發 re-render，
// 首載後才就緒的 map 不會讓 effect 重跑 → 圖層永遠建不出來（deep-link 與首載期間手動 toggle）。
export const mapReadyTickDeps = {
  meta: {
    type: "problem",
    docs: { description: "deps 含 mapRef 的 effect 必須同時含 mapTick（useMapReadyTick）" },
    schema: [],
    messages: {
      missing:
        "deps 含 mapRef 但沒有 mapTick：map 在首載後才就緒時 effect 不會重跑，圖層永遠建不出來。" +
        "改成 `const mapTick = useMapReadyTick(mapRef, visible);` 並把 mapTick 放進 deps。",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // useCallback 是呼叫時才讀 mapRef.current，不會因 map 晚就緒而漏建；只看 effect／memo。
        if (calleeName(node) === "useCallback") return;
        const deps = hookDeps(node);
        if (!deps) return;
        const names = identifiersIn(deps);
        if (names.has("mapRef") && !names.has("mapTick") && !names.has("mapRetry")) context.report({ node: deps, messageId: "missing" });
      },
    };
  },
};

const containsZoom = (root) => someNode(root, (n) => n.type === "Literal" && n.value === "zoom");

// 原 src/map/__tests__/hookPointSpec.test.ts「zoom-driven circle radii」ratchet（既有 3 處記在 eslint-suppressions.json）。
export const noZoomCircleRadius = {
  meta: {
    type: "problem",
    docs: { description: "hook／map 的 circle-radius 不隨 zoom 變（R2 固定分階）" },
    schema: [],
    messages: {
      banned: "circle-radius 不要用 zoom 內插；改用 pointRadius(<分階>)（src/map/mapStyleScale.ts，docs/design-system/map-layers.md R2）",
    },
  },
  create(context) {
    return {
      Property(node) {
        if (propName(node) === "circle-radius" && containsZoom(node.value)) context.report({ node, messageId: "banned" });
      },
      CallExpression(node) {
        const [, key, value] = node.arguments;
        if (calleeName(node) === "setPaintProperty" && key?.type === "Literal" && key.value === "circle-radius" && value && containsZoom(value)) {
          context.report({ node, messageId: "banned" });
        }
      },
    };
  },
};

// 原 hookPointSpec「does not hand-roll the stroke opacity formula」。
export const noHandRolledStrokeOpacity = {
  meta: {
    type: "problem",
    docs: { description: "不手寫 Math.min(1, POINT_STROKE.opacity …) 描邊透明度公式" },
    schema: [],
    messages: { banned: "描邊透明度不要手寫 Math.min(1, POINT_STROKE.opacity …)；改用 pointStrokePaint()（src/map/mapStyleScale.ts）" },
  },
  create(context) {
    return {
      CallExpression(node) {
        const c = node.callee;
        if (c.type !== "MemberExpression" || c.object.name !== "Math" || c.property.name !== "min") return;
        const [a, b] = node.arguments;
        if (a?.type !== "Literal" || a.value !== 1 || !b) return;
        if (/^POINT_STROKE\.opacity\b/.test(context.sourceCode.getText(b))) context.report({ node, messageId: "banned" });
      },
    };
  },
};

// 原 hookPointSpec「no legacy radius helpers remain in hook point files」。
export const noLegacyRadiusHelper = selectorRule({
  description: "hook／map 不再用舊的半徑 helper",
  message: "舊半徑 helper 已淘汰：點的半徑改用 pointRadius(<分階>)（src/map/mapStyleScale.ts）；依資料決定半徑的 B 類圖層才例外",
  selectors: ["Identifier[name=/^(scaledRadius|dotRadiusExpression|CIRCLE_RADIUS|RADIUS_EXPR|marineObservationRadiusExpression)$/]"],
});

// 原 src/map/__tests__/hookLineFillSpec.test.ts「hook fill-outline-color ratchet remains zero」。
export const noFillOutlineColor = selectorRule({
  description: "hook 的 fill 不用 fill-outline-color",
  message: "面外框不要用 fill-outline-color；改成獨立 line 子圖層並走 hookLinePaint()（docs/design-system/map-layers.md F-2）",
  selectors: ["Property[key.value='fill-outline-color']"],
});

// 原 src/components/intel/monitor/__tests__/monitorResourceCards.test.ts 的否定斷言。
export const monitorNoManualPolling = selectorRule({
  description: "監控卡片不自己輪詢",
  message: "監控卡片不自己 setInterval／let cancelled；輪詢、取消與狀態一律走 useMonitorResource ＋ MonitorDataStatus",
  selectors: [
    "CallExpression[callee.name='setInterval']",
    "CallExpression[callee.property.name='setInterval']",
    "VariableDeclaration[kind='let'] > VariableDeclarator[id.name='cancelled']",
  ],
});

// 原 src/components/legend/__tests__/legendKit.test.ts「LegendPanel 收斂 ratchet」。
export const legendNoLetterSpacing = selectorRule({
  description: "圖例標題不手寫 letterSpacing: 1 的英文大寫樣式",
  message: "圖例標題不要手寫 letterSpacing: 1；改用 legendKit 的 <LegendTitle zh en>（中文在前、英文小字在後）",
  selectors: ["Property[key.name='letterSpacing'][value.raw=/^1(\\.|$)/]"],
});

export const legendNoHandSizedSwatch = selectorRule({
  description: "圖例不手寫色票尺寸 { width: N, height: N }",
  message: "新圖例不要手寫色票尺寸 { width: N, height: N }；改用 legendKit 的 SwatchDot／SwatchSquare／SwatchLine 等",
  selectors: ["Property[key.name='width'][value.raw=/^\\d/] + Property[key.name='height'][value.raw=/^\\d/]"],
});

// 原 src/lib/__tests__/dayPrefetchScope.test.ts：日期一律從 timeStore 取（CLAUDE.md §6）。
export const noCurrentTimeDeps = selectorRule({
  description: "陣列（React deps）不放 currentTime",
  message: "不要把 currentTime 放進陣列／deps；日期走 timeStore 訂閱（docs/development-rules.md §8、docs/TIMELINE_ARCHITECTURE.md）",
  selectors: ["ArrayExpression Identifier[name='currentTime']"],
});
