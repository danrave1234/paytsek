import type { OcrResult, Provider, ReceiptProviderDetection } from '@paytsek/contracts';

type OcrLine = OcrResult['blocks'][number];
type Scored = { provider: Provider; points: number; signals: string[] };

const PROVIDERS: readonly Provider[] = ['GCASH', 'GOTYME', 'MAYA', 'MARIBANK'];
const MAX_POINTS = 14;

const BRAND: Record<Provider, RegExp> = {
  GCASH: /\bg\s*cash\b/i,
  GOTYME: /\bgo\s*tyme(?:\s+bank)?\b/i,
  MAYA: /\b(?:pay\s*maya|maya)(?:\s+(?:bank|wallet))?\b/i,
  MARIBANK: /\b(?:mari\s*bank|sea\s*bank)(?:\s+(?:ph|philippines))?\b/i,
};

const BRAND_ONLY: Record<Provider, RegExp> = {
  GCASH: /^g\s*cash$/i,
  GOTYME: /^go\s*tyme(?:\s+bank)?$/i,
  MAYA: /^(?:pay\s*maya|maya)(?:\s+(?:bank|wallet))?$/i,
  MARIBANK: /^(?:mari\s*bank|sea\s*bank)(?:\s+(?:ph|philippines))?$/i,
};

const CORPORATE_IDENTITY: Partial<Record<Provider, RegExp>> = {
  GCASH: /\b(?:globe\s+fintech|mynt)\b/i,
  MAYA: /\bvoyager\s+innovations\b/i,
};

const DESTINATION_LEAD = /^(?:sent\s+to|send\s+to|to|recipient|receiver|beneficiary|destination|receiving\s+(?:bank|wallet))\b/i;
const FIELD_ANCHOR = /\b(?:amount|total(?:\s+amount)?|ref(?:erence)?\.?\s*(?:no\.?|number|#|id)?|transaction\s+(?:id|no\.?|number))\b/i;

function normalizedLines(fullText: string, blocks: readonly OcrLine[]): OcrLine[] {
  if (blocks.length > 0) {
    return blocks
      .filter((line) => line.text.trim().length > 0)
      .map((line) => ({ ...line, text: line.text.replace(/\s+/g, ' ').trim() }));
  }
  return fullText
    .split(/\r?\n/)
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((text) => ({ text, confidence: null, box: null }));
}

function add(scored: Scored, points: number, signal: string, confidence: number | null): void {
  const factor = confidence === null ? 1 : confidence >= 0.75 ? 1 : confidence >= 0.5 ? 0.75 : 0.45;
  scored.points += points * factor;
  if (!scored.signals.includes(signal)) scored.signals.push(signal);
}

function isDestinationMention(lines: readonly OcrLine[], index: number, provider: Provider): boolean {
  const text = lines[index]?.text ?? '';
  if (!BRAND[provider].test(text)) return false;
  if (DESTINATION_LEAD.test(text)) return true;
  const brandIndex = text.search(BRAND[provider]);
  const beforeBrand = brandIndex < 0 ? '' : text.slice(0, brandIndex);
  if (/\b(?:sent|send|transfer(?:red)?|payment|paid|pay)\s+to\b/i.test(beforeBrand)) return true;
  if (/\bto\s*(?:the\s+)?(?:bank|wallet|account)?\s*[:\-]?\s*$/i.test(beforeBrand)) return true;
  const previous = lines[index - 1]?.text ?? '';
  return DESTINATION_LEAD.test(previous);
}

function relativeY(line: OcrLine, lines: readonly OcrLine[]): number | null {
  if (!line.box) return null;
  const ys = lines.flatMap((item) => item.box ? [item.box[1], item.box[1] + item.box[3]] : []);
  if (ys.length < 2) return null;
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  if (max <= min) return null;
  return (line.box[1] - min) / (max - min);
}

/**
 * Identifies the app that issued the customer's receipt, not the seller's
 * receiving wallet. It deliberately ignores wallet names used only as a
 * destination and returns unknown when the best candidate is not decisive.
 */
export function detectReceiptProvider(
  fullText: string,
  blocks: readonly OcrLine[] = [],
  hints: { fileName?: string | null } = {},
): ReceiptProviderDetection {
  const lines = normalizedLines(fullText, blocks);
  const anchorIndex = lines.findIndex((line) => FIELD_ANCHOR.test(line.text));
  const fieldStart = anchorIndex < 0 ? lines.length : anchorIndex;
  const scored = new Map<Provider, Scored>(PROVIDERS.map((provider) => [provider, { provider, points: 0, signals: [] }]));

  // Some Android screenshot tools include the foreground app in the filename.
  // It is never decisive by itself and is discarded after classification.
  if (hints.fileName) {
    for (const provider of PROVIDERS) {
      if (BRAND[provider].test(hints.fileName.replace(/[_-]+/g, ' '))) {
        add(scored.get(provider)!, 2, `${provider}_FILENAME_HINT`, null);
      }
    }
  }

  for (const provider of PROVIDERS) {
    const candidate = scored.get(provider)!;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      if (!BRAND[provider].test(line.text)) continue;
      if (isDestinationMention(lines, index, provider)) {
        if (!candidate.signals.includes(`${provider}_DESTINATION_IGNORED`)) candidate.signals.push(`${provider}_DESTINATION_IGNORED`);
        continue;
      }

      add(candidate, 2, `${provider}_BRAND_TEXT`, line.confidence);
      if (BRAND_ONLY[provider].test(line.text)) add(candidate, 3, `${provider}_STANDALONE_BRAND`, line.confidence);
      if (index < fieldStart) add(candidate, 2, `${provider}_BEFORE_FIELDS`, line.confidence);
      const y = relativeY(line, lines);
      if (y !== null && y <= 0.32) add(candidate, 2, `${provider}_TOP_REGION`, line.confidence);

      const beforeBrand = line.text.slice(0, line.text.search(BRAND[provider]));
      if (/\b(?:sent|send|paid|payment)\s+via\s*$/i.test(beforeBrand)) {
        add(candidate, 5, `${provider}_ISSUER_PHRASE`, line.confidence);
      }
    }
  }

  for (const provider of PROVIDERS) {
    const identity = CORPORATE_IDENTITY[provider];
    const line = identity ? lines.find((item) => identity.test(item.text)) : undefined;
    if (line) add(scored.get(provider)!, 7, `${provider}_CORPORATE_IDENTITY`, line.confidence);
  }

  // Express Send is a GCash-specific receipt rail and remains useful when a
  // photographed logo is not readable as text.
  const express = lines.find((line) => /\bexpress\s+send\b/i.test(line.text));
  if (express) add(scored.get('GCASH')!, 7, 'GCASH_EXPRESS_SEND', express.confidence);

  const ranked = [...scored.values()].sort((a, b) => b.points - a.points);
  const first = ranked[0]!;
  const second = ranked[1]!;
  const decisive = first.points >= 7 && first.points - second.points >= 3;
  const provider = decisive ? first.provider : null;

  return {
    provider,
    confidence: provider ? Math.min(0.99, Math.round((first.points / MAX_POINTS) * 100) / 100) : 0,
    method: 'OCR_LAYOUT_V1',
    signalCodes: provider
      ? first.signals.slice(0, 16)
      : [first.points > 0 ? 'NO_DECISIVE_PROVIDER' : 'NO_PROVIDER_SIGNAL'],
    candidates: ranked.map((item) => ({
      provider: item.provider,
      score: Math.min(1, Math.round((item.points / MAX_POINTS) * 100) / 100),
    })),
  };
}
