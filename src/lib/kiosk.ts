const KIOSK_QUERY = "kiosk";
const KIOSK_STORAGE_KEY = "argus-kiosk-mode";

/**
 * True when this browser session is the Pi touch kiosk (or forced via ?kiosk=1).
 * Laptop / phone browsers without the flag do not auto-play the awaken ceremony.
 */
export function isKioskMode(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get(KIOSK_QUERY);
    if (flag === "1" || flag === "true") {
      sessionStorage.setItem(KIOSK_STORAGE_KEY, "1");
      return true;
    }
    if (flag === "0" || flag === "false") {
      sessionStorage.removeItem(KIOSK_STORAGE_KEY);
      return false;
    }
  } catch {
    /* ignore */
  }

  try {
    if (sessionStorage.getItem(KIOSK_STORAGE_KEY) === "1") return true;
  } catch {
    /* ignore */
  }

  return false;
}
