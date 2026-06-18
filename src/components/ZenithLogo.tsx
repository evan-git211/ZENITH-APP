import { useId } from 'react';

interface ZenithLogoProps {
  size?: number;
}

export function ZenithLogo({ size = 32 }: ZenithLogoProps) {
  const uid = useId();
  const gid = `zenith-gold-${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="50%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      {/* Mountain body — bottom point of cap diamond meets apex */}
      <path d="M2 30 L16 14 L30 30 Z" fill={`url(#${gid})`} fillOpacity="0.35" />
      <path d="M2 30 L16 14 L30 30 Z" stroke={`url(#${gid})`} strokeWidth="1.5" fill="none" />
      {/* Graduation cap board (diamond) */}
      <path d="M16 2 L25 8 L16 14 L7 8 Z" fill={`url(#${gid})`} />
      {/* Cap brim */}
      <rect x="6" y="7" width="20" height="2.5" rx="1.2" fill={`url(#${gid})`} />
      {/* Tassel */}
      <path d="M25 8 L25 18" stroke={`url(#${gid})`} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="25" cy="19.5" r="1.8" fill={`url(#${gid})`} />
    </svg>
  );
}
