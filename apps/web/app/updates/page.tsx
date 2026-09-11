import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { PROVIDER_SUPPORT } from '@/lib/providers';
import { RELEASES } from '@/lib/releases';

export const metadata: Metadata = { title: 'Updates', description: 'PayTsek release notes and what changed in each version.' };

export default function Updates() {
  const newest = RELEASES[0]!;

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <PageHeader
        eyebrow="Release history"
        title="Updates"
        aside={
          <span className={`pill ${newest.channel === 'beta' ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok'}`}>
            {newest.channel} v{newest.version}
          </span>
        }
        lead={
          <>
            What changed in each release. Wallet support is listed per version because it depends on verified notification
            samples, not on app updates alone —{' '}
            <Link href="/download" className="ul">
              get the latest build
            </Link>
            .
          </>
        }
      />

      {/* ── Current capability, straight from the registry ────────────────── */}
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        {PROVIDER_SUPPORT.map((p) => (
          <div key={p.name} className="bg-bg px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-semibold tracking-[-0.02em]">{p.name}</p>
              <span className={`pill ${p.autoMatch ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>
                {p.autoMatch ? 'Auto-match' : 'Manual'}
              </span>
            </div>
            <p className="mt-2.5 text-[13px] leading-6 text-ink-3">{p.short}</p>
          </div>
        ))}
      </div>

      {/* ── The releases themselves, on a timeline rail ───────────────────── */}
      <ol className="mt-16">
        {RELEASES.map((r, i) => (
          <li key={r.version} id={`v${r.version}`} className="relative scroll-mt-28 pb-16 last:pb-0 sm:pl-28">
            {/* Rail, desktop only. */}
            {i < RELEASES.length - 1 ? (
              <span aria-hidden className="absolute left-[6.1rem] top-6 hidden h-full w-px bg-line sm:block" />
            ) : null}

            <div className="absolute left-0 top-0 hidden w-[5.5rem] text-right sm:block">
              <p className="data text-[20px] font-semibold leading-none tracking-tight">v{r.version}</p>
              <time className="data mt-2 block text-[11px] text-ink-3" dateTime={r.date}>
                {r.date}
              </time>
            </div>
            {/* Marker centred on the rail. */}
            <span
              aria-hidden
              className="absolute left-[5.85rem] top-[0.4rem] hidden size-2.5 rounded-full border-2 border-brand bg-bg sm:block"
            />

            <div className="card p-6 sm:p-8">
              {/* Mobile header — the rail is hidden below sm. */}
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4 sm:hidden">
                <h2 className="h-section text-[1.4rem] leading-none">Version {r.version}</h2>
                <time className="data text-[11px] text-ink-3" dateTime={r.date}>
                  {r.date}
                </time>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className={`pill ${r.channel === 'beta' ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok'}`}>
                  {r.channel}
                </span>
                {i === 0 ? <span className="pill bg-brand-soft text-brand-2">Latest</span> : null}
              </div>

              <p className="eyebrow mt-7">Highlights</p>
              <ul className="mt-4 space-y-3">
                {r.highlights.map((h, j) => (
                  <li key={h} className="flex gap-4">
                    <span className="data shrink-0 pt-1 text-[11px] text-ink-3">{String(j + 1).padStart(2, '0')}</span>
                    <span className="text-[15px] leading-7 text-ink-2">{h}</span>
                  </li>
                ))}
              </ul>

              {r.fixes?.length ? (
                <>
                  <p className="eyebrow mt-8">Fixes</p>
                  <ul className="mt-4 space-y-2">
                    {r.fixes.map((f) => (
                      <li key={f} className="flex gap-4 text-[15px] leading-7 text-ink-2">
                        <span className="shrink-0 text-ink-3">—</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {r.notes ? (
                <div className="mt-8 rounded-xl border-l-[3px] border-warn bg-warn-soft/40 px-5 py-4">
                  <p className="eyebrow !text-warn">Known limits</p>
                  <p className="mt-2 text-[14px] leading-7 text-warn">{r.notes}</p>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-4 border-t border-line pt-8 text-[13.5px] leading-7 text-ink-3 sm:pl-28">
        Android builds are attached to every{' '}
        <a className="ul" href="https://github.com/danrave1234/paytsek/releases" rel="noreferrer">
          GitHub release
        </a>
        .
      </p>
    </section>
  );
}
