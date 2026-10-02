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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2.5">{eyebrow}</p>}
        <h2 className="text-section-title">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="link-arrow self-start sm:mb-0.5 sm:shrink-0 sm:self-auto"
        >
          {action} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}