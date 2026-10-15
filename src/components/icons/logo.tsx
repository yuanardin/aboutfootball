import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="m12 7.5 4.1 3-1.6 4.9h-5L7.9 10.5z" />
      <path d="M12 2.5v5" />
      <path d="M12 16.5v5" />
      <path d="M3.8 15.5l4.1-3" />
      <path d="M16.1 11.5l4.1 3" />
      <path d="M4.5 8.5l4.6 1" />
      <path d="M19.5 8.5l-4.6 1" />
    </svg>
  );
}
