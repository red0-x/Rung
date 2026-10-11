// Small line icons (24px grid, 1.75 stroke, currentColor). Hand-drawn for Rung; no icon dependency.
import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
});

export const IconQueue = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 6h10M4 12h16M4 18h7" />
  </svg>
);
export const IconCallers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
    <path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.5 14.3c1.7.6 2.8 2.2 3 4.7" />
  </svg>
);
export const IconSetup = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </svg>
);
export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
  </svg>
);
export const IconCollapse = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M14 7l-5 5 5 5" />
  </svg>
);
export const IconPhone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />
  </svg>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconRefresh = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />
  </svg>
);
export const IconPeople = (p: SVGProps<SVGSVGElement>) => IconCallers(p);

/** One glyph per intent, so the list reads by shape as well as words. */
const INTENT_PATHS: Record<string, string> = {
  fraud_in_progress: 'M12 3.5l7 2.6v5.4c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6.1zM12 8.5v4M12 15.5h.01',
  medical_emergency: 'M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z',
  locked_out: 'M6.5 11h11v8.5h-11zM8.5 11V8.5a3.5 3.5 0 0 1 7 0V11M12 14.5v2',
  payment_issue: 'M3.5 6.5h17v11h-17zM3.5 10h17M7 14.5h3',
  money_movement: 'M4 9h14l-3.5-3.5M20 15H6l3.5 3.5',
  account_change: 'M4 20l1-4L15.5 5.5l3 3L8 19zM13.5 7.5l3 3',
  dispute: 'M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4zM9 8h6M9 11.5h6M9 15h3.5',
  account_opening: 'M4 20.5h16M5.5 20.5V9.5L12 4l6.5 5.5v11M9.5 20.5v-5h5v5M12 7.5v4M10 9.5h4',
  general_question: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7M12 16.8h.01',
  other: 'M4 6.5h16v10H9.5L5.5 20v-3.5H4z',
};

export function IntentIcon({ intent, ...p }: { intent?: string | null } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d={INTENT_PATHS[intent ?? 'other'] ?? INTENT_PATHS.other} />
    </svg>
  );
}
