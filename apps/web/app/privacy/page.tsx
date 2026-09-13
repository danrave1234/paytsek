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
          are kept for 30 days during the public beta, then deleted; the structured record stays.
        </p>
        <p>
          <strong>Payment notifications (Android payment phone only).</strong> If a workspace owner pairs an Android phone and
          you grant Notification Access, PayTsek reads notifications from the wallet apps enabled for that workspace
          (GCash, GoTyme, Maya and MariBank). Only positive incoming-payment notifications are parsed; the
          amount, masked sender, reference (when shown), and timestamps are uploaded. OTPs, security prompts, outgoing
          payments, promotions, other apps and unrecognised formats are discarded on the phone and never uploaded. Unmatched
          notifications are deleted after 7 days unless linked to a record.
        </p>
      </>
    ),
  },
  {
    id: 'controller-purpose',
    title: 'Who is responsible and why we process data',
    body: (
      <p>
        PayTsek is the personal information controller for account and service data. We process it to provide the service you
        request, secure accounts, keep auditable payment records, support your team, and meet legal obligations. Questions or
        privacy requests can be sent to <a href="mailto:support@paytsek.online">support@paytsek.online</a>.
      </p>
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
        <li>SMS messages. PayTsek does not read Messages notifications as a workaround.</li>
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
        <li>Confirmation images: 30 days during the public beta, fixed when the image is saved.</li>
        <li>
          Structured records and audit trail: 12 months by default, exportable and deletable. This is operational
          recordkeeping, not a tax-record guarantee.
        </li>
        <li>Export files: 24 hours.</li>
      </ul>
    ),
  },
  {
    id: 'rights',
    title: 'Your data privacy rights',
    body: (
      <p>
        Under the Philippine Data Privacy Act, you may ask to be informed, access or correct your data, object to or request
        erasure of qualifying processing, request portability where applicable, and raise a complaint with the National
        Privacy Commission. Contact us first at <a href="mailto:support@paytsek.online">support@paytsek.online</a> so we can
        verify and act on the request.
      </p>
    ),
  },
  {
    id: 'deletion',
    title: 'Deletion',
    body: (
      <p>
        You can delete your account from Settings → Privacy &amp; data in the app, or by request at{' '}
        <a href="mailto:support@paytsek.online">support@paytsek.online</a>. Workspace owners can delete an entire workspace. Sole
        owners must transfer ownership or delete the workspace first so business records are never silently orphaned.
      </p>
    ),
  },
  {
    id: 'processors',
    title: 'Processors',
    body: (
      <p>
        Hosting, database, private file storage and authentication: Supabase. Service infrastructure may process data outside
        the Philippines under the provider&apos;s contractual and security safeguards. PayTsek does not process payments or
        collect wallet credentials. Error monitoring is configured to scrub amounts, names, phone numbers, references, tokens
        and image URLs.
      </p>
    ),
  },
  {
    id: 'security-incidents',
    title: 'Security and incidents',
    body: (
      <p>
        Data is encrypted in transit, workspace access is restricted by role, and proof images use short-lived private links.
        We investigate suspected incidents and notify affected people and the National Privacy Commission when Philippine law
        requires it.
      </p>
    ),
  },
  {
    id: 'honesty',
    title: 'Honesty about matching',
    body: (
      <p>
        &ldquo;Strong match&rdquo; means PayTsek saw a notification on your own phone that agreed with the record. It
        is not a confirmation from GCash, GoTyme, Maya or any bank, and PayTsek is not affiliated with them.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <LegalPage
      eyebrow="Legal · 01"
      title="Privacy policy"
      updated="2026-09-14"
      lead="What PayTsek collects, why, how long it is kept, and how to delete it."
      summary={[
        { label: 'Wallet credentials', value: 'Never collected', tone: 'ok' },
        { label: 'Notifications read', value: 'Incoming payments only' },
        { label: 'Unmatched notifications', value: 'Deleted after 7 days' },
        { label: 'Data sold', value: 'Never', tone: 'ok' },
      ]}
      sections={sections}
    />
  );
}
