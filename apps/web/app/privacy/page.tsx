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
          are scheduled for deletion after 30 days during the public beta; the structured record stays.
        </p>
        <p>
          <strong>Payment notifications (Android only).</strong> If a workspace owner enables listening on their phone or pairs a separate payment phone and
          you grant Notification Access, PayTsek reads notifications from the wallet apps enabled for that workspace
          (GCash, GoTyme, Maya and MariBank). Only positive incoming-payment notifications are parsed; the
          amount, masked sender, reference (when shown), and timestamps are uploaded. OTPs, security prompts, outgoing
          payments, promotions, other apps and unrecognised formats are discarded on the phone and never uploaded. Unmatched
          notifications are scheduled for deletion after 7 days unless linked to a record. A listener diagnostic stays local and never becomes payment evidence.
        </p>
      </>
    ),
  },
  {
    id: 'controller-purpose',
    title: 'Who is responsible and why we process data',
    body: (
      <p>
        PayTsek is an independently developed beta; an operating business has not yet been registered. The responsible operator&apos;s formal identity and privacy arrangements are still being finalized; this notice is not a certification of compliance.
        Account and service data is used to provide the service you request, secure accounts, and support your team.
        Workspace owners determine the business purpose for their payment records and must have a lawful basis to collect customer or employee data. Questions or
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
          GPS location, contacts, a general installed-app inventory, IMEI or other hardware identifiers. The collector checks only supported wallet packages and versions. Devices use an app-generated ID.
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
        <li>Unmatched notifications: scheduled for deletion after 7 days.</li>
        <li>Confirmation images: 30 days during the public beta, fixed when the image is saved.</li>
        <li>
          Structured records and audit trail: reviewed for retention after 12 months. Automatic record purging is not active;
          these remain until an approved deletion or workspace deletion. Contact support for a retention or erasure request.
          This is operational recordkeeping, not a tax-record guarantee.
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
        Privacy Commission. You may contact <a href="mailto:support@paytsek.online">support@paytsek.online</a> so we can
        verify and act on a request; contacting us is not a prerequisite to complaining to the regulator. Applicable rights in other countries are not waived.
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
        Account deletion removes access immediately and queues removal of the authentication account. Existing business records remain in their workspace with personal authorship removed; this does not erase personal information shown in someone else&apos;s receipt. Those requests need a separate scoped review.
        Unsynced scans remain on the phone to avoid accidental loss. Backups may retain deleted data until their own expiry.
      </p>
    ),
  },
  {
    id: 'processors',
    title: 'Processors',
    body: (
      <p>
        Supabase provides database, private storage and authentication; Vercel hosts the API and website. Google provides optional sign-in and on-device text recognition. GitHub hosts source, builds and public app releases, not private receipts.
        These services may process service data outside the Philippines. Processing locations, agreements and transfer safeguards require operator review before expanding the beta.
        Optional Sentry reporting is disabled by default and requires a separate activation review. The integration accepts only fixed error codes, app release and surface, not receipts, notification text, names, amounts, references, tokens, screenshots or session replay. Infrastructure providers may process network metadata such as IP addresses.
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
      updated="2026-10-04"
      lead="What PayTsek collects, why, how long it is kept, and how to delete it."
      summary={[
        { label: 'Wallet credentials', value: 'Never collected', tone: 'ok' },
        { label: 'Notifications read', value: 'Incoming payments only' },
        { label: 'Unmatched notifications', value: '7-day deletion schedule' },
        { label: 'Data sold', value: 'Never', tone: 'ok' },
      ]}
      sections={sections}
    />
  );
}
