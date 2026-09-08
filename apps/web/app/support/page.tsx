import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Support', description: 'Help, FAQ and account deletion for PayRecord.' };

const faq = [
  { q: 'A payment shows "Unverified" but the customer paid. Is it lost?', a: 'No. Unverified only means no notification association exists yet. Check that the Android payment phone is on, connected, and has Notification Access enabled (Settings → Devices & health). Owners can also confirm manually after checking the wallet.' },
  { q: 'Why didn\u2019t a payment auto-match even though the amount and time agree?', a: 'By design. Amount plus time alone never confirms a payment automatically because several customers can pay the same amount at the same time. Automatic matching requires the same reference number on both the receipt and the notification for a supported flow. Everything else goes to Review where you decide.' },
  { q: 'Can my iPhone read GCash notifications?', a: 'No. iOS does not allow apps to read other apps\u2019 notifications, and PayRecord does not claim otherwise. Use the iPhone to scan and review and pair an Android phone that receives your GCash notifications, or use manual confirmation.' },
  { q: 'Which providers auto-match?', a: 'GCash → GCash Express Send is enabled based on tested templates. GoTyme notifications are not parsed yet (no verified samples); GoTyme receipts can still be recorded and confirmed manually. See Updates for changes.' },
  { q: 'Does PayRecord see my GCash balance or MPIN?', a: 'Never. It only reads incoming-payment notifications you allow, and never asks for wallet credentials, MPIN, or OTPs.' },
  { q: 'What happens when I reach my monthly record limit?', a: 'Existing records, matching, exports and notifications keep working. New scans are kept on your phone as clearly labeled drafts until you top up a record pack or the month resets.' },
];

export default function Support() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Support</h1>
      <p className="mt-2 text-muted dark:text-slate-300">Email <a className="underline" href="mailto:support@payrecord.ph">support@payrecord.ph</a>. Include your workspace name and app version (Settings → bottom of screen). Never send your MPIN, OTP or wallet password — we will never ask for them.</p>

      <h2 className="mt-10 text-xl font-semibold">Delete your account or data</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm">
        <li>Open PayRecord → Settings → Privacy &amp; data.</li>
        <li>Tap <em>Export my personal data</em> if you want a copy first.</li>
        <li>Tap <em>Delete my account</em> and type DELETE. Sole workspace owners must transfer ownership or delete the workspace first.</li>
        <li>If you can no longer sign in, email <a className="underline" href="mailto:support@payrecord.ph?subject=Account%20deletion">support@payrecord.ph</a> from the account email and we will complete the deletion within 30 days.</li>
      </ol>
      <p className="mt-3 text-sm text-muted dark:text-slate-300">Deletion removes your profile, memberships and personal data. Business records you created remain with the workspace without your name, as required for the owner&apos;s recordkeeping.</p>

      <h2 className="mt-10 text-xl font-semibold">Frequently asked</h2>
      <dl className="mt-4 space-y-5">
        {faq.map((f) => (
          <div key={f.q} className="rounded-xl border border-line p-4 dark:border-slate-800">
            <dt className="font-medium">{f.q}</dt>
            <dd className="mt-1.5 text-sm text-muted dark:text-slate-300">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
