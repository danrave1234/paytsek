import { describe, expect, it } from 'vitest';
import { safeDiagnosticEvent } from './diagnostics';

describe('operational diagnostics privacy boundary', () => {
  it('rebuilds approved events without any untrusted context', () => {
    const event = {
      message: 'API_UNHANDLED', user: { email: 'fixture@example.invalid' },
      request: { url: 'https://example.invalid/?token=secret', data: 'PHP 123.45' },
      exception: { value: 'raw receipt' }, attachments: ['proof.jpg'],
      breadcrumbs: [{ message: 'private notification' }], extra: { token: 'secret' },
    };
    expect(safeDiagnosticEvent(event, 'paytsek@0.2.15', 'api')).toEqual({
      type: undefined, message: 'API_UNHANDLED', level: 'error', release: 'paytsek@0.2.15', tags: { surface: 'api' },
    });
  });
  it('drops unclassified events and prevents release metadata injection', () => {
    expect(safeDiagnosticEvent({ message: 'raw receipt' }, 'v1', 'mobile')).toBeNull();
    expect(safeDiagnosticEvent({ message: 'MOBILE_RENDER_FAILED' }, 'https://example.invalid/?token=secret', 'mobile')?.release).toBe('paytsek@unknown');
  });
});
