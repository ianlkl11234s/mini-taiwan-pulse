import { useCallback, useEffect, useReducer, useRef } from "react";

/**
 * TC3 時間軸「收合膠囊 ↔ 展開卡片」狀態機（docs/design-system.md §5.24）。
 *
 * 展開的理由（hold）：滑鼠在上面、鍵盤 focus 在裡面、正在拖曳刻度軸、日期面板開著。
 * - 任何一個 hold 成立 → expanded。
 * - 全部解除 → closing，2 秒後（timeout）→ collapsed；期間任何 hold 回來就取消。
 * - 點膠囊（activate，觸控用）→ 直接展開；沒有 hold 時同樣走 closing 倒數。
 * 純函式，不讀時間、不訂閱 timeStore。
 */
export type ExpandPhase = "collapsed" | "expanded" | "closing";

export interface ExpandState {
  phase: ExpandPhase;
  hover: boolean;
  focusWithin: boolean;
  dragging: boolean;
  popupOpen: boolean;
}

export type ExpandEvent =
  | { type: "pointerEnter" }
  | { type: "pointerLeave" }
  | { type: "focusIn" }
  | { type: "focusOut" }
  | { type: "dragStart" }
  | { type: "dragEnd" }
  | { type: "popup"; open: boolean }
  | { type: "activate" }
  | { type: "timeout" };

/** 移出且 focus 離開後多久收合 */
export const COLLAPSE_DELAY_MS = 2000;

export const INITIAL_EXPAND_STATE: ExpandState = {
  phase: "collapsed",
  hover: false,
  focusWithin: false,
  dragging: false,
  popupOpen: false,
};

export function isHeld(s: ExpandState): boolean {
  return s.hover || s.focusWithin || s.dragging || s.popupOpen;
}

function settle(next: ExpandState, prevPhase: ExpandPhase): ExpandState {
  if (isHeld(next)) return { ...next, phase: "expanded" };
  // 沒有 hold：收合中維持收合，展開中開始倒數
  return { ...next, phase: prevPhase === "collapsed" ? "collapsed" : "closing" };
}

export function expandReducer(state: ExpandState, event: ExpandEvent): ExpandState {
  switch (event.type) {
    case "pointerEnter":
      return settle({ ...state, hover: true }, state.phase);
    case "pointerLeave":
      return settle({ ...state, hover: false }, state.phase);
    case "focusIn":
      return settle({ ...state, focusWithin: true }, state.phase);
    case "focusOut":
      return settle({ ...state, focusWithin: false }, state.phase);
    case "dragStart":
      return settle({ ...state, dragging: true }, state.phase);
    case "dragEnd":
      return settle({ ...state, dragging: false }, state.phase);
    case "popup":
      return settle({ ...state, popupOpen: event.open }, state.phase);
    case "activate":
      return settle(state, "expanded");
    case "timeout":
      if (state.phase !== "closing" || isHeld(state)) return state;
      return { ...state, phase: "collapsed" };
  }
}

/** 展開狀態：closing 倒數期間仍算展開（畫面還是卡片） */
export function isExpanded(s: ExpandState): boolean {
  return s.phase !== "collapsed";
}

/**
 * 這個 focus 算不算 hold：滑鼠／觸控點按鈕或拖曳刻度軸留下的 focus 不算
 * （否則點過播放鍵、拖過軸後卡片永遠不收；TimeAxis 拖曳時會以程式 focus 自己，
 * Chrome 會把它當成 :focus-visible，所以改看最後一次輸入是不是指標）。
 * 鍵盤 Tab 進來的 focus、select／input（原生下拉開著時一定有 focus）才算。
 */
function isHoldingFocus(target: EventTarget | null, lastInputWasPointer: boolean): boolean {
  if (!(target instanceof Element)) return false;
  if (target.matches("select, input")) return true;
  return !lastInputWasPointer;
}

/**
 * 把狀態機接到 DOM。回傳根節點要掛的事件，以及給 TimeAxis／日期面板用的 dispatch。
 * `alwaysExpanded`（手機）時固定展開、不倒數。
 * 計時器 effect 只依賴 phase，不依賴 currentTime（CLAUDE.md §6）。
 */
export function useTimelineExpand(alwaysExpanded: boolean) {
  const [state, dispatch] = useReducer(expandReducer, INITIAL_EXPAND_STATE);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastInputWasPointerRef = useRef(false);

  // 記錄最後一次輸入是指標還是鍵盤（document 層，才能涵蓋從卡片外 Tab 進來的情況）
  useEffect(() => {
    const onPointer = () => { lastInputWasPointerRef.current = true; };
    const onKey = () => { lastInputWasPointerRef.current = false; };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);

  useEffect(() => {
    if (state.phase !== "closing") return;
    const timer = window.setTimeout(() => dispatch({ type: "timeout" }), COLLAPSE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  const onFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (isHoldingFocus(e.target, lastInputWasPointerRef.current)) dispatch({ type: "focusIn" });
  }, []);
  const onBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) {
      // focus 仍在卡片內：依新焦點決定是否仍算 hold
      dispatch({ type: isHoldingFocus(next, lastInputWasPointerRef.current) ? "focusIn" : "focusOut" });
      return;
    }
    dispatch({ type: "focusOut" });
  }, []);

  const rootHandlers = {
    ref: rootRef,
    onPointerEnter: (e: React.PointerEvent<HTMLDivElement>) => { if (e.pointerType === "mouse") dispatch({ type: "pointerEnter" }); },
    onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => { if (e.pointerType === "mouse") dispatch({ type: "pointerLeave" }); },
    onFocus,
    onBlur,
  };

  return {
    expanded: alwaysExpanded || isExpanded(state),
    state,
    dispatch,
    rootRef,
    rootHandlers,
    onDragChange: (dragging: boolean) => dispatch({ type: dragging ? "dragStart" : "dragEnd" }),
    setPopupOpen: (open: boolean) => dispatch({ type: "popup", open }),
    activate: () => dispatch({ type: "activate" }),
  };
}
