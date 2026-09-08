import { createParamDecorator, ExecutionContext, UseGuards, applyDecorators } from '@nestjs/common';
import type { AuthedRequest, AuthUser, CollectorContext, WorkspaceContext } from './guards';
import { CollectorAuthGuard, RolesGuard, UserAuthGuard, WorkspaceGuard } from './guards';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.user) throw new Error('CurrentUser used without UserAuthGuard');
  return req.user;
});

export const Workspace = createParamDecorator((_: unknown, ctx: ExecutionContext): WorkspaceContext => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.workspace) throw new Error('Workspace used without WorkspaceGuard');
  return req.workspace;
});

export const Collector = createParamDecorator((_: unknown, ctx: ExecutionContext): CollectorContext => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.collector) throw new Error('Collector used without CollectorAuthGuard');
  return req.collector;
});

/** Authenticated user without a workspace (e.g. list my workspaces). */
export const UserRoute = () => applyDecorators(UseGuards(UserAuthGuard));
/** Authenticated user acting inside a selected workspace. */
export const WorkspaceRoute = () => applyDecorators(UseGuards(UserAuthGuard, WorkspaceGuard, RolesGuard));
/** Collector device credential. */
export const CollectorRoute = () => applyDecorators(UseGuards(CollectorAuthGuard));
