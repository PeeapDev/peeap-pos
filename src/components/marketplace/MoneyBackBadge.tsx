"use client";

interface MoneyBackBadgeProps {
  className?: string;
}

export default function MoneyBackBadge({ className = "" }: MoneyBackBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 ${className}`}
    >
      {/* Shield icon */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        {/* Shield body */}
        <path
          d="M12 2L4 5.5V11c0 5.25 3.4 10.15 8 11.5 4.6-1.35 8-6.25 8-11.5V5.5L12 2z"
          fill="url(#shield-grad)"
        />
        {/* Checkmark inside shield */}
        <path
          d="M9 12.5l2 2 4.5-5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span className="text-[10px] font-semibold text-emerald-700 whitespace-nowrap leading-none">
        100% Money Back
      </span>
    </div>
  );
}
