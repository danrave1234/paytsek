import { Body, Controller, Get, Headers, Module, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CreateCheckoutRequest } from '@paytsek/contracts';
import { CurrentUser, Workspace, WorkspaceRoute } from '../auth/decorators';
import { OwnerOnly, type AuthUser, type WorkspaceContext } from '../auth/guards';
import { zod } from '../common/zod.pipe';
import { BillingService } from './billing.service';

@Controller('v1/billing')
export class BillingController {
  constructor(private readonly svc: BillingService) {}
  @Get('products') @WorkspaceRoute() products() { return this.svc.products(); }
  @Get('usage') @WorkspaceRoute() usage(@Workspace() ws: WorkspaceContext) { return this.svc.usage(ws.organizationId); }
  @Get('ledger') @WorkspaceRoute() @OwnerOnly() ledger(@Workspace() ws: WorkspaceContext) { return this.svc.ledger(ws.organizationId); }
  /** Starts a one-time hosted PayMongo checkout; the webhook is the only fulfillment path. */
  @Post('checkout') @WorkspaceRoute() @OwnerOnly()
  checkout(@Workspace() ws: WorkspaceContext, @CurrentUser() user: AuthUser, @Body(zod(CreateCheckoutRequest)) body: CreateCheckoutRequest) { return this.svc.createCheckout(ws.organizationId, user.id, body.productKey); }
  /** Public endpoint; PayMongo HMAC verification happens before parsing/fulfillment. */
  @Post('webhooks/paymongo')
  paymongoWebhook(@Req() req: Request & { rawBody?: Buffer }, @Headers('paymongo-signature') signature: string | undefined) { return this.svc.paymongoWebhook(req.rawBody, signature); }
}
@Module({ controllers: [BillingController], providers: [BillingService], exports: [BillingService] })
export class BillingModule {}
