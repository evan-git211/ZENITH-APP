// Single source of truth for effort-level color mapping.
// Scale is a monotone cold→hot ramp: gray → blue → amber → orange → red.
// Level 1 = minimal, 5 = very heavy.

export const EFFORT_META: Record<number, { label: string; dot: string; badge: string }> = {
  1: { label: 'Minimal',    dot: 'bg-neutral-500', badge: 'bg-neutral-800 text-neutral-400' },
  2: { label: 'Light',      dot: 'bg-blue-500',    badge: 'bg-blue-900/30 text-blue-400' },
  3: { label: 'Medium',     dot: 'bg-amber-500',   badge: 'bg-amber-500/10 text-amber-400' },
  4: { label: 'Heavy',      dot: 'bg-orange-500',  badge: 'bg-orange-900/30 text-orange-400' },
  5: { label: 'Very Heavy', dot: 'bg-red-500',     badge: 'bg-red-900/30 text-red-400' },
};
