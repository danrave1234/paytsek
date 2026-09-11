import { Injectable } from '@nestjs/common';
import type { CreateWorkspaceRequest, InviteMemberRequest, MemberSummary, UpdateMemberRequest, WorkspaceSummary } from '@paytsek/contracts';
import { ApiException } from '../common/errors';
import { generateInviteToken, hashSecret } from '../auth/credentials';
import { AuditService } from '../db/audit.service';
import { DbService } from '../db/db.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  async listMine(userId: string): Promise<WorkspaceSummary[]> {
    const r = await this.db.query<{ id: string; name: string; timezone: string; role: WorkspaceSummary['role']; plan_code: WorkspaceSummary['planCode']; is_demo: boolean; created_at: Date }>(
      `select o.id, o.name, o.timezone, m.role, o.plan_code, o.is_demo, o.created_at
         from memberships m join organizations o on o.id = m.organization_id
        where m.user_id = $1 and o.deleted_at is null order by o.created_at`,
      [userId],
    );
    return r.rows.map((x) => ({ id: x.id, name: x.name, timezone: x.timezone, role: x.role, planCode: x.plan_code, isDemo: x.is_demo, createdAt: x.created_at.toISOString() }));
  }

  async create(userId: string, email: string | null, input: CreateWorkspaceRequest): Promise<WorkspaceSummary> {
    return this.db.tx(async (c) => {
      await c.query(
        `insert into profiles (user_id, display_name) values ($1,$2)
         on conflict (user_id) do update set display_name = excluded.display_name`,
        [userId, input.ownerDisplayName],
      );
      const org = await c.query<{ id: string; created_at: Date }>(
        `insert into organizations (name, timezone, created_by) values ($1,$2,$3) returning id, created_at`,
        [input.name, input.timezone, userId],
      );
      const orgId = org.rows[0]!.id;
      await c.query(`insert into memberships (organization_id, user_id, role, can_confirm_matches) values ($1,$2,'OWNER',true)`, [orgId, userId]);
      await this.audit.record({ organizationId: orgId, actorUserId: userId, action: 'MEMBER_INVITED', subjectType: 'organization', subjectId: orgId, after: { role: 'OWNER', email } }, c);
      return { id: orgId, name: input.name, timezone: input.timezone, role: 'OWNER', planCode: 'FREE', isDemo: false, createdAt: org.rows[0]!.created_at.toISOString() };
    });
  }

  async members(orgId: string): Promise<MemberSummary[]> {
    const r = await this.db.query<{ user_id: string; display_name: string | null; email: string | null; role: MemberSummary['role']; can_confirm_matches: boolean; created_at: Date }>(
      `select m.user_id, p.display_name, u.email, m.role, m.can_confirm_matches, m.created_at
         from memberships m
         left join profiles p on p.user_id = m.user_id
         left join auth.users u on u.id = m.user_id
        where m.organization_id = $1 order by m.created_at`,
      [orgId],
    );
    return r.rows.map((x) => ({ userId: x.user_id, displayName: x.display_name ?? 'Member', email: x.email, role: x.role, canConfirmMatches: x.can_confirm_matches, joinedAt: x.created_at.toISOString() }));
  }

  async invite(orgId: string, actorId: string, input: InviteMemberRequest): Promise<{ inviteToken: string; expiresAt: string }> {
    return this.db.tx(async (c) => {
      const limits = await c.query<{ members: number; count: number }>(
        `select p.members, (select count(*) from memberships where organization_id = $1)::int as count
           from organizations o join plans p on p.code = o.plan_code where o.id = $1`,
        [orgId],
      );
      const lim = limits.rows[0]!;
      const pending = await c.query<{ n: number }>(`select count(*)::int as n from invitations where organization_id = $1 and accepted_at is null and expires_at > now()`, [orgId]);
      if (lim.count + (pending.rows[0]?.n ?? 0) >= lim.members) {
        throw new ApiException('PLAN_LIMIT_MEMBERS', `Your plan allows ${lim.members} members`, { limit: lim.members });
      }
      const token = generateInviteToken();
      const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      await c.query(
        `insert into invitations (organization_id, email, role, can_confirm_matches, token_hash, invited_by, expires_at) values ($1,$2,$3,$4,$5,$6,$7)`,
        [orgId, input.email.toLowerCase(), input.role, input.canConfirmMatches, hashSecret(token), actorId, expires],
      );
      await this.audit.record({ organizationId: orgId, actorUserId: actorId, action: 'MEMBER_INVITED', subjectType: 'invitation', after: { email: input.email, role: input.role } }, c);
      // The token is delivered by the owner (share sheet / email link); the server never stores it in plain form.
      return { inviteToken: token, expiresAt: expires.toISOString() };
    });
  }

  async acceptInvite(userId: string, email: string | null, token: string, displayName?: string): Promise<WorkspaceSummary> {
    return this.db.tx(async (c) => {
      const inv = await c.query<{ id: string; organization_id: string; email: string; role: MemberSummary['role']; can_confirm_matches: boolean }>(
        `select id, organization_id, email, role, can_confirm_matches from invitations
          where token_hash = $1 and accepted_at is null and expires_at > now() for update`,
        [hashSecret(token)],
      );
      const row = inv.rows[0];
      if (!row) throw new ApiException('NOT_FOUND', 'Invitation is invalid or expired');
      if (email && row.email !== email.toLowerCase()) throw new ApiException('FORBIDDEN', 'This invitation was sent to a different email address');
      await c.query(`insert into profiles (user_id, display_name) values ($1,$2) on conflict (user_id) do nothing`, [userId, displayName ?? email ?? 'Member']);
      await c.query(
        `insert into memberships (organization_id, user_id, role, can_confirm_matches) values ($1,$2,$3,$4)
         on conflict (organization_id, user_id) do update set role = excluded.role, can_confirm_matches = excluded.can_confirm_matches`,
        [row.organization_id, userId, row.role, row.can_confirm_matches],
      );
      await c.query(`update invitations set accepted_at = now(), accepted_by = $2 where id = $1`, [row.id, userId]);
      const org = await c.query<{ id: string; name: string; timezone: string; plan_code: WorkspaceSummary['planCode']; is_demo: boolean; created_at: Date }>(
        `select id, name, timezone, plan_code, is_demo, created_at from organizations where id = $1`,
        [row.organization_id],
      );
      const o = org.rows[0]!;
      return { id: o.id, name: o.name, timezone: o.timezone, role: row.role, planCode: o.plan_code, isDemo: o.is_demo, createdAt: o.created_at.toISOString() };
    });
  }

  async updateMember(orgId: string, actorId: string, userId: string, input: UpdateMemberRequest): Promise<void> {
    if (input.role === 'CASHIER') {
      const owners = await this.db.one<{ n: number }>(`select count(*)::int as n from memberships where organization_id = $1 and role = 'OWNER' and user_id <> $2`, [orgId, userId]);
      if ((owners?.n ?? 0) === 0) throw new ApiException('CONFLICT', 'A workspace must keep at least one owner');
    }
    await this.db.query(
      `update memberships set role = coalesce($3, role), can_confirm_matches = coalesce($4, can_confirm_matches) where organization_id = $1 and user_id = $2`,
      [orgId, userId, input.role ?? null, input.canConfirmMatches ?? null],
    );
    await this.audit.record({ organizationId: orgId, actorUserId: actorId, action: 'MEMBER_INVITED', subjectType: 'membership', subjectId: userId, after: input as Record<string, unknown> });
  }

  async removeMember(orgId: string, actorId: string, userId: string): Promise<void> {
    if (actorId === userId) throw new ApiException('CONFLICT', 'Use workspace deletion or owner transfer instead of removing yourself');
    // Business-owned records stay; created_by references the removed user's id for audit continuity.
    await this.db.query(`delete from memberships where organization_id = $1 and user_id = $2 and role <> 'OWNER'`, [orgId, userId]);
    await this.audit.record({ organizationId: orgId, actorUserId: actorId, action: 'MEMBER_REMOVED', subjectType: 'membership', subjectId: userId });
  }
}
