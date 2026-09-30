import { Body, Controller, Get, Headers, Module, Param, Post, Req } from '@nestjs/common';
import { CreateEvidenceConnectorRequest, uuid } from '@paytsek/contracts';
import type { Request } from 'express';
import { CurrentUser, Workspace, WorkspaceRoute } from '../auth/decorators';
import { OwnerOnly, type AuthUser, type WorkspaceContext } from '../auth/guards';
import { zod } from '../common/zod.pipe';
import { EvidenceConnectorsService } from './evidence-connectors.service';
import { EvidenceWebhookService } from './evidence-webhook.service';

@Controller('v1/evidence')
export class EvidenceController {
  constructor(
    private readonly connectors: EvidenceConnectorsService,
    private readonly webhooks: EvidenceWebhookService,
  ) {}

  @Get('connectors') @WorkspaceRoute() @OwnerOnly()
  list(@Workspace() workspace: WorkspaceContext) { return this.connectors.list(workspace.organizationId); }

  @Post('connectors') @WorkspaceRoute() @OwnerOnly()
  create(
    @Workspace() workspace: WorkspaceContext,
    @CurrentUser() user: AuthUser,
    @Body(zod(CreateEvidenceConnectorRequest)) body: CreateEvidenceConnectorRequest,
  ) { return this.connectors.create(workspace.organizationId, user.id, body); }

  @Post('connectors/:id/rotate') @WorkspaceRoute() @OwnerOnly()
  rotate(@Workspace() workspace: WorkspaceContext, @CurrentUser() user: AuthUser, @Param('id', zod(uuid)) id: string) {
    return this.connectors.rotate(workspace.organizationId, user.id, id);
  }

  @Post('connectors/:id/revoke') @WorkspaceRoute() @OwnerOnly()
  async revoke(@Workspace() workspace: WorkspaceContext, @CurrentUser() user: AuthUser, @Param('id', zod(uuid)) id: string) {
    await this.connectors.revoke(workspace.organizationId, user.id, id);
    return { ok: true };
  }

  @Post('webhooks/:id')
  webhook(
    @Param('id', zod(uuid)) id: string,
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('paytsek-signature') signature: string | undefined,
  ) { return this.webhooks.receive(id, request.rawBody, signature); }
}

@Module({
  controllers: [EvidenceController],
  providers: [EvidenceConnectorsService, EvidenceWebhookService],
})
export class EvidenceModule {}
