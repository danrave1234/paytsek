import type { ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * Shared shell for the policy pages. A long legal document with no way in is
 * just a wall, so this pairs the prose with a numbered contents rail that
 * sticks on desktop and collapses to a chip row on phones.
 */
export function LegalPage({
  eyebrow,
  title,
  updated,
  lead,
  summary,
  sections,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  lead: ReactNode;
  /** Optional at-a-glance box; the honest short version of the long text. */
  summary?: { label: string; value: string; tone?: 'ok' | 'warn' | 'plain' }[];
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        aside={<span className="data text-[11px] text-ink-3">Updated {updated}</span>}
        lead={lead}
      />

      {summary?.length ? (
        <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {summary.map((s) => (
            <div key={s.label} className="bg-bg px-5 py-5">
              <dt className="eyebrow">{s.label}</dt>
              <dd
                className={`mt-2 text-[14.5px] font-semibold leading-6 tracking-[-0.01em] ${
                  s.tone === 'ok' ? 'text-ok' : s.tone === 'warn' ? 'text-warn' : 'text-ink'
                }`}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-14 grid gap-10 lg:grid-cols-[15rem_1fr] lg:gap-16">
        <nav aria-label="Contents" className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow">Contents</p>
          <ol className="mt-4 flex flex-wrap gap-x-4 gap-y-1 lg:block lg:space-y-1">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="group flex items-baseline gap-2.5 py-1 text-[13.5px] leading-6 text-ink-2 transition-colors hover:text-brand"
                >
                  <span className="data text-[11px] text-ink-3 transition-colors group-hover:text-brand">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-2xl">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28 border-t border-line pt-8 first:border-t-0 first:pt-0 [&+section]:mt-12">
              <p className="data text-[11px] text-ink-3">{String(i + 1).padStart(2, '0')}</p>
              <h2 className="h-section mt-2 text-[1.4rem] leading-tight">{s.title}</h2>
              <div className="prose mt-4">{s.body}</div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
