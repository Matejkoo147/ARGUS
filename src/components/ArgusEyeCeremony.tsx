import { useEffect, useId } from "react";

export type CeremonyMode = "boot" | "shutdown";

export const BOOT_MS = 3400;
export const SHUTDOWN_MS = 2600;

interface ArgusEyeCeremonyProps {
  mode: CeremonyMode;
  onComplete: () => void;
}

/**
 * Full-viewport boot / shutdown ceremony — same geometry & palette as ArgusLogo.
 * Boot: watchers wake → lids open → iris blooms → fade to UI.
 * Shutdown: gaze holds → lids close → nodes extinguish → black.
 */
export function ArgusEyeCeremony({ mode, onComplete }: ArgusEyeCeremonyProps) {
  const uid = useId().replace(/:/g, "");
  const duration = mode === "boot" ? BOOT_MS : SHUTDOWN_MS;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onComplete();
      return;
    }
    const t = window.setTimeout(onComplete, duration);
    return () => window.clearTimeout(t);
  }, [duration, onComplete]);

  return (
    <div
      className={`argus-ceremony argus-ceremony--${mode}`}
      role="presentation"
      aria-hidden
    >
      <div className="argus-ceremony__vignette" />
      <div className="argus-ceremony__scan" />

      <svg
        className="argus-ceremony__mark"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`${uid}-frame`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8ec5ff" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#00e5ff" />
            <stop offset="100%" stopColor="#ff1a4b" stopOpacity="0.85" />
          </linearGradient>
          <radialGradient id={`${uid}-iris`} cx="50%" cy="48%" r="50%">
            <stop offset="0%" stopColor="#00ffe0" />
            <stop offset="55%" stopColor="#0099bb" />
            <stop offset="100%" stopColor="#051018" />
          </radialGradient>
          <radialGradient id={`${uid}-pupil`} cx="45%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#ff0033" />
            <stop offset="70%" stopColor="#4a0010" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
          <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer watch ring — draws on boot / fades on shutdown */}
        <circle
          className="argus-ceremony__ring"
          cx="32"
          cy="32"
          r="29"
          stroke={`url(#${uid}-frame)`}
          strokeWidth="1.4"
          fill="none"
        />
        <circle
          className="argus-ceremony__ring-dash"
          cx="32"
          cy="32"
          r="25.5"
          stroke="#00e5ff"
          strokeWidth="0.45"
          fill="none"
          strokeDasharray="2 6"
        />

        {/* Perimeter watchers — N E S W */}
        {(
          [
            [32, 6],
            [58, 32],
            [32, 58],
            [6, 32],
          ] as const
        ).map(([cx, cy], i) => (
          <g key={i} className={`argus-ceremony__node argus-ceremony__node--${i}`}>
            <circle cx={cx} cy={cy} r="2.2" fill="#020408" stroke="#00e5ff" strokeWidth="0.65" />
            <circle className="argus-ceremony__node-dot" cx={cx} cy={cy} r="0.75" fill="#ff1a4b" />
          </g>
        ))}

        {/* Central eye */}
        <g className="argus-ceremony__eye" filter={`url(#${uid}-glow)`}>
          <ellipse
            className="argus-ceremony__sclera"
            cx="32"
            cy="32"
            rx="13"
            ry="9.5"
            fill="#020408"
            stroke={`url(#${uid}-frame)`}
            strokeWidth="1.1"
          />

          <g className="argus-ceremony__gaze">
            <circle className="argus-ceremony__iris" cx="32" cy="32" r="6.2" fill={`url(#${uid}-iris)`} />
            <circle className="argus-ceremony__pupil" cx="32" cy="32" r="2.8" fill={`url(#${uid}-pupil)`} />
            <circle className="argus-ceremony__catch" cx="33.2" cy="30.5" r="0.85" fill="#ffffff" opacity="0.55" />
          </g>

          {/* Lids — translate toward midline when closed */}
          <path
            className="argus-ceremony__lid argus-ceremony__lid--upper"
            d="M19 29 Q32 21 45 29"
            stroke="#00e5ff"
            strokeWidth="1.15"
            fill="none"
            strokeLinecap="round"
          />
          <path
            className="argus-ceremony__lid argus-ceremony__lid--lower"
            d="M20 35 Q32 38 44 35"
            stroke="#ff1a4b"
            strokeWidth="0.7"
            fill="none"
            strokeLinecap="round"
            opacity="0.75"
          />
          {/* Closed slit accent (visible while lids meet) */}
          <line
            className="argus-ceremony__slit"
            x1="20"
            y1="32"
            x2="44"
            y2="32"
            stroke="#00e5ff"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </g>
      </svg>

      <div className="argus-ceremony__wordmark">
        <span className="argus-ceremony__title">ARGUS</span>
        <span className="argus-ceremony__tag">
          {mode === "boot" ? "awakening perimeter watch" : "entering standby"}
        </span>
      </div>
    </div>
  );
}
