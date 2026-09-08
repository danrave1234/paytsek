import type { Metadata } from 'next';
import Link from 'next/link';
import { RELEASES } from '@/lib/releases';

export const metadata: Metadata = { title: 'Updates', description: 'PayRecord release notes and what changed in each version.' };

export default function Updates() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <p className="eyebrow">Release ledger</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Updates</h1>
          <p className="mt-5 leading-7 text-ink-2">
            What changed in each PayRecord release. Provider support — which GCash/GoTyme flows can auto-match — is listed per version because it depends on verified notification samples, not just on app updates.
          </p>
          <p className="mt-6 font-mono text-xs leading-6 text-ink-3">
            Android builds are attached to each <a className="ul" href="https://github.com/danrave1234/pay_record/releases" rel="noreferrer">GitHub release</a>.<br />
            Need one? <Link className="ul" href="/download">Go to downloads</Link>.
          </p>
        </aside>

        <ol className="space-y-12">
          {RELEASES.map((r, i) => (
            <li key={r.version} id={`v${r.version}`} className="receipt px-7 pt-7 pb-9">
              <div className="dots flex flex-wrap items-baseline justify-between gap-2 pb-4">
                <h2 className="font-display text-2xl font-semibold tracking-tight">Version {r.version}</h2>
                <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.18em] text-ink-3">
                  <time dateTime={r.date}>{r.date}</time>
                  <span className={`stamp !rotate-0 !px-2 !py-0.5 !text-[10px] ${r.channel === 'beta' ? 'border-warn text-warn' : 'border-ok text-ok'}`}>{r.channel}</span>
                </div>
              </div>
              <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-ink-3">Highlights</p>
              <ul className="mt-2 space-y-2 font-sans text-[15px] leading-7">
                {r.highlights.map((h, j) => (
                  <li key={h} className="flex gap-3">
                    <span className="shrink-0 font-mono text-ink-3">{String(j + 1).padStart(2, '0')}</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              {r.fixes?.length ? (
                <>
                  <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-ink-3">Fixes</p>
                  <ul className="mt-2 space-y-1 font-sans text-[15px] leading-7 text-ink-2">
                    {r.fixes.map((f) => <li key={f} className="flex gap-3"><span className="font-mono text-ink-3">—</span>{f}</li>)}
                  </ul>
                </>
              ) : null}
              {r.notes ? (
                <p className="mt-6 border-l-4 border-warn bg-warn-soft/60 px-4 py-3 font-sans text-sm leading-6 text-warn">{r.notes}</p>
              ) : null}
              <p className="dots mt-6" />
              <p className="mt-3 text-center text-[10px] uppercase tracking-[0.25em] text-ink-3">
                {i === 0 ? 'latest' : `release ${RELEASES.length - i}`} · end of entry
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
