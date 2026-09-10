import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { checkForUpdate } from "@/pwa/registerUpdates";

const DEBOUNCE_MS = 30_000;

export function usePwaUpdates() {
  const location = useLocation();
  const lastCheckedAt = useRef(0);

  const maybeCheck = () => {
    const now = Date.now();
    if (now - lastCheckedAt.current < DEBOUNCE_MS) return;
    lastCheckedAt.current = now;
    checkForUpdate();
  };

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    maybeCheck();
  }, [location.pathname]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeCheck();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
}
