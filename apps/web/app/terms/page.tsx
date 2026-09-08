import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Terms of use' };

const sections: LegalSection[] = [
  {
    id: 'what-it-is',
    title: 'What PayRecord is',
    body: (
      <p>
        PayRecord is recordkeeping software. It stores the payment confirmations you capture and, where you enable it,
        incoming-payment notification evidence from your own Android phone, and shows whether the two agree. It is not a
        payment processor, wallet, escrow, bank, or fraud-prevention service, and it does not move money.
      </p>
    ),
  },
  {
    id: 'no-guarantees',
    title: 'No guarantees about payments',
    body: (
      <ul>
        <li>
          A &ldquo;Notification matched&rdquo; state means a notification on your phone agreed with a record. It is not a
          confirmation from GCash, GoTyme, Maya, or any bank, and does not guarantee funds were or will remain received.
        </li>
        <li>
          An &ldquo;Unverified&rdquo; record does not mean a payment failed. Notification delivery depends on your phone, the
          wallet app, and your network.
        </li>
        <li>You remain responsible for checking your wallet and for your own accounting, tax and legal obligations.</li>
      </ul>
    ),
  },
  {
    id: 'account',
    title: 'Your account and workspace',
    body: (
      <p>
        You must be the account holder of the receiving wallet you configure and have the right to read notifications on the
        phone you pair. Owners are responsible for the cashiers they invite. Do not use PayRecord to collect notifications from
        a phone or account you are not authorised to use.
      </p>
    ),
  },
  {
    id: 'plans',
    title: 'Plans and purchases',
    body: (
      <p>
        Subscriptions and record packs are sold through the Apple App Store or Google Play and billed by them. One record unit
        is consumed when a new payment record is saved; duplicates, retries, matching, review and exports are not charged.
        Prepaid credits do not expire; monthly allowances reset and do not roll over. Refunds follow the store&apos;s policy;
        revoked purchases remove the corresponding capacity but never delete your records.
      </p>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <p>
        No reverse engineering of provider apps, no scraping or automating wallet apps, no sharing of collector credentials,
        and no use that violates GCash, GoTyme or Maya terms or Philippine law.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Availability and liability',
    body: (
      <p>
        The service is provided as is. To the maximum extent permitted by law, PayRecord is not liable for lost sales,
        undetected payments, or decisions made based on evidence states. Nothing here limits rights you have as a consumer
        under applicable law.
      </p>
    ),
  },
  {
    id: 'trademarks',
    title: 'Trademarks',
    body: (
      <p>
        GCash, GoTyme and Maya are trademarks of their respective owners. PayRecord is an independent product and is not
        affiliated with or endorsed by them.
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <LegalPage
      eyebrow="Legal · 02"
      title="Terms of use"
      updated="2026-09-08"
      lead="What PayRecord is, what it does not promise, and what you are responsible for."
      summary={[
        { label: 'Moves money', value: 'No', tone: 'ok' },
        { label: 'Confirms with providers', value: 'No', tone: 'warn' },
        { label: 'Charged per', value: 'New record saved' },
        { label: 'Prepaid credits', value: 'Never expire', tone: 'ok' },
      ]}
      sections={sections}
    />
  );
}
