import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArgusEyeCeremony,
  BOOT_MS,
  SHUTDOWN_MS,
  type CeremonyMode,
} from "./ArgusEyeCeremony";

type CeremonyContextValue = {
  /** Play eye-close, then run `after` (e.g. logout). */
  runShutdown: (after?: () => void) => void;
  /** Replay boot or shutdown for Settings preview (does not navigate). */
  runPreview: (mode: CeremonyMode) => void;
  busy: boolean;
};

const CeremonyContext = createContext<CeremonyContextValue | null>(null);

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CeremonyProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<CeremonyMode | null>(() =>
    prefersReducedMotion() ? null : "boot"
  );
  const afterRef = useRef<(() => void) | null>(null);
  const busy = mode !== null;

  const finish = useCallback(() => {
    const next = afterRef.current;
    afterRef.current = null;
    setMode(null);
    next?.();
  }, []);

  const runShutdown = useCallback((after?: () => void) => {
    if (prefersReducedMotion()) {
      after?.();
      return;
    }
    afterRef.current = after ?? null;
    setMode("shutdown");
  }, []);

  const runPreview = useCallback((previewMode: CeremonyMode) => {
    if (prefersReducedMotion()) return;
    afterRef.current = null;
    setMode(previewMode);
  }, []);

  const value = useMemo(
    () => ({ runShutdown, runPreview, busy }),
    [runShutdown, runPreview, busy]
  );

  return (
    <CeremonyContext.Provider value={value}>
      {children}
      {mode && <ArgusEyeCeremony mode={mode} onComplete={finish} />}
    </CeremonyContext.Provider>
  );
}

export function useCeremony(): CeremonyContextValue {
  const ctx = useContext(CeremonyContext);
  if (!ctx) {
    throw new Error("useCeremony must be used within CeremonyProvider");
  }
  return ctx;
}

export { BOOT_MS, SHUTDOWN_MS };
