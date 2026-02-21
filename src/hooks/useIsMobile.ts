import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < MOBILE_BREAKPOINT,
  );
  const [isLandscape, setIsLandscape] = useState(
    () => window.innerWidth > window.innerHeight,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const orientMql = window.matchMedia("(orientation: landscape)");

    const handleMobile = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const handleOrient = (e: MediaQueryListEvent) => setIsLandscape(e.matches);

    mql.addEventListener("change", handleMobile);
    orientMql.addEventListener("change", handleOrient);
    return () => {
      mql.removeEventListener("change", handleMobile);
      orientMql.removeEventListener("change", handleOrient);
    };
  }, []);

  return { isMobile, isLandscape };
}
