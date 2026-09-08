import { z } from 'zod';
import { DeviceCapability, DevicePlatform, DeviceStatus, PairingState, Provider } from '../enums';

export const uuid = z.string().uuid();

export const CreatePairingSessionRequest = z.object({
  sourceId: uuid,
  requestedCapability: DeviceCapability,
  /** Owner-entered label shown on the collector before acceptance. */
  deviceLabel: z.string().min(1).max(60).optional(),
});
export type CreatePairingSessionRequest = z.infer<typeof CreatePairingSessionRequest>;

export const CreatePairingSessionResponse = z.object({
  pairingSessionId: uuid,
  /** Single-use short code; server stores only its hash. Expires in 5 minutes. */
  code: z.string().min(8).max(16),
  /** Encoded as QR by the owner app: payrecord://pair?c=<code> */
  qrPayload: z.string(),
  expiresAt: z.string().datetime(),
});
export type CreatePairingSessionResponse = z.infer<typeof CreatePairingSessionResponse>;

/** Collector calls this with the short code; no login token in the QR. */
export const AcceptPairingRequest = z.object({
  code: z.string().min(8).max(16),
  /** App-generated device ID (never IMEI / hardware identifiers). */
  deviceInstallId: uuid,
  platform: DevicePlatform,
  appVersion: z.string().max(40),
  osVersion: z.string().max(40),
  deviceModel: z.string().max(80).optional(),
  /** Installed provider packages detected from PackageManager, with version codes. */
  detectedProviderApps: z
    .array(
      z.object({
        provider: Provider,
        packageName: z.string().max(200),
        versionName: z.string().max(60).optional(),
        versionCode: z.number().int().optional(),
        signingCertSha256: z.string().max(128).optional(),
      }),
    )
    .default([]),
});
export type AcceptPairingRequest = z.infer<typeof AcceptPairingRequest>;

export const AcceptPairingResponse = z.object({
  pairingSessionId: uuid,
  state: PairingState,
  workspaceName: z.string(),
  sourceLabel: z.string(),
  provider: Provider,
  requestedCapability: DeviceCapability,
  /** Present only once state becomes APPROVED (poll or realtime). */
  collectorCredential: z.string().optional(),
  deviceId: uuid.optional(),
});
export type AcceptPairingResponse = z.infer<typeof AcceptPairingResponse>;

export const ApprovePairingRequest = z.object({
  pairingSessionId: uuid,
  approve: z.boolean(),
});
export type ApprovePairingRequest = z.infer<typeof ApprovePairingRequest>;

export const DeviceSummary = z.object({
  id: uuid,
  label: z.string(),
  platform: DevicePlatform,
  capability: DeviceCapability,
  status: DeviceStatus,
  appVersion: z.string().nullable(),
  lastServerContactAt: z.string().datetime().nullable(),
  lastObservedEventAt: z.string().datetime().nullable(),
  pendingUploadCount: z.number().int().nullable(),
  listenerConnected: z.boolean().nullable(),
  notificationAccessGranted: z.boolean().nullable(),
  diagnosticReason: z.string().nullable(),
  boundSourceIds: z.array(uuid),
});
export type DeviceSummary = z.infer<typeof DeviceSummary>;

/** Collector -> server heartbeat. Content-free; never includes notification text. */
export const CollectorHealthReport = z.object({
  appVersion: z.string().max(40),
  listenerConnected: z.boolean(),
  notificationAccessGranted: z.boolean(),
  pendingUploadCount: z.number().int().min(0),
  lastObservedEventAt: z.string().datetime().nullable(),
  unknownTemplateCount: z.number().int().min(0).default(0),
  diagnosticReason: z.string().max(200).nullable().optional(),
  providerApps: z
    .array(
      z.object({
        provider: Provider,
        packageName: z.string(),
        versionName: z.string().optional(),
        versionCode: z.number().int().optional(),
      }),
    )
    .default([]),
});
export type CollectorHealthReport = z.infer<typeof CollectorHealthReport>;
