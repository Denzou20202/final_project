import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssignPermissionGroupDto } from './dto/assign-permission-group.dto.js';
import { AssignTeamDto } from './dto/assign-team.dto.js';
import { CompleteProfileDto } from './dto/complete-profile.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { ResetTwoFactorDto } from './dto/reset-two-factor.dto.js';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto.js';
import { SetAdminRestrictionDto } from './dto/set-admin-restriction.dto.js';
import { SetVipDto } from './dto/set-vip.dto.js';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto.js';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getPublicProfile(user.sub);
  }

  // Must stay ahead of the :id-parameterized PATCH routes below — Nest
  // matches routes in declaration order, and ':id' would otherwise swallow
  // the literal "me" segment as an id value. No @Roles: any authenticated
  // user (client or staff) edits their own profile this way, unlike the
  // admin-only PATCH ':id' further down.
  @Patch('me')
  updateOwnProfile(@Body() dto: UpdateOwnProfileDto, @CurrentUser() actor: JwtPayload) {
    return this.usersService.updateOwnProfile(actor, dto);
  }

  // Mandatory client-onboarding form (client-portal's non-dismissible
  // modal) — a distinct literal path from 'me' above, so no route-ordering
  // conflict with the :id routes further down either.
  @Patch('me/complete-profile')
  completeProfile(@Body() dto: CompleteProfileDto, @CurrentUser() actor: JwtPayload) {
    return this.usersService.completeProfile(actor, dto);
  }

  // Same route-ordering reasoning as 'me' above — a distinct literal path
  // ahead of the :id routes. No DTO: no request body, mirrors logout().
  @Post('me/telegram-link-token')
  createTelegramLinkToken(@CurrentUser() actor: JwtPayload) {
    return this.usersService.createTelegramLinkToken(actor);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Get()
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.usersService.listPublicProfiles(query.limit, query.cursor, query.search);
  }

  // Must stay ahead of any future :id-parameterized GET — Nest matches
  // routes in declaration order and 'pending' would otherwise risk being
  // swallowed as an :id value. Feeds the sidebar bell/modal — self-
  // registrations awaiting approval.
  @Roles(UserRole.ADMIN)
  @Get('pending')
  listPending() {
    return this.usersService.listPending();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  createUser(@Body() dto: CreateUserDto, @CurrentUser() actor: JwtPayload) {
    return this.usersService.createByAdmin(dto, actor);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/role')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.updateRole(id, dto.role, actor);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserProfileDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.updateProfile(id, dto, actor);
  }

  // `?? null` — an omitted field means the same as an explicit null
  // ("no group"); passing raw undefined through would make TypeORM's
  // update() throw UpdateValuesMissingError (a 500) instead.
  // currentPassword/totpCode are only checked (and only required) when
  // id === actor.sub — see UsersService.assignPermissionGroup/assertSelfReauth.
  @Roles(UserRole.ADMIN)
  @Patch(':id/permission-group')
  assignPermissionGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPermissionGroupDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.assignPermissionGroup(
      id,
      dto.permissionGroupId ?? null,
      actor,
      dto.currentPassword,
      dto.totpCode,
    );
  }

  // Single-select «Отдел» dropdown on EditUserModal (operator role only) —
  // replaces the user's team memberships with exactly this one team.
  @Roles(UserRole.ADMIN)
  @Patch(':id/team')
  assignTeam(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignTeamDto, @CurrentUser() actor: JwtPayload) {
    return this.usersService.assignTeam(id, dto.teamId ?? null, actor);
  }

  // «Ограниченный администратор» — see UserEntity.cannotManageAdmins.
  // Meaningful only when the target's role is ADMIN, but not restricted to
  // that here — the service-side check already makes it a no-op reachable
  // by a restricted actor on no one (see assertAdminActionAllowed).
  @Roles(UserRole.ADMIN)
  @Patch(':id/admin-restriction')
  setAdminRestriction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAdminRestrictionDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.setAdminRestriction(id, dto.cannotManageAdmins, actor);
  }

  // «VIP-клиент» — see UserEntity.isVip. Meaningful only when the target's
  // role is CLIENT; UsersService.setVip rejects any other target. Unlike
  // admin-restriction, there's no permission-hierarchy concern here (a
  // client has no admin permissions to escalate), so no actor/self-check
  // is needed — any admin can toggle it on any client.
  @Roles(UserRole.ADMIN)
  @Patch(':id/vip')
  setVip(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetVipDto) {
    return this.usersService.setVip(id, dto.isVip);
  }

  // Admin-only — surfaced in «Карточка пользователя» (EditUserModal), the
  // same admin-only surface that already shows the permission group/2FA
  // reset actions. The live status pick itself happens over the chat-service
  // socket, not through this REST API — this endpoint is read-only history.
  @Roles(UserRole.ADMIN)
  @Get(':id/status-history')
  getStatusHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getStatusHistory(id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.usersService.deactivate(id, actor);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/reactivate')
  reactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.usersService.reactivate(id, actor);
  }

  // «Карточка пользователя» (EditUserModal) — permanent, cascades away every
  // ticket this person created; see UsersService.hardDelete for why a full
  // admin is rejected here (only a restricted admin/operator/client target
  // is ever accepted).
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  hardDelete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.usersService.hardDelete(id, actor);
  }

  // Admin clicked «Активировать» in the pending-registrations modal — lets
  // the account through; the waiting screen picks this up on its next poll.
  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.approve(id);
  }

  // Admin clicked «Отклонить» — hard-deletes the pending row (see
  // UsersService.reject).
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.reject(id);
  }

  // No backup codes exist (see design spec) — this is the only recovery
  // path for a lost authenticator device. Clears the secret; the owner sets
  // 2FA up again next time they log in. currentPassword/totpCode are only
  // checked (and only required) when id === actor.sub — see
  // UsersService.resetTwoFactorByAdmin/assertSelfReauth.
  @Roles(UserRole.ADMIN)
  @Post(':id/reset-2fa')
  resetTwoFactor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetTwoFactorDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.resetTwoFactorByAdmin(id, actor, dto.currentPassword, dto.totpCode);
  }

  // No self-service "forgot password" flow exists — this is the only way
  // back in for a locked-out user. Also ends their existing sessions (see
  // UsersService.resetPasswordByAdmin). currentPassword/totpCode are only
  // checked (and only required) when id === actor.sub.
  @Roles(UserRole.ADMIN)
  @Patch(':id/password')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.resetPasswordByAdmin(id, dto.password, actor, dto.currentPassword, dto.totpCode);
  }
}
