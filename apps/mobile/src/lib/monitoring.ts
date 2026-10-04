import * as Sentry from '@sentry/react-native';
import { safeDiagnosticEvent, type DiagnosticCode } from '@paytsek/contracts';
import { APP_VERSION, env } from './env';

let initialized = false;
const reported = new Set<DiagnosticCode>();

/** Manual, content-free reports only. Native dumps, replay, sessions and breadcrumbs stay off. */
export function reportOperationalError(code: DiagnosticCode): void {
  if (!env.monitoringEnabled || !env.sentryDsn || reported.has(code)) return;
  try {
    if (!initialized) {
      const release = `paytsek-mobile@${APP_VERSION}`;
      Sentry.init({
        dsn: env.sentryDsn, release,
        defaultIntegrations: false, integrations: [], sendDefaultPii: false,
        enableNative: false, autoInitializeNativeSdk: false,
        enableAutoSessionTracking: false, maxBreadcrumbs: 0,
        attachScreenshot: false, attachViewHierarchy: false,
        tracesSampleRate: 0, sendClientReports: false,
        beforeSend: (event) => safeDiagnosticEvent(event, release, 'mobile'),
      });
      initialized = true;
    }
    reported.add(code);
    Sentry.captureMessage(code);
  } catch { /* Reporting is optional and must never interrupt recording. */ }
}
