import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

export function useScreen() {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    width,
    isMobile: width < MOBILE_BREAKPOINT,
    isTablet: width >= MOBILE_BREAKPOINT && width < 1024,
    isDesktop: width >= 1024,
  };
}
