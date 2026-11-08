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
const DEPS_HOOKS = new Set(["useEffect", "useLayoutEffect", "useMemo", "useCallback"]);
const hookName = (callee) =>
  callee.type === "Identifier"
    ? callee.name
    : callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier" && callee.object.name === "React"
      ? callee.property.name
      : null;
const SKIP_KEYS = new Set(["parent", "loc", "range", "start", "end", "type"]);
/**
 * deps 元素是否（含巢狀運算式）引用 currentTime：`currentTime`、`state.currentTime`、`props?.currentTime`、
 * `currentTime + 1`、`f(currentTime)`、`o[currentTime]`。不進入函式本體（參數名可能剛好叫 currentTime）；
 * 物件字面值的非 computed key 不算引用。
 */
function isCurrentTimeRef(node) {
  if (!node || typeof node.type !== "string") return false;
  switch (node.type) {
    case "Identifier":
      return node.name === "currentTime";
    case "MemberExpression":
      if (!node.computed && node.property.name === "currentTime") return true;
      return isCurrentTimeRef(node.object) || (node.computed && isCurrentTimeRef(node.property));
    case "FunctionExpression":
    case "ArrowFunctionExpression":
    case "FunctionDeclaration":
      return false;
    case "Property":
      return (node.computed && isCurrentTimeRef(node.key)) || isCurrentTimeRef(node.value);
  }
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const v = node[key];
    if (Array.isArray(v) ? v.some(isCurrentTimeRef) : isCurrentTimeRef(v)) return true;
  }
  return false;
}

// 只看 React hook 的依賴陣列（第二個參數）；map filter 表達式等一般陣列不算。
export const noCurrentTimeDeps = {
  meta: {
    type: "problem",
    docs: { description: "useEffect／useLayoutEffect／useMemo／useCallback 的 deps 不放 currentTime" },
    schema: [],
    messages: {
      banned:
        "不要把 currentTime 放進 hook 的 deps（每次時間跳動都會重跑）；動態圖層改用 timeStore 訂閱（subscribe／subscribeThrottled／subscribeDate），見 CLAUDE.md §6、docs/development-rules.md §8、docs/TIMELINE_ARCHITECTURE.md",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!DEPS_HOOKS.has(hookName(node.callee))) return;
        const deps = node.arguments[1];
        if (deps?.type !== "ArrayExpression") return;
        for (const el of deps.elements) if (isCurrentTimeRef(el)) context.report({ node: el, messageId: "banned" });
      },
    };
  },
};

// 原 src/data/__tests__/loadingRegistryContract.test.ts（CLAUDE.md §3：非同步載入必註冊 loadingRegistry）。
// 原測試看 RPC 前後 ±10 行有沒有出現 withLoading 字樣；這裡改看語法上是否真的被包住：
// rpc 呼叫在 withLoading(...) 的引數裡，或先存進變數、之後該變數被傳進 withLoading(...)。
const isRpcCall = (node) =>
  (node.callee.type === "Identifier" && node.callee.name === "staticRpc") ||
  (node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "supabase" &&
    node.callee.property.name === "rpc");
const isWithLoadingCall = (node) => node?.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "withLoading";
const insideWithLoading = (node) => {
  for (let n = node.parent; n; n = n.parent) if (isWithLoadingCall(n)) return true;
  return false;
};
/** rpc 呼叫（含後面串接的 .eq()／.select() 等）整串的最外層節點。 */
function chainTop(node) {
  let n = node;
  for (;;) {
    const p = n.parent;
    if (p?.type === "MemberExpression" && p.object === n && p.parent?.type === "CallExpression" && p.parent.callee === p) n = p.parent;
    else if (p?.type === "ChainExpression" || p?.type === "TSAsExpression" || p?.type === "TSNonNullExpression") n = p;
    else return n;
  }
}
/**
 * 最近的具名函式（function 宣告、持有函式的 const、物件方法）。都沒有時（例如 `const f = cachedOnce(async () => …)`
 * 這種包一層的匿名函式）用模組層 const 的名字；真的在頂層才回傳 "<module>"。
 */
function enclosingFunctionName(node) {
  let outerConst = null;
  for (let n = node.parent; n; n = n.parent) {
    if (n.type === "FunctionDeclaration" && n.id) return n.id.name;
    if (n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression") {
      if (n.id) return n.id.name;
      const p = n.parent;
      if (p?.type === "VariableDeclarator" && p.id.type === "Identifier") return p.id.name;
      if ((p?.type === "Property" || p?.type === "MethodDefinition") && !p.computed && p.key.type === "Identifier") return p.key.name;
    }
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier") outerConst = n.id.name;
  }
  return outerConst ?? "<module>";
}

export const loaderRpcWithLoading = {
  meta: {
    type: "problem",
    docs: { description: "loader 的 supabase.rpc／staticRpc 要包 withLoading（或列在 exempt 並寫理由）" },
    schema: [
      {
        type: "object",
        properties: { exempt: { type: "object", additionalProperties: { type: "string", minLength: 1 } } },
        additionalProperties: false,
      },
    ],
    messages: {
      missing:
        "這個 RPC 沒有註冊 loadingRegistry，使用者會看著空白地圖不知道是在載入還是沒資料：" +
        '包成 withLoading("<key>", "<中文標籤>", supabase.rpc(...))（CLAUDE.md §3）。' +
        "若確實不該顯示 LOADING 面板（popup 點開才抓、背景 prefetch、monitor 卡片），把「{{key}}」加進 eslint.config.js 的 LOADER_RPC_EXEMPT 並寫理由。",
      stale: "「{{key}}」已經不需要豁免（已補 withLoading 或函式被刪／改名）：請從 eslint.config.js 的 LOADER_RPC_EXEMPT 移除。",
    },
  },
  create(context) {
    const exempt = context.options[0]?.exempt ?? {};
    const file = context.filename.split(/[\\/]/).pop();
    const hit = new Set();
    const wrapped = (node) => {
      if (insideWithLoading(node)) return true;
      const top = chainTop(node);
      const decl = top.parent;
      if (decl?.type !== "VariableDeclarator" || decl.init !== top || decl.id.type !== "Identifier") return false;
      const variable = context.sourceCode.getDeclaredVariables(decl).find((v) => v.name === decl.id.name);
      return !!variable?.references.some((ref) => ref.identifier !== decl.id && insideWithLoading(ref.identifier));
    };
    return {
      CallExpression(node) {
        if (!isRpcCall(node) || wrapped(node)) return;
        const key = `${file}:${enclosingFunctionName(node)}`;
        if (key in exempt) hit.add(key);
        else context.report({ node, messageId: "missing", data: { key } });
      },
      "Program:exit"(program) {
        for (const key of Object.keys(exempt)) {
          if (key.startsWith(`${file}:`) && !hit.has(key)) context.report({ node: program, messageId: "stale", data: { key } });
        }
      },
    };
  },
};

// 原 src/components/sidebar/__tests__/layerConsistency.test.ts「鐵則 4：select 控件渲染閾值」的否定斷言：
// 桌機 rail、手機 bottom-sheet 與共用 LayersPanel 不自己渲染控制項，一律經 ExpandedControls → ParamControlList，
// 否則「≥4 個 option 用原生 select」的閾值會分岔（development-rules §4a 規則 4）。
export const sidebarSharedParamControls = selectorRule({
  description: "sidebar 不自己掛 ParamControlList 或自己判斷 select 選項數",
  message:
    "sidebar 不要自己掛 <ParamControlList> 或自己依 options.length 決定 select／按鈕列：控制項一律經 ExpandedControls → ParamControlList（sidebar/LayerParamControls.tsx），兩個 sidebar 的閾值才不會分岔（development-rules §4a 規則 4）",
  selectors: ["JSXOpeningElement[name.name='ParamControlList']", "MemberExpression[property.name='length'][object.property.name='options']"],
});
