/**
 * The four evidence states drawn as what they actually are: a rising scale of
 * how much is known about one payment — closed by the level PayTsek refuses
 * to claim. `PROVIDER_VERIFIED` deliberately does not exist in the contracts
 * (see packages/contracts/src/enums.ts); showing that absence is the point.
 */

const levels = [
  {
    label: 'Unverified',
    fill: 18,
    tone: 'bg-bg-3 text-ink-2',
    bar: 'bg-ink-3/40',
    what: 'A confirmation was recorded.',
    why: 'No notification has been associated yet. This is not the same as unpaid — your payment phone may simply not have reported.',
  },
  {
    label: 'Review needed',
    fill: 42,
    tone: 'bg-warn-soft text-warn',
    bar: 'bg-warn/60',
    what: 'Something needs a person.',
    why: 'Candidate notifications exist but none is an exact match, or two records compete for the same one. PayTsek will not guess.',
  },
  {
    label: 'Notif. matched',
    fill: 74,
    tone: 'bg-ok-soft text-ok',
    bar: 'bg-ok/70',
    what: 'Your own phone agreed.',
    why: 'The reference and amount on the customer’s screen matched a notification your phone received, on a tested flow.',
  },
  {
    label: 'Confirmed',
    fill: 92,
    tone: 'bg-brand-soft text-brand-2',
    bar: 'bg-brand/70',
    what: 'A person checked the wallet.',
    why: 'An owner opened the wallet app, saw the money, and signed off. The strongest state PayTsek can offer.',
  },
];

export function CertaintyScale() {
  return (
    <div>
      <ol className="space-y-0">
        {levels.map((l, i) => (
          <li key={l.label} className="border-t border-line py-6 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="data w-6 shrink-0 text-[11px] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
              <span className={`pill ${l.tone}`}>{l.label}</span>
              <span className="text-[15px] font-semibold tracking-[-0.02em]">{l.what}</span>
            </div>

            {/* Certainty track: the whole point is that it never reaches the end. */}
            <div className="mt-4 flex items-center gap-4 pl-10">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-3" role="presentation">
                <div className={`h-full rounded-full ${l.bar}`} style={{ width: `${l.fill}%` }} />
              </div>
            </div>

            <p className="mt-3 max-w-2xl pl-10 text-[14.5px] leading-6 text-ink-2">{l.why}</p>
          </li>
        ))}
      </ol>

      {/* The ceiling, drawn as a level that is switched off. */}
      <div className="mt-2 border-t-2 border-dashed border-line pt-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="data w-6 shrink-0 text-[11px] text-ink-3">—</span>
          <span className="pill bg-bg-2 text-ink-3 line-through decoration-ink-3/50">Provider verified</span>
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink-3">Does not exist here.</span>
        </div>
        <div className="mt-4 flex items-center gap-4 pl-10">
          <div className="h-1.5 flex-1 rounded-full border border-dashed border-line bg-transparent" role="presentation" />
        </div>
        <p className="mt-3 max-w-2xl pl-10 text-[14.5px] leading-6 text-ink-2">
          No wallet gives an app an authenticated confirmation of a payment you received. So there is no state above
          &ldquo;Confirmed&rdquo;, no green &ldquo;verified&rdquo; badge, and no confidence percentage — because any of those
          would be invented.
        </p>
      </div>
    </div>
  );
}
