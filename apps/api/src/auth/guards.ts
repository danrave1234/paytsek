import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WORKSPACE_HEADER, type MembershipRole } from '@payrecord/contracts';
import type { Request } from 'express';
import { jwtVerify } from 'jose';
import { ApiException } from '../common/errors';
import { loadEnv } from '../config/env';
import { DbService } from '../db/db.service';
import { hashSecret } from './credentials';

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface WorkspaceContext {
  organizationId: string;
  role: MembershipRole;
  canConfirmMatches: boolean;
  isDemo: boolean;
}

export interface CollectorContext {
  deviceId: string;
  organizationId: string;
  /** Sources this collector is actively bound to. Derived server-side, never from the payload. */
  boundSourceIds: string[];
}

export type AuthedRequest = Request & {
  user?: AuthUser;
  workspace?: WorkspaceContext;
  collector?: CollectorContext;
};

/** Verifies the Supabase Auth access token (HS256). */
@Injectable()
export class UserAuthGuard implements CanActivate {
  private readonly secret = new TextEncoder().encode(loadEnv().SUPABASE_JWT_SECRET);

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new ApiException('UNAUTHENTICATED', 'Missing bearer token');
    try {
      const { payload } = await jwtVerify(token, this.secret, { algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string') throw new Error('no sub');
      if (payload.aud && payload.aud !== 'authenticated' && !(Array.isArray(payload.aud) && payload.aud.includes('authenticated'))) {
        throw new Error('bad aud');
      }
      req.user = { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : null };
      return true;
    } catch {
      throw new ApiException('UNAUTHENTICATED', 'Invalid or expired token');
    }
  }
}

/** Resolves the selected workspace from the header and checks membership. */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly db: DbService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) throw new ApiException('UNAUTHENTICATED', 'Authenticate first');
    const orgId = req.headers[WORKSPACE_HEADER];
    if (typeof orgId !== 'string' || !/^[0-9a-f-]{36}$/i.test(orgId)) {
      throw new ApiException('WORKSPACE_REQUIRED', `Header ${WORKSPACE_HEADER} is required`);
    }
    const row = await this.db.one<{ role: MembershipRole; can_confirm_matches: boolean; is_demo: boolean }>(
      `select m.role, m.can_confirm_matches, o.is_demo
         from memberships m join organizations o on o.id = m.organization_id
        where m.organization_id = $1 and m.user_id = $2 and o.deleted_at is null`,
      [orgId, req.user.id],
    );
    if (!row) throw new ApiException('NOT_A_MEMBER', 'You are not a member of this workspace');
    req.workspace = { organizationId: orgId, role: row.role, canConfirmMatches: row.can_confirm_matches, isDemo: row.is_demo };
    return true;
  }
}

export const OWNER_ONLY = 'ownerOnly';
export const OwnerOnly = () => SetMetadata(OWNER_ONLY, true);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const ownerOnly = this.reflector.getAllAndOverride<boolean>(OWNER_ONLY, [ctx.getHandler(), ctx.getClass()]);
    if (!ownerOnly) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (req.workspace?.role !== 'OWNER') throw new ApiException('OWNER_ONLY', 'Only the workspace owner can do this');
    return true;
  }
}

/**
 * Collector credential guard. `Authorization: Collector <token>`. The
 * credential is scoped to event ingestion and health reporting for the
 * device's bound sources only; it cannot read the ledger or change records.
 */
@Injectable()
export class CollectorAuthGuard implements CanActivate {
  constructor(private readonly db: DbService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Collector' || !token || !token.startsWith('prc_')) {
      throw new ApiException('UNAUTHENTICATED', 'Missing collector credential');
    }
    const hash = hashSecret(token);
    const device = await this.db.one<{ id: string; organization_id: string; status: string }>(
      `select id, organization_id, status from devices where credential_hash = $1`,
      [hash],
    );
    if (!device) throw new ApiException('UNAUTHENTICATED', 'Unknown collector credential');
    if (device.status === 'REVOKED') throw new ApiException('COLLECTOR_CREDENTIAL_REVOKED', 'This device was revoked. Pair again from the owner app.');
    const bindings = await this.db.query<{ source_id: string }>(
      `select b.source_id from device_bindings b
         join payment_sources s on s.id = b.source_id
        where b.device_id = $1 and b.status = 'ACTIVE' and s.deleted_at is null`,
      [device.id],
    );
    req.collector = { deviceId: device.id, organizationId: device.organization_id, boundSourceIds: bindings.rows.map((r) => r.source_id) };
    // Health: last server contact is updated on every authenticated collector call.
    await this.db.query(`update devices set last_server_contact_at = now() where id = $1`, [device.id]);
    return true;
  }
}
