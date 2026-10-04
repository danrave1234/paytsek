/** Supabase's signed upload endpoint has a fixed two-hour TTL, not our old
 * configurable display-only TTL. Read exp only from the authenticated provider
 * response, never from a client request. Do not retain or log the token. */
export function uploadTokenExpiresAt(token: string): Date {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: unknown };
    if (!Number.isSafeInteger(payload.exp) || Number(payload.exp) <= Date.now()/1000) throw new Error();
    const expiresAt = new Date(Number(payload.exp)*1000);
    if (!Number.isFinite(expiresAt.getTime())) throw new Error();
    return expiresAt;
  } catch { throw new Error('UPLOAD_CAPABILITY_EXPIRY_INVALID'); }
}

/** Allows requests authorized immediately before expiry to settle. This is a
 * conservative operational margin, not a claimed provider transfer-time SLA. */
export const UPLOAD_PURGE_GRACE_SECONDS = 15 * 60;
