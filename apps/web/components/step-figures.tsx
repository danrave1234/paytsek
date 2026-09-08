/**
 * One small figure per step of the flow. Each shows the actual product moment
 * rather than an abstract icon, so the sequence has a visual anchor at every
 * stage instead of only in the hero.
 */

const REFERENCE = '3021 8845 1129';
const AMOUNT = '₱ 1,250.00';

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="relative">
      <div className="tick-grid rounded-2xl border border-line bg-bg-2/50 p-6 sm:p-8">{children}</div>
      <figcaption className="eyebrow mt-4">{label}</figcaption>
    </figure>
  );
}

/** 01 — the camera reading the customer's confirmation. */
export function ScanFigure() {
  return (
    <Frame label="Fig. 01 — read on the phone, not in the cloud">
      <div className="relative mx-auto max-w-[260px]">
        {/* Viewfinder */}
        <div className="relative rounded-xl bg-white p-4 shadow-[0_12px_28px_-14px_rgba(11,15,23,0.35)]">
          {['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'left-0 bottom-0 border-l-2 border-b-2', 'right-0 bottom-0 border-r-2 border-b-2'].map((pos) => (
            <span key={pos} className={`absolute size-5 rounded-[3px] border-brand ${pos}`} aria-hidden />
          ))}

          <div className="space-y-2.5 px-1 py-1 text-[10.5px]">
            <p className="text-center text-[11px] font-semibold text-ink">Payment Successful!</p>
            <p className="text-center text-[17px] font-semibold tracking-tight text-ink">{AMOUNT}</p>
            <div className="space-y-1.5 border-t border-line-2 pt-2.5">
              <div className="flex justify-between gap-2">
                <span className="text-ink-3">Sent to</span>
                <span className="font-medium">Aling Nena&apos;s Store</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-ink-3">Ref No.</span>
                <span className="data font-medium">{REFERENCE}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fields lifted out by on-device OCR */}
        <ul className="mt-4 space-y-2">
          {[
            ['Amount', AMOUNT],
            ['Reference', REFERENCE],
            ['Recipient', 'Aling Nena’s Store'],
          ].map(([k, v]) => (
            <li key={k} className="flex items-center justify-between gap-3 rounded-lg border border-brand/25 bg-brand-soft/60 px-3 py-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-brand-2">{k}</span>
              <span className="data text-[11px] font-semibold text-ink">{v}</span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

/** 02 — the filed record, with its provenance kept. */
export function FileFigure() {
  return (
    <Frame label="Fig. 02 — fields, corrections and original text are all kept">
      <div className="mx-auto max-w-[280px] rounded-xl border border-line bg-white p-4 shadow-[0_12px_28px_-16px_rgba(11,15,23,0.3)]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="data text-[10px] uppercase tracking-[0.12em] text-ink-3">Record #00417</span>
          <span className="data text-[10px] text-ink-3">14:32</span>
        </div>
        <p className="mt-1.5 text-[20px] font-semibold tracking-tight">{AMOUNT}</p>

        <dl className="mt-4 divide-y divide-line-2 border-y border-line-2 text-[11px]">
          {[
            ['Reference', REFERENCE, true],
            ['From', 'M*A L.', false],
            ['To', 'Aling Nena’s Store', false],
            ['Source', 'GCash · QR', false],
          ].map(([k, v, mono]) => (
            <div key={String(k)} className="flex justify-between gap-3 py-2">
              <dt className="text-ink-3">{k}</dt>
              <dd className={`font-medium ${mono ? 'data' : ''}`}>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 rounded-lg bg-bg-2 px-3 py-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3">Original text · kept</p>
          <p className="mt-1 font-mono text-[9px] leading-4 text-ink-3">
            Payment Successful! PHP 1,250.00 Sent to Aling Nena&apos;s Store Ref No. 3021 8845 1129…
          </p>
        </div>
      </div>
    </Frame>
  );
}

/** 03 — your own phone's notification, and the exact-match test. */
export function CheckFigure() {
  return (
    <Frame label="Fig. 03 — matched only on exact reference and amount">
      <div className="mx-auto max-w-[280px] space-y-3">
        {/* Incoming notification on your payment phone */}
        <div className="rounded-xl bg-ink p-3 shadow-[0_12px_28px_-16px_rgba(11,15,23,0.5)]">
          <div className="flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-md bg-brand text-[9px] font-bold text-white">G</span>
            <span className="text-[9.5px] font-medium text-white/60">GCash · now</span>
          </div>
          <p className="mt-2 text-[11px] font-medium leading-5 text-white">
            You have received <span className="data font-semibold">₱1,250.00</span> from M*A L. Ref. No.{' '}
            <span className="data font-semibold">{REFERENCE}</span>
          </p>
        </div>

        {/* The comparison */}
        <div className="rounded-xl border border-line bg-white p-3">
          {[
            ['On their screen', REFERENCE],
            ['On your phone', REFERENCE],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 py-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-3">{k}</span>
              <span className="data text-[11px] font-semibold">{v}</span>
            </div>
          ))}
          <div className="mt-2 flex items-center gap-2 border-t border-line-2 pt-2.5">
            <span className="pill bg-ok-soft text-ok">Notification matched</span>
          </div>
        </div>

        <p className="text-[11px] leading-5 text-ink-3">
          Different reference, or a missing one? It goes to <span className="font-medium text-warn">Review</span> — never
          matched on amount and time alone.
        </p>
      </div>
    </Frame>
  );
}
