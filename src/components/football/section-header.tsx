import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  action?: string;
};

export function SectionHeader({ eyebrow, title, description, href, action = 'View all' }: SectionHeaderProps) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2.5">{eyebrow}</p>}
        <h2 className="text-section-title">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="link-arrow mb-0.5 shrink-0"
        >
          {action} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}