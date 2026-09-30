import { createHmac } from 'node:crypto';
import { ApiException } from '../common/errors';

export function requireConnectorSigningKey(masterKey: string): void {
  if (masterKey.length < 32) throw new ApiException('CONFLICT', 'Signed evidence connectors are not configured on this server');
}

/** Deterministic derivation avoids storing recoverable partner secrets in Postgres. */
export function deriveConnectorSigningSecret(masterKey: string, connectorId: string, version: number): string {
  if (!masterKey) return '';
  const value = createHmac('sha256', masterKey)
    .update(`paytsek:evidence:${connectorId}:${version}`)
    .digest('base64url');
  return `pew_${value}`;
}
