/**
 * Backward-compatible re-export.
 * New code should import `useScreen` from `@/platform/web/useScreen.web` directly.
 */
import { useScreen } from "@/platform/web/useScreen.web";

export function useIsMobile() {
  return useScreen().isMobile;
}
