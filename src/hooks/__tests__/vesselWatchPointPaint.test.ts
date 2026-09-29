import { describe, expect, it } from "vitest";
import { fireEventsPointStroke } from "../useFireEventsLayer";
import { fireLatestPointStroke } from "../useFireLatestLayer";
import { vesselPointPaint } from "../useVesselWatchLayer";

type Expr = number | string | Expr[];

/** 只支援 confidenceAware 用到的 * / case / == / get，夠驗證滑桿倍率與 confidence 淡化的組合。 */
function evaluate(expr: Expr | undefined, props: Record<string, number>): number | string {
  if (expr === undefined) throw new Error("missing operand");
  if (!Array.isArray(expr)) return expr;
  const [op, ...args] = expr;
  if (op === "get") return props[String(args[0])] ?? 0;
  if (op === "==") return evaluate(args[0], props) === evaluate(args[1], props) ? 1 : 0;
  if (op === "case") {
    for (let i = 0; i + 1 < args.length; i += 2) if (evaluate(args[i], props)) return evaluate(args[i + 1], props);
    return evaluate(args[args.length - 1], props);
  }
  if (op === "*") return args.reduce<number>((acc, a) => acc * Number(evaluate(a, props)), 1);
  throw new Error(`unsupported op ${String(op)}`);
}

const fillAt = (opacity: number, props: Record<string, number>) =>
  Number(evaluate(vesselPointPaint(true, opacity)["circle-opacity"] as unknown as Expr, props));

describe("vessel watch point paint", () => {
  it("keeps stale / presumed fading for every slider value", () => {
    for (const slider of [0.2, 0.5, 0.85, 1]) {
      const normal = fillAt(slider, {});
      expect(normal).toBeCloseTo(slider);
      expect(fillAt(slider, { stale: 1 })).toBeLessThan(normal);
      expect(fillAt(slider, { presumed: 1 })).toBeLessThan(normal);
      expect(fillAt(slider, { stale: 1, presumed: 1 })).toBeLessThan(fillAt(slider, { presumed: 1 }));
    }
  });

  it("fades the seam stroke with confidence too", () => {
    const strokeAt = (props: Record<string, number>) =>
      Number(evaluate(vesselPointPaint(false, 0.85)["circle-stroke-opacity"] as unknown as Expr, props));
    expect(strokeAt({ presumed: 1 })).toBeLessThan(strokeAt({}));
  });
});

describe("fire casualty outline", () => {
  it("uses white on dark and #111827 on light; others keep the seam", () => {
    expect(fireEventsPointStroke(true, 1)["circle-stroke-color"]).toEqual(["case", ["get", "casualty"], "#ffffff", "#0a0a14"]);
    expect(fireEventsPointStroke(false, 1)["circle-stroke-color"]).toEqual(["case", ["get", "casualty"], "#111827", "#ffffff"]);
    expect(fireLatestPointStroke(false, 1)["circle-stroke-color"]).toEqual(["case", ["get", "casualty"], "#111827", "#ffffff"]);
  });
});
