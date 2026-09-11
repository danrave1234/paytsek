/**
 * The product in one image: the confirmation screen a customer shows you, and
 * the record PayTsek files after checking it against your own phone's
 * notification. Drawn in HTML so it stays sharp and stays in sync with the copy.
 */

const REFERENCE = '3021 8845 1129';
const AMOUNT = '₱ 1,250.00';

function StatusBar({ dark = false }: { dark?: boolean }) {
  const fg = dark ? 'bg-white/70' : 'bg-ink/60';
  return (
    <div className={`flex items-center justify-between px-5 pb-1 pt-3 text-[10px] font-semibold ${dark ? 'text-white' : 'text-ink'}`}>
      <span>9:41</span>
      <div className="flex items-center gap-1" aria-hidden>
        <span className={`block h-2 w-3.5 rounded-[1px] ${fg}`} />
        <span className={`block h-2 w-2 rounded-full ${fg}`} />
        <span className={`block h-2 w-4 rounded-[2px] border ${dark ? 'border-white/70' : 'border-ink/60'}`} />
      </div>
    </div>
  );
}

/** The customer's phone: a GCash-style QR payment confirmation. */
function CustomerPhone() {
  return (
    <div className="phone w-full max-w-[268px] sm:max-w-[236px]">
      <div className="phone-screen" style={{ background: '#0b5fff' }}>
        <StatusBar dark />

        <div className="px-5 pb-6 pt-5 text-center text-white">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-white/20">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </div>
          <p className="mt-3.5 text-[13px] font-semibold">Payment Successful!</p>
          <p className="mt-3 text-[26px] font-semibold tracking-tight">{AMOUNT}</p>
          <p className="mt-1 text-[10px] text-white/70">Sep 8, 2026 · 2:32 PM</p>
        </div>

        <div className="rounded-t-[1.4rem] bg-white px-5 pb-7 pt-5">
          <dl className="space-y-3 text-[10.5px]">
            {[
              ['Sent to', 'Aling Nena’s Store'],
              ['Mobile No.', '+63 917 ••• 4412'],
              ['Ref No.', REFERENCE],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3">
                <dt className="text-[#79747E]">{k}</dt>
                <dd className={`font-medium text-[#1C1B1F] ${k === 'Ref No.' ? 'data' : ''}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 border-t border-dashed border-[#E4E1EC] pt-4 text-center">
            <p className="text-[9px] leading-4 text-[#79747E]">The screen your customer shows you</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Your phone: the filed record, after the notification agreed. */
function SellerPhone() {
  return (
    <div className="phone w-full max-w-[268px] sm:max-w-[236px]">
      <div className="phone-screen">
        <StatusBar />

        <div className="px-5 pb-3 pt-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#79747E]">Record #00417</p>
          <p className="mt-1 text-[24px] font-semibold tracking-tight text-[#1C1B1F]">{AMOUNT}</p>
          <span className="pill mt-3" style={{ background: '#dcf2e7', color: '#0f6b46' }}>
            Notification matched
          </span>
        </div>

        <div className="px-5 pb-4">
          <div className="rounded-xl border border-[#E4E1EC] p-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#79747E]">Customer&apos;s confirmation</p>
            <dl className="mt-2 space-y-1.5 text-[10px]">
              <div className="flex justify-between gap-2">
                <dt className="text-[#79747E]">Ref</dt>
                <dd className="data font-medium text-[#1C1B1F]">{REFERENCE}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#79747E]">Amount</dt>
                <dd className="data font-medium text-[#1C1B1F]">{AMOUNT}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-2 flex items-center gap-2 px-1">
            <span className="h-px flex-1 bg-[#E4E1EC]" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#0f6b46]">agrees with</span>
            <span className="h-px flex-1 bg-[#E4E1EC]" />
          </div>

          <div className="mt-2 rounded-xl border border-[#0f6b46]/25 bg-[#dcf2e7]/50 p-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#0f6b46]">Your phone&apos;s notification</p>
            <dl className="mt-2 space-y-1.5 text-[10px]">
              <div className="flex justify-between gap-2">
                <dt className="text-[#4a5260]">Ref</dt>
                <dd className="data font-medium text-[#1C1B1F]">{REFERENCE}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#4a5260]">Amount</dt>
                <dd className="data font-medium text-[#1C1B1F]">{AMOUNT}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#4a5260]">Received</dt>
                <dd className="font-medium text-[#1C1B1F]">2:31 PM</dd>
              </div>
            </dl>
          </div>

          <p className="mt-3 text-[8.5px] leading-4 text-[#79747E]">
            Evidence, not verification. Matched against a notification on your own phone — not confirmed by GCash.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ProofScene() {
  return (
    <div className="relative">
      <div aria-hidden className="tick-grid absolute inset-x-0 top-10 bottom-16 rounded-3xl border border-line bg-bg-2/60" />
      {/* Side by side needs ~510px to stay legible; below that the phones
          stack so the type inside them is still readable. */}
      <div className="relative flex flex-col items-center gap-8 px-2 pt-6 sm:flex-row sm:items-start sm:justify-center sm:gap-5">
        <div className="sm:translate-y-6">
          <CustomerPhone />
        </div>
        <div aria-hidden className="flex items-center gap-2 self-stretch px-8 sm:hidden">
          <span className="h-px flex-1 bg-line" />
          <span className="eyebrow">checked against</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="sm:-translate-y-2">
          <SellerPhone />
        </div>
      </div>
    </div>
  );
}
