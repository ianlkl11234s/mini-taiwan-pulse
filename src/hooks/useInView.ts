/**
 * useInView — IntersectionObserver gate
 *
 * 用途：把昂貴的子節點（iframe、Three.js scene）「延後到第一次進入視窗」才掛。
 * 一旦進入就鎖定為 true，不再卸載 — 避免反覆 mount/unmount 帶來的 jank。
 *
 * 用法：
 *   const ref = useRef<HTMLDivElement>(null);
 *   const visible = useInView(ref, { rootMargin: "200px" });
 *   return <div ref={ref}>{visible && <iframe ... />}</div>;
 */
import { useEffect, useRef, useState, type RefObject } from "react";

export function useInView(
  ref: RefObject<Element | null>,
  options?: IntersectionObserverInit,
): boolean {
  const [visible, setVisible] = useState(false);
  const lockedRef = useRef(false);
  useEffect(() => {
    if (lockedRef.current) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      lockedRef.current = true;
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            lockedRef.current = true;
            setVisible(true);
            io.disconnect();
            return;
          }
        }
      },
      { rootMargin: "200px", threshold: 0.01, ...options },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, options]);
  return visible;
}
