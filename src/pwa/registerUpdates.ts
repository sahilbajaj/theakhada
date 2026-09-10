import { registerSW } from "virtual:pwa-register";
import { Capacitor } from "@capacitor/core";

let registration: ServiceWorkerRegistration | undefined;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

if (!Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, r) {
      registration = r;
    },
    onNeedRefresh() {
      void updateSW?.(true);
    },
  });
}

export function checkForUpdate() {
  void registration?.update();
}
