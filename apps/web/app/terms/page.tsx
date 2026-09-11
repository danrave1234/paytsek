import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Terms of use' };

const sections: LegalSection[] = [
  {
    id: 'what-it-is',
    title: 'What PayTsek is',
    body: (
      <p>
        PayTsek is recordkeeping software. It stores the payment confirmations you capture and, where you enable it,
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
        phone you pair. Owners are responsible for the cashiers they invite. Do not use PayTsek to collect notifications from
        a phone or account you are not authorised to use.
      </p>
    ),
  },
  {
    id: 'plans',
    title: 'Public beta access',
    body: (
      <p>
        PayTsek is currently offered as a public beta. There is no checkout, subscription, automatic charge or payment
        requirement for beta access. If paid plans are introduced, we will publish the terms and give notice before any
        charge is made. Beta access can change or end as we improve the product, but we will not delete your records merely
        because pricing changes.
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
        The service is provided as is. To the maximum extent permitted by law, PayTsek is not liable for lost sales,
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
        GCash, GoTyme and Maya are trademarks of their respective owners. PayTsek is an independent product and is not
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
      updated="2026-09-10"
      lead="What PayTsek is, what it does not promise, and what you are responsible for."
      summary={[
        { label: 'Moves money', value: 'No', tone: 'ok' },
        { label: 'Confirms with providers', value: 'No', tone: 'warn' },
        { label: 'Beta price', value: 'Free', tone: 'ok' },
        { label: 'Automatic charges', value: 'No', tone: 'ok' },
      ]}
      sections={sections}
    />
  );
}
