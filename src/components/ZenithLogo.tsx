interface ZenithLogoProps {
  size?: number;
  className?: string;
}

export function ZenithLogo({ size = 32, className = '' }: ZenithLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Mountain / peak shape */}
      <polygon
        points="16,4 28,26 4,26"
        fill="url(#zenith-grad)"
        opacity="0.95"
      />
      {/* Inner highlight triangle */}
      <polygon
        points="16,10 23,26 9,26"
        fill="url(#zenith-inner)"
        opacity="0.4"
      />
      {/* Star at peak */}
      <circle cx="16" cy="4" r="2" fill="#FCD34D" />
      <defs>
        <linearGradient id="zenith-grad" x1="16" y1="4" x2="16" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="zenith-inner" x1="16" y1="10" x2="16" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>
      </defs>
    </svg>
  );
}
