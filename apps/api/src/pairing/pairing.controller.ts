import { Body, Controller, Get, Ip, Module, Param, Post, Query } from '@nestjs/common';
import { AcceptPairingRequest, ApprovePairingRequest, CollectorHealthReport, CreatePairingSessionRequest, DevicePlatform } from '@paytsek/contracts';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Collector, CollectorRoute, CurrentUser, Workspace, WorkspaceRoute } from '../auth/decorators';
import { OwnerOnly, type AuthUser, type CollectorContext, type WorkspaceContext } from '../auth/guards';
import { zod } from '../common/zod.pipe';
import { PairingService } from './pairing.service';

const PollQuery = z.object({ deviceInstallId: z.string().uuid(), code: z.string().min(8).max(16) });
const StatusBody = z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'REVOKED']), reason: z.string().max(200).optional() });
const RegisterScannerBody = z.object({
  deviceInstallId: z.string().uuid(),
  platform: DevicePlatform,
  label: z.string().min(1).max(60),
  appVersion: z.string().max(40),
  osVersion: z.string().max(40),
});

/** Owner-side pairing management. */
@Controller('v1/pairing')
export class PairingController {
  constructor(private readonly svc: PairingService) {}

  @Post()
  @WorkspaceRoute()
  @OwnerOnly()
  create(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Body(zod(CreatePairingSessionRequest)) body: CreatePairingSessionRequest) {
    return this.svc.createSession(ws.organizationId, u.id, body);
  }

  @Post('approve')
  @WorkspaceRoute()
  @OwnerOnly()
  approve(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Body(zod(ApprovePairingRequest)) body: ApprovePairingRequest) {
    return this.svc.approve(ws.organizationId, u.id, body.pairingSessionId, body.approve);
  }

  /** Device side: no user session required (the phone may belong to the owner but be signed out). */
  @Post('accept')
  accept(@Body(zod(AcceptPairingRequest)) body: AcceptPairingRequest, @Ip() ip: string) {
    const ipBucket = createHash('sha256').update(ip ?? 'unknown').digest('hex').slice(0, 16);
    return this.svc.accept(body, ipBucket);
  }

  @Get(':sessionId/status')
  poll(@Param('sessionId') sessionId: string, @Query(zod(PollQuery)) q: z.infer<typeof PollQuery>) {
    return this.svc.poll(sessionId, q.deviceInstallId, q.code);
  }
}

@Controller('v1/devices')
@WorkspaceRoute()
export class DevicesController {
  constructor(private readonly svc: PairingService) {}

  @Get()
  list(@Workspace() ws: WorkspaceContext) {
    return this.svc.listDevices(ws.organizationId);
  }

  @Post('register-scanner')
  register(@Workspace() ws: WorkspaceContext, @Body(zod(RegisterScannerBody)) b: z.infer<typeof RegisterScannerBody>) {
    return this.svc.registerScanner(ws.organizationId, b.deviceInstallId, b.platform, b.label, b.appVersion, b.osVersion);
  }

  @Post(':id/status')
  @OwnerOnly()
  async setStatus(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zod(StatusBody)) b: z.infer<typeof StatusBody>) {
    await this.svc.setStatus(ws.organizationId, u.id, id, b.status, b.reason);
    return { ok: true };
  }
}

/** Collector credential routes (health + rotation). Ingestion lives in its own module. */
@Controller('v1/collector')
@CollectorRoute()
export class CollectorController {
  constructor(private readonly svc: PairingService) {}

  @Post('health')
  async health(@Collector() col: CollectorContext, @Body(zod(CollectorHealthReport)) body: CollectorHealthReport) {
    await this.svc.health(col.deviceId, body);
    return { ok: true, boundSourceIds: col.boundSourceIds, serverTime: new Date().toISOString() };
  }

  @Post('rotate')
  rotate(@Collector() col: CollectorContext) {
    return this.svc.rotate(col.deviceId);
  }
}

@Module({ controllers: [PairingController, DevicesController, CollectorController], providers: [PairingService], exports: [PairingService] })
export class PairingModule {}
