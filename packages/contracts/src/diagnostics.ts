/** Only these content-free events may leave the restricted application flow. */
export const DIAGNOSTIC_CODES = ['API_UNHANDLED', 'WORKER_FAILED', 'BOOTSTRAP_FAILED', 'MOBILE_RENDER_FAILED', 'MOBILE_SYNC_FAILED'] as const;
export type DiagnosticCode = typeof DIAGNOSTIC_CODES[number];

/** Rebuild from an allowlist; never regex-redact a rich event and pass it through. */
export function safeDiagnosticEvent(input: { message?: string }, release: string, surface: 'api' | 'mobile') {
  if (!DIAGNOSTIC_CODES.some((code) => code === input.message)) return null;
  return {
    type: undefined,
    message: input.message,
    level: 'error' as const,
    release: /^[a-zA-Z0-9@._+-]{1,100}$/.test(release) ? release : 'paytsek@unknown',
    tags: { surface },
  };
}
