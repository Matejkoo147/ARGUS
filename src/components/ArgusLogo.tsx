interface ArgusLogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

/** All-seeing emblem — central eye with satellite watchers (Argus Panoptes). */
export function ArgusLogo({ size = 42, className = "", glow = true }: ArgusLogoProps) {
  const id = "argus-glow";
  return (
    <svg
      className={`argus-logo${glow ? " argus-logo--glow" : ""}${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-ring`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#00ff88" />
        </linearGradient>
        <radialGradient id={`${id}-iris`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ff88" />
          <stop offset="55%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#0a2540" />
        </radialGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer ring — perimeter watch */}
      <circle cx="32" cy="32" r="30" stroke={`url(#${id}-ring)`} strokeWidth="1.2" opacity="0.85" />
      <circle cx="32" cy="32" r="27" stroke="#00f0ff" strokeWidth="0.5" opacity="0.35" strokeDasharray="3 5" />

      {/* Corner brackets (HUD) */}
      <path d="M8 14V8h6M56 8h6v6M62 50v6h-6M8 56v-6H2" stroke="#00f0ff" strokeWidth="1" opacity="0.5" />

      {/* Satellite eyes — 8 watchers around the ring */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const cx = 32 + Math.cos(rad) * 21;
        const cy = 32 + Math.sin(rad) * 21;
        return (
          <g key={deg} filter={glow ? `url(#${id}-blur)` : undefined}>
            <ellipse cx={cx} cy={cy} rx="3.2" ry="2.2" fill="#03060d" stroke="#00f0ff" strokeWidth="0.7" opacity="0.9" />
            <circle cx={cx} cy={cy} r="1.1" fill="#00ff88" opacity="0.95" />
          </g>
        );
      })}

      {/* Central all-seeing eye */}
      <g filter={glow ? `url(#${id}-blur)` : undefined}>
        <ellipse cx="32" cy="32" rx="11" ry="8" fill="#03060d" stroke={`url(#${id}-ring)`} strokeWidth="1.2" />
        <circle cx="32" cy="32" r="5.5" fill={`url(#${id}-iris)`} />
        <circle cx="32" cy="32" r="2.2" fill="#03060d" />
        <circle cx="34" cy="30" r="0.9" fill="#00f0ff" opacity="0.9" />
        {/* Upper lid accent */}
        <path d="M21 28 Q32 22 43 28" stroke="#00f0ff" strokeWidth="0.8" fill="none" opacity="0.6" />
        <path d="M21 36 Q32 40 43 36" stroke="#00ff88" strokeWidth="0.5" fill="none" opacity="0.4" />
      </g>
    </svg>
  );
}
