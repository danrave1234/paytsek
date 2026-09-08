import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of use' };

export default function Terms() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 text-[15px] leading-7 [&_h2]:mt-10 [&_h2]:border-t [&_h2]:border-rule [&_h2]:pt-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1 [&_a]:underline [&_a]:decoration-rule [&_a]:decoration-2 [&_a]:underline-offset-4">
      <p className="eyebrow">Legal · 02</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Terms of use</h1>
      <p className="text-ink-2">Last updated 8 September 2026.</p>

      <h2>What PayRecord is</h2>
      <p>PayRecord is recordkeeping software. It stores payment proofs you capture and, where you enable it, incoming-payment notification evidence from your own Android phone, and shows whether the two agree. It is not a payment processor, wallet, escrow, bank, or fraud-prevention service, and it does not move money.</p>

      <h2>No guarantees about payments</h2>
      <ul>
        <li>A &ldquo;Notification matched&rdquo; state means a notification on your phone agreed with a record. It is not a confirmation from GCash, GoTyme, or any bank, and does not guarantee funds were or will remain received.</li>
        <li>An &ldquo;Unverified&rdquo; record does not mean a payment failed. Notification delivery depends on your phone, the wallet app, and your network.</li>
        <li>You remain responsible for checking your wallet and for your own accounting, tax and legal obligations.</li>
      </ul>

      <h2>Your account and workspace</h2>
      <p>You must be the account holder of the receiving wallet you configure and have the right to read notifications on the phone you pair. Owners are responsible for the cashiers they invite. Do not use PayRecord to collect notifications from a phone or account you are not authorised to use.</p>

      <h2>Plans and purchases</h2>
      <p>Subscriptions and record packs are sold through the Apple App Store or Google Play and billed by them. One record unit is consumed when a new payment record is saved; duplicates, retries, matching, review and exports are not charged. Prepaid credits do not expire; monthly allowances reset and do not roll over. Refunds follow the store&apos;s policy; revoked purchases remove the corresponding capacity but never delete your records.</p>

      <h2>Acceptable use</h2>
      <p>No reverse engineering of provider apps, no scraping or automating wallet apps, no sharing of collector credentials, and no use that violates GCash or GoTyme terms or Philippine law.</p>

      <h2>Availability and liability</h2>
      <p>The service is provided as is. To the maximum extent permitted by law, PayRecord is not liable for lost sales, undetected payments, or decisions made based on evidence states. Nothing here limits rights you have as a consumer under applicable law.</p>

      <h2>Trademarks</h2>
      <p>GCash and GoTyme are trademarks of their respective owners. PayRecord is an independent product and is not affiliated with or endorsed by them.</p>
    </article>
  );
}
