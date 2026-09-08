import { Body, Controller, Get, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { CorrectRecordRequest, CreateRecordRequest, FinalizeProofUploadRequest, InitProofUploadRequest, ListRecordsQuery, VoidRecordRequest } from '@payrecord/contracts';
import { z } from 'zod';
import { CurrentUser, Workspace, WorkspaceRoute } from '../auth/decorators';
import { OwnerOnly, type AuthUser, type WorkspaceContext } from '../auth/guards';
import { zod } from '../common/zod.pipe';
import { ProofsService } from './proofs.service';
import { RecordsService } from './records.service';

/** Query strings arrive as strings; coerce before the contract schema. */
const ListQuery = ListRecordsQuery.extend({
  state: z.preprocess((v) => (typeof v === 'string' ? v.split(',') : v), ListRecordsQuery.shape.state),
  limit: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), ListRecordsQuery.shape.limit),
});

@Controller('v1/proofs')
@WorkspaceRoute()
export class ProofsController {
  constructor(private readonly svc: ProofsService) {}

  @Post('init')
  init(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Body(zod(InitProofUploadRequest)) body: InitProofUploadRequest) {
    return this.svc.init(ws.organizationId, u.id, body);
  }

  @Post('finalize')
  finalize(@Workspace() ws: WorkspaceContext, @Body(zod(FinalizeProofUploadRequest)) body: { proofId: string }) {
    return this.svc.finalize(ws.organizationId, body.proofId);
  }
}

@Controller('v1/records')
@WorkspaceRoute()
export class RecordsController {
  constructor(private readonly svc: RecordsService) {}

  @Post()
  create(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Body(zod(CreateRecordRequest)) body: CreateRecordRequest) {
    return this.svc.create(ws.organizationId, u.id, body);
  }

  @Get()
  list(@Workspace() ws: WorkspaceContext, @Query(zod(ListQuery)) q: ListRecordsQuery) {
    return this.svc.list(ws.organizationId, q);
  }

  @Get(':id')
  detail(@Workspace() ws: WorkspaceContext, @Param('id') id: string) {
    return this.svc.detail(ws.organizationId, id);
  }

  @Patch(':id')
  correct(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zod(CorrectRecordRequest)) body: CorrectRecordRequest) {
    return this.svc.correct(ws.organizationId, u.id, ws.role === 'OWNER', id, body);
  }

  @Post(':id/void')
  @OwnerOnly()
  async void(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zod(VoidRecordRequest)) body: { reason: string }) {
    await this.svc.void(ws.organizationId, u.id, id, body.reason);
    return { ok: true };
  }
}

@Module({ controllers: [ProofsController, RecordsController], providers: [ProofsService, RecordsService], exports: [ProofsService, RecordsService] })
export class RecordsModule {}
