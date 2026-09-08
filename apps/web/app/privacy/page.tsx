import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 text-[15px] leading-7 [&_h2]:mt-10 [&_h2]:border-t [&_h2]:border-rule [&_h2]:pt-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1 [&_a]:underline [&_a]:decoration-rule [&_a]:decoration-2 [&_a]:underline-offset-4">
      <p className="eyebrow">Legal · 01</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Privacy policy</h1>
      <p className="text-ink-2">Last updated 8 September 2026. This policy describes what PayRecord collects, why, how long it is kept, and how to delete it.</p>

      <h2>Two separate disclosures</h2>
      <p><strong>Receipt images.</strong> When you scan or import a customer receipt, the image is stored in a private bucket for your workspace with location metadata removed. Text is extracted on your phone. Images are kept 30 days on the Free plan and 90 days for paid plans or purchases, then deleted; the structured record stays.</p>
      <p><strong>Payment notifications (Android payment phone only).</strong> If a workspace owner pairs an Android phone and you grant Notification Access, PayRecord reads notifications from the wallet apps enabled for that workspace (currently GCash). Only positive incoming-payment notifications are parsed; the amount, masked sender, reference (when shown), and timestamps are uploaded. OTPs, security prompts, outgoing payments, promotions, other apps and unrecognised formats are discarded on the phone and never uploaded. Unmatched notifications are deleted after 7 days unless linked to a record.</p>

      <h2>What we do not collect</h2>
      <ul>
        <li>Wallet login, MPIN, OTP, balance or transaction history.</li>
        <li>GPS location, contacts, installed-app inventory, IMEI or other hardware identifiers. Devices use an app-generated ID.</li>
        <li>SMS messages. PayRecord does not read Messages notifications as a workaround.</li>
      </ul>

      <h2>Who can see what</h2>
      <p>Workspace owners see all workspace records and the incoming-payment inbox. Cashiers see records they created and only minimal, masked candidate details needed to review a match. We do not sell data and do not maintain any cross-business list of customers or references.</p>

      <h2>Retention summary</h2>
      <ul>
        <li>Unmatched notifications: 7 days.</li>
        <li>Receipt images: 30 days (Free) / 90 days (paid or with prepaid credits), fixed when the image is saved.</li>
        <li>Structured records and audit trail: 12 months by default, exportable and deletable. This is operational recordkeeping, not a tax-record guarantee.</li>
        <li>Export files: 24 hours.</li>
      </ul>

      <h2>Deletion</h2>
      <p>You can delete your account from Settings → Privacy &amp; data in the app, or by request at <a href="mailto:support@payrecord.ph">support@payrecord.ph</a>. Workspace owners can delete an entire workspace. Sole owners must transfer ownership or delete the workspace first so business records are never silently orphaned.</p>

      <h2>Processors</h2>
      <p>Hosting and authentication: Supabase. In-app purchases: Apple App Store / Google Play via RevenueCat (purchase identifiers only). Error monitoring is configured to scrub amounts, names, phone numbers, references, tokens and image URLs.</p>

      <h2>Honesty about matching</h2>
      <p>&ldquo;Notification matched&rdquo; means PayRecord saw a notification on your own phone that agreed with the record. It is not a confirmation from GCash, GoTyme or any bank, and PayRecord is not affiliated with them.</p>
    </article>
  );
}
