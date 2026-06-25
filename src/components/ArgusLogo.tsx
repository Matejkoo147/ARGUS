interface ArgusLogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

/** Panopticon emblem — one dominant all-seeing eye, four perimeter watchers. */
export function ArgusLogo({ size = 42, className = "", glow = true }: ArgusLogoProps) {
  const uid = "argus";
  return (
    <svg
      className={`argus-logo${glow ? " argus-logo--glow" : ""}${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ARGUS — all-seeing guardian"
      role="img"
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
        <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer watch ring */}
      <circle cx="32" cy="32" r="29" stroke={`url(#${uid}-frame)`} strokeWidth="1.4" opacity="0.95" />
      <circle cx="32" cy="32" r="25.5" stroke="#00e5ff" strokeWidth="0.45" opacity="0.22" strokeDasharray="2 6" />

      {/* Vision rays — subtle */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 32 + Math.cos(rad) * 14;
        const y1 = 32 + Math.sin(rad) * 10;
        const x2 = 32 + Math.cos(rad) * 27;
        const y2 = 32 + Math.sin(rad) * 20;
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#00e5ff"
            strokeWidth="0.35"
            opacity="0.18"
          />
        );
      })}

      {/* Perimeter watcher nodes — N E S W */}
      {[
        [32, 6],
        [58, 32],
        [32, 58],
        [6, 32],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="2.2" fill="#020408" stroke="#00e5ff" strokeWidth="0.65" opacity="0.75" />
          <circle cx={cx} cy={cy} r="0.75" fill="#ff1a4b" opacity="0.95" />
        </g>
      ))}

      {/* Central eye */}
      <g filter={glow ? `url(#${uid}-glow)` : undefined}>
        <ellipse cx="32" cy="32" rx="13" ry="9.5" fill="#020408" stroke={`url(#${uid}-frame)`} strokeWidth="1.1" />
        <ellipse cx="32" cy="32" rx="11.5" ry="8.2" fill="none" stroke="#1a3048" strokeWidth="0.5" />
        <circle cx="32" cy="32" r="6.2" fill={`url(#${uid}-iris)`} />
        <circle cx="32" cy="32" r="2.8" fill={`url(#${uid}-pupil)`} />
        <circle cx="33.2" cy="30.5" r="0.85" fill="#ffffff" opacity="0.55" />
        {/* Upper lid — predatory arc */}
        <path
          d="M19 29 Q32 21 45 29"
          stroke="#00e5ff"
          strokeWidth="1"
          fill="none"
          opacity="0.75"
          strokeLinecap="round"
        />
        <path
          d="M20 35 Q32 38 44 35"
          stroke="#ff1a4b"
          strokeWidth="0.55"
          fill="none"
          opacity="0.45"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
