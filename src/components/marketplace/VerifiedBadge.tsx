"use client";

interface VerifiedBadgeProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
} as const;

export default function VerifiedBadge({
  size = "sm",
  className = "",
}: VerifiedBadgeProps) {
  const px = sizeMap[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="Verified"
      role="img"
    >
      <defs>
        {/* Main gradient - green to blue */}
        <linearGradient
          id={`verified-grad-${size}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>

        {/* Glossy highlight */}
        <linearGradient
          id={`verified-gloss-${size}`}
          x1="50%"
          y1="0%"
          x2="50%"
          y2="60%"
        >
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* Drop shadow */}
        <filter id={`verified-shadow-${size}`} x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#22c55e" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Starburst / badge shape */}
      <path
        d="M20 2l3.09 5.26L29 5.24l.76 6.18 5.74 2.58-2.82 5.6 2.82 5.6-5.74 2.58L29 33.96l-5.91-1.82L20 38l-3.09-5.26L11 34.76l-.76-6.18-5.74-2.58 2.82-5.6-2.82-5.6 5.74-2.58L11 6.04l5.91 1.82L20 2z"
        fill={`url(#verified-grad-${size})`}
        filter={`url(#verified-shadow-${size})`}
      />

      {/* Glossy overlay */}
      <ellipse
        cx="20"
        cy="15"
        rx="12"
        ry="10"
        fill={`url(#verified-gloss-${size})`}
      />

      {/* Checkmark */}
      <path
        d="M14 20.5l4 4 8.5-9"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
