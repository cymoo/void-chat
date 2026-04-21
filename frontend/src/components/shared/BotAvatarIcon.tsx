interface BotAvatarIconProps {
  size?: number;
  className?: string;
}

/**
 * A warm, friendly face icon for bot avatars.
 * Happy arc eyes and a gentle wide smile convey care and approachability.
 */
export function BotAvatarIcon({ size = 18, className }: BotAvatarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Face */}
      <circle cx="12" cy="12" r="9" />
      {/* Happy arc eyes — upward curve gives a warm, gentle squint */}
      <path d="M8 10.5 Q9.5 8.5 11 10.5" />
      <path d="M13 10.5 Q14.5 8.5 16 10.5" />
      {/* Rosy cheeks */}
      <circle cx="8" cy="14" r="1.2" fill="currentColor" stroke="none" opacity="0.35" />
      <circle cx="16" cy="14" r="1.2" fill="currentColor" stroke="none" opacity="0.35" />
      {/* Wide warm smile */}
      <path d="M7.5 14.5 Q12 18.5 16.5 14.5" />
    </svg>
  );
}
