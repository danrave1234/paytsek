import { EVIDENCE_STATE_LABELS, type EvidenceState } from '@paytsek/contracts';
import { formatCentavos } from '@paytsek/receipt-parsers';

export const peso = (centavos: number): string => formatCentavos(centavos);

export const stateLabel = (s: EvidenceState): string => EVIDENCE_STATE_LABELS[s];

/** "Last seen 3 minutes ago" — never a permanent green "online" badge. */
export function lastSeen(iso: string | null): string {
  if (!iso) return 'Never contacted the server';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Last seen just now';
  if (m < 60) return `Last seen ${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `Last seen ${h} hour${h === 1 ? '' : 's'} ago`;
  return `Last seen ${Math.floor(h / 24)} days ago`;
}

/** A readable absolute time avoids ambiguity when a relative device health label looks surprising. */
export function lastSeenWithTime(iso: string | null): string {
  if (!iso) return 'Never contacted the server';
  return `${lastSeen(iso)} · ${manilaTime(iso, 'TIME')}`;
}

export function manilaTime(iso: string | null, precision?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: '2-digit' };
  if (precision !== 'DAY') Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  if (precision === 'SECOND') Object.assign(opts, { second: '2-digit' });
  return new Intl.DateTimeFormat('en-PH', opts).format(d);
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 2)}•• ••• ${digits.slice(-4)}`;
}
