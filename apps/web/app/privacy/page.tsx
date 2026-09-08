import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Privacy policy' };

const sections: LegalSection[] = [
  {
    id: 'disclosures',
    title: 'Two separate disclosures',
    body: (
      <>
        <p>
          <strong>Confirmation images.</strong> When you scan or import a customer&apos;s payment confirmation, the image is
          stored in a private bucket for your workspace with location metadata removed. Text is extracted on your phone. Images
          are kept 30 days on the Free plan and 90 days for paid plans or purchases, then deleted; the structured record stays.
        </p>
        <p>
          <strong>Payment notifications (Android payment phone only).</strong> If a workspace owner pairs an Android phone and
          you grant Notification Access, PayRecord reads notifications from the wallet apps enabled for that workspace
          (currently GCash; GoTyme and Maya are not parsed yet). Only positive incoming-payment notifications are parsed; the
          amount, masked sender, reference (when shown), and timestamps are uploaded. OTPs, security prompts, outgoing
          payments, promotions, other apps and unrecognised formats are discarded on the phone and never uploaded. Unmatched
          notifications are deleted after 7 days unless linked to a record.
        </p>
      </>
    ),
  },
  {
    id: 'not-collected',
    title: 'What we do not collect',
    body: (
      <ul>
        <li>Wallet login, MPIN, OTP, balance or transaction history.</li>
        <li>
          GPS location, contacts, installed-app inventory, IMEI or other hardware identifiers. Devices use an app-generated ID.
        </li>
        <li>SMS messages. PayRecord does not read Messages notifications as a workaround.</li>
      </ul>
    ),
  },
  {
    id: 'visibility',
    title: 'Who can see what',
    body: (
      <p>
        Workspace owners see all workspace records and the incoming-payment inbox. Cashiers see records they created and only
        minimal, masked candidate details needed to review a match. We do not sell data and do not maintain any cross-business
        list of customers or references.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'Retention summary',
    body: (
      <ul>
        <li>Unmatched notifications: 7 days.</li>
        <li>Confirmation images: 30 days (Free) / 90 days (paid or with prepaid credits), fixed when the image is saved.</li>
        <li>
          Structured records and audit trail: 12 months by default, exportable and deletable. This is operational
          recordkeeping, not a tax-record guarantee.
        </li>
        <li>Export files: 24 hours.</li>
      </ul>
    ),
  },
  {
    id: 'deletion',
    title: 'Deletion',
    body: (
      <p>
        You can delete your account from Settings → Privacy &amp; data in the app, or by request at{' '}
        <a href="mailto:support@payrecord.ph">support@payrecord.ph</a>. Workspace owners can delete an entire workspace. Sole
        owners must transfer ownership or delete the workspace first so business records are never silently orphaned.
      </p>
    ),
  },
  {
    id: 'processors',
    title: 'Processors',
    body: (
      <p>
        Hosting and authentication: Supabase. In-app purchases: Apple App Store / Google Play via RevenueCat (purchase
        identifiers only). Error monitoring is configured to scrub amounts, names, phone numbers, references, tokens and image
        URLs.
      </p>
    ),
  },
  {
    id: 'honesty',
    title: 'Honesty about matching',
    body: (
      <p>
        &ldquo;Notification matched&rdquo; means PayRecord saw a notification on your own phone that agreed with the record. It
        is not a confirmation from GCash, GoTyme, Maya or any bank, and PayRecord is not affiliated with them.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <LegalPage
      eyebrow="Legal · 01"
      title="Privacy policy"
      updated="2026-09-08"
      lead="What PayRecord collects, why, how long it is kept, and how to delete it."
      summary={[
        { label: 'Credentials collected', value: 'None, ever', tone: 'ok' },
        { label: 'Notifications read', value: 'Incoming payments only' },
        { label: 'Unmatched notifications', value: 'Deleted after 7 days' },
        { label: 'Data sold', value: 'Never', tone: 'ok' },
      ]}
      sections={sections}
    />
  );
}
