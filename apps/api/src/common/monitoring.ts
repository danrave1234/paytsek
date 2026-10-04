import * as Sentry from '@sentry/node';
import { safeDiagnosticEvent, type DiagnosticCode } from '@paytsek/contracts';

let initialized = false;
let windowStart = 0;
let sent = 0;

/** Opt-in operator configuration, after DPA/subprocessor review. No request/error arguments. */
export async function reportOperationalError(code: DiagnosticCode): Promise<void> {
  if (process.env.SENTRY_ENABLED !== 'true' || !process.env.SENTRY_DSN) return;
  try {
    if (!initialized) {
      const release = `paytsek-api@${process.env.PAYTSEK_BUILD_SHA ?? 'unknown'}`;
      Sentry.init({
        dsn: process.env.SENTRY_DSN, release,
        defaultIntegrations: false, integrations: [],
        enableRuntimeChannelInjection: false, enableOpenTelemetrySetup: false,
        dataCollection: {
          userInfo: false, cookies: false, httpHeaders: false, httpBodies: [],
          urlQueryParams: false, databaseQueryData: false, queues: false,
          stackFrameVariables: false, frameContextLines: 0,
          graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
        },
        maxBreadcrumbs: 0, tracesSampleRate: 0, sendClientReports: false,
        beforeSend: (event) => safeDiagnosticEvent(event, release, 'api'),
      });
      initialized = true;
    }
    if (Date.now() - windowStart >= 60_000) { windowStart = Date.now(); sent = 0; }
    if (sent++ >= 20) return; // Telemetry flood protection, never a user/product quota.
    Sentry.captureMessage(code);
    await Sentry.flush(1_000);
  } catch { /* Monitoring must never break recording or expose its own errors. */ }
}
