import type { ReactNode } from 'react';

/**
 * Masthead used at the top of every inner page: eyebrow, display title and an
 * optional standfirst, closed with a rule so the page has a clear
 * header block.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  aside,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="border-b border-line pb-9">
      <p className="eyebrow">{eyebrow}</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <h1 className="h-display max-w-2xl text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[1.05]">{title}</h1>
        {aside ? <div className="pb-1">{aside}</div> : null}
      </div>
      {lead ? <div className="mt-6 max-w-2xl text-[17px] leading-8 text-ink-2">{lead}</div> : null}
    </header>
  );
}
