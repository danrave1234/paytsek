import { Body, Controller, Delete, Get, Module, Param, Patch, Post } from '@nestjs/common';
import { AcceptInviteRequest, CreateWorkspaceRequest, InviteMemberRequest, UpdateMemberRequest } from '@paytsek/contracts';
import { z } from 'zod';
import { CurrentUser, UserRoute, Workspace, WorkspaceRoute } from '../auth/decorators';
import { OwnerOnly, type AuthUser, type WorkspaceContext } from '../auth/guards';
import { zod } from '../common/zod.pipe';
import { WorkspacesService } from './workspaces.service';

@Controller('v1/workspaces')
export class WorkspacesController {
  constructor(private readonly svc: WorkspacesService) {}

  @Get()
  @UserRoute()
  list(@CurrentUser() user: AuthUser) {
    return this.svc.listMine(user.id);
  }

  @Post()
  @UserRoute()
  create(@CurrentUser() user: AuthUser, @Body(zod(CreateWorkspaceRequest)) body: CreateWorkspaceRequest) {
    return this.svc.create(user.id, user.email, body);
  }

  @Post('invites/accept')
  @UserRoute()
  accept(@CurrentUser() user: AuthUser, @Body(zod(AcceptInviteRequest.extend({ displayName: z.string().max(80).optional() }))) body: { inviteToken: string; displayName?: string }) {
    return this.svc.acceptInvite(user.id, user.email, body.inviteToken, body.displayName);
  }

  @Get('current/members')
  @WorkspaceRoute()
  members(@Workspace() ws: WorkspaceContext) {
    return this.svc.members(ws.organizationId);
  }

  @Post('current/invites')
  @WorkspaceRoute()
  @OwnerOnly()
  invite(@Workspace() ws: WorkspaceContext, @CurrentUser() user: AuthUser, @Body(zod(InviteMemberRequest)) body: InviteMemberRequest) {
    return this.svc.invite(ws.organizationId, user.id, body);
  }

  @Patch('current/members/:userId')
  @WorkspaceRoute()
  @OwnerOnly()
  async update(@Workspace() ws: WorkspaceContext, @CurrentUser() user: AuthUser, @Param('userId') userId: string, @Body(zod(UpdateMemberRequest)) body: UpdateMemberRequest) {
    await this.svc.updateMember(ws.organizationId, user.id, userId, body);
    return { ok: true };
  }

  @Delete('current/members/:userId')
  @WorkspaceRoute()
  @OwnerOnly()
  async remove(@Workspace() ws: WorkspaceContext, @CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    await this.svc.removeMember(ws.organizationId, user.id, userId);
    return { ok: true };
  }
}

@Module({ controllers: [WorkspacesController], providers: [WorkspacesService], exports: [WorkspacesService] })
export class WorkspacesModule {}
