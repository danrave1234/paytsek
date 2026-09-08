import type { Metadata } from 'next';
import { RELEASES } from '@/lib/releases';

export const metadata: Metadata = { title: 'Updates', description: 'PayRecord release notes and what changed in each version.' };

export default function Updates() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Updates</h1>
      <p className="mt-2 text-muted dark:text-slate-300">What changed in each PayRecord release. Provider support (which GCash/GoTyme flows can auto-match) is listed per version because it depends on verified notification samples, not just on app updates.</p>
      <ol className="mt-10 space-y-10">
        {RELEASES.map((r) => (
          <li key={r.version} id={`v${r.version}`} className="relative border-l-2 border-line pl-6 dark:border-slate-700">
            <span className="absolute -left-[9px] top-1 size-4 rounded-full border-2 border-white bg-brand dark:border-[#0b1220]" aria-hidden />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-xl font-semibold">Version {r.version}</h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.channel === 'beta' ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok'}`}>{r.channel}</span>
              <time dateTime={r.date} className="text-sm text-muted dark:text-slate-400">{r.date}</time>
            </div>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              {r.highlights.map((h) => <li key={h}>{h}</li>)}
            </ul>
            {r.fixes?.length ? (
              <>
                <h3 className="mt-4 text-sm font-semibold">Fixes</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted dark:text-slate-300">{r.fixes.map((f) => <li key={f}>{f}</li>)}</ul>
              </>
            ) : null}
            {r.notes ? <p className="mt-4 rounded-xl bg-warn-soft p-3 text-sm text-warn">{r.notes}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
