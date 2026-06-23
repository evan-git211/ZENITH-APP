interface ZenithLogoProps {
  size?: number;
  className?: string;
}

export function ZenithLogo({ size = 32, className = '' }: ZenithLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="zl-main" x1="20" y1="5" x2="20" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="zl-face" x1="20" y1="12" x2="20" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="zl-secondary" x1="8" y1="18" x2="8" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#92400E" stopOpacity="0.5" />
        </linearGradient>
        <filter id="zl-glow">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Secondary peak (left, shorter) */}
      <polygon
        points="8,18 14,33 2,33"
        fill="url(#zl-secondary)"
      />
      {/* Secondary peak face highlight */}
      <polygon
        points="8,18 11,33 5,33"
        fill="rgba(254,243,199,0.12)"
      />

      {/* Main peak */}
      <polygon
        points="20,5 34,33 6,33"
        fill="url(#zl-main)"
      />
      {/* Main peak lit face */}
      <polygon
        points="20,5 27,33 13,33"
        fill="url(#zl-face)"
      />
      {/* Ridge line */}
      <line x1="20" y1="5" x2="20" y2="33" stroke="rgba(254,243,199,0.2)" strokeWidth="0.5" />

      {/* 4-pointed star sparkle at summit */}
      <g filter="url(#zl-glow)" transform="translate(20, 5)">
        <path
          d="M0,-3.5 L0.7,-0.7 L3.5,0 L0.7,0.7 L0,3.5 L-0.7,0.7 L-3.5,0 L-0.7,-0.7 Z"
          fill="#FEF9C3"
          opacity="0.95"
        />
      </g>
    </svg>
  );
}
