import type { SVGProps } from 'react';

export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="M8.22 16.78c.8.52 1.7.83 2.68.95A7.41 7.41 0 0 1 12 18a8 8 0 0 0 7.89-6.32 8.32 8.32 0 0 0-.25-2.32H12v3.3h5.2a4.6 4.6 0 0 1-1.96 2.84" />
    </svg>
  );
}
