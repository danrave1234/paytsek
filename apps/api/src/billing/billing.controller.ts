import { Body, Controller, Get, Headers, Module, Post } from '@nestjs/common';
import { ReconcilePurchaseRequest } from '@payrecord/contracts';
import { CurrentUser, Workspace, WorkspaceRoute } from '../auth/decorators';
import { OwnerOnly, type AuthUser, type WorkspaceContext } from '../auth/guards';
import { zod } from '../common/zod.pipe';
import { BillingService, revenueCatAppUserIdFor } from './billing.service';

@Controller('v1/billing')
export class BillingController {
  constructor(private readonly svc: BillingService) {}

  @Get('products')
  @WorkspaceRoute()
  products() {
    return this.svc.products();
  }

  @Get('usage')
  @WorkspaceRoute()
  usage(@Workspace() ws: WorkspaceContext) {
    return this.svc.usage(ws.organizationId);
  }

  @Get('ledger')
  @WorkspaceRoute()
  @OwnerOnly()
  ledger(@Workspace() ws: WorkspaceContext) {
    return this.svc.ledger(ws.organizationId);
  }

  /** The app configures the RevenueCat SDK with this id before purchasing/restoring. */
  @Get('identity')
  @WorkspaceRoute()
  @OwnerOnly()
  identity(@Workspace() ws: WorkspaceContext) {
    return { revenueCatAppUserId: revenueCatAppUserIdFor(ws.organizationId) };
  }

  @Post('reconcile')
  @WorkspaceRoute()
  @OwnerOnly()
  async reconcile(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Body(zod(ReconcilePurchaseRequest)) body: { revenueCatAppUserId: string }) {
    const r = await this.svc.reconcile(ws.organizationId, u.id, body.revenueCatAppUserId);
    return { usage: await this.svc.usage(ws.organizationId), pendingVerification: r.pendingVerification };
  }

  /** RevenueCat webhook intake (no user auth; shared-secret header). */
  @Post('webhooks/revenuecat')
  webhook(@Headers('authorization') auth: string | undefined, @Body() body: Record<string, unknown>) {
    return this.svc.webhook(auth, body as never);
  }
}

@Module({ controllers: [BillingController], providers: [BillingService], exports: [BillingService] })
export class BillingModule {}
