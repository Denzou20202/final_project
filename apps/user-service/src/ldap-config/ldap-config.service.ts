import { JwtPayload, SettingsAuditLogService } from '@veloxdesk/common';
import { LdapConfigEntity } from '@veloxdesk/database';
import { AuthAudience, SettingsAuditEventType, SettingsAuditModule, UserRole } from '@veloxdesk/types';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DirectorySecretEncryptionService } from '../auth/directory-secret-encryption.service.js';
import { UpsertLdapConfigDto } from './dto/upsert-ldap-config.dto.js';
import { findAndBindLdapUser, LdapConnectionParams, LdapIdentity, testLdapConnection } from './ldap-directory-client.js';
import { PublicLdapConfig, toPublicLdapConfig } from './ldap-config.public.js';

@Injectable()
export class LdapConfigService {
  constructor(
    @InjectRepository(LdapConfigEntity)
    private readonly repository: Repository<LdapConfigEntity>,
    private readonly directorySecretEncryption: DirectorySecretEncryptionService,
    private readonly settingsAuditLog: SettingsAuditLogService,
  ) {}

  async findByAudience(audience: AuthAudience): Promise<PublicLdapConfig | null> {
    const config = await this.repository.findOne({ where: { audience } });
    return config ? toPublicLdapConfig(config) : null;
  }

  // Used by AuthService/available-methods — only a row that is BOTH enabled
  // and has a stored bind password counts as "usable".
  async findEnabledForAudience(audience: AuthAudience): Promise<LdapConfigEntity | null> {
    const config = await this.repository.findOne({ where: { audience, enabled: true } });
    return config?.bindPasswordEncrypted ? config : null;
  }

  async upsert(audience: AuthAudience, dto: UpsertLdapConfigDto, actor: JwtPayload): Promise<PublicLdapConfig> {
    this.assertRoleMatchesAudience(audience, dto.defaultRole);
    const existing = await this.repository.findOne({ where: { audience } });

    const connectionChanged =
      !existing ||
      existing.url !== dto.url ||
      existing.bindDn !== dto.bindDn ||
      existing.searchBase !== dto.searchBase ||
      (dto.userFilterTemplate !== undefined && existing.userFilterTemplate !== dto.userFilterTemplate) ||
      (dto.emailAttribute !== undefined && existing.emailAttribute !== dto.emailAttribute) ||
      (dto.fullNameAttribute !== undefined && existing.fullNameAttribute !== dto.fullNameAttribute) ||
      (dto.externalIdAttribute !== undefined && existing.externalIdAttribute !== dto.externalIdAttribute) ||
      (dto.tlsRejectUnauthorized !== undefined && existing.tlsRejectUnauthorized !== dto.tlsRejectUnauthorized) ||
      dto.bindPassword !== undefined;

    const bindPasswordEncrypted = dto.bindPassword
      ? this.directorySecretEncryption.encrypt(dto.bindPassword)
      : (existing?.bindPasswordEncrypted ?? null);

    const enabled = dto.enabled ?? false;
    const lastTestSuccessAt = connectionChanged ? null : (existing?.lastTestSuccessAt ?? null);
    if (enabled && !lastTestSuccessAt) {
      throw new BadRequestException(
        'Перед включением проверьте подключение (Test connection) — тест обязателен после любого изменения параметров',
      );
    }
    if (enabled && !bindPasswordEncrypted) {
      throw new BadRequestException('Укажите пароль служебной учётной записи перед включением');
    }

    const saved = await this.repository.save(
      this.repository.create({
        ...existing,
        audience,
        enabled,
        url: dto.url,
        bindDn: dto.bindDn,
        bindPasswordEncrypted,
        searchBase: dto.searchBase,
        userFilterTemplate: dto.userFilterTemplate ?? existing?.userFilterTemplate,
        emailAttribute: dto.emailAttribute ?? existing?.emailAttribute,
        fullNameAttribute: dto.fullNameAttribute ?? existing?.fullNameAttribute,
        externalIdAttribute: dto.externalIdAttribute ?? existing?.externalIdAttribute,
        tlsRejectUnauthorized: dto.tlsRejectUnauthorized ?? existing?.tlsRejectUnauthorized ?? true,
        defaultRole: dto.defaultRole,
        lastTestSuccessAt,
        lastTestError: connectionChanged ? null : (existing?.lastTestError ?? null),
      }),
    );

    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.LDAP_CONFIG,
      eventType: existing ? SettingsAuditEventType.UPDATED : SettingsAuditEventType.CREATED,
      entityId: saved.id,
      entityLabel: `LDAP (${audience})`,
      changes: { ...dto, bindPassword: dto.bindPassword ? '(changed)' : undefined },
    });

    return toPublicLdapConfig(saved);
  }

  // Tests the CURRENTLY SAVED config (not an inline draft) — the admin must
  // save first, then test, then enable. Records the result either way so
  // the admin UI can show a live status without a page refresh.
  async testConnection(audience: AuthAudience, actor: JwtPayload): Promise<{ success: boolean; error?: string }> {
    const config = await this.repository.findOne({ where: { audience } });
    if (!config) {
      throw new NotFoundException('LDAP config not found — save it first');
    }
    if (!config.bindPasswordEncrypted) {
      throw new BadRequestException('Укажите пароль служебной учётной записи перед проверкой подключения');
    }

    const result = await testLdapConnection(this.toConnectionParams(config, config.bindPasswordEncrypted));

    config.lastTestSuccessAt = result.success ? new Date() : null;
    config.lastTestError = result.success ? null : result.error;
    await this.repository.save(config);

    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.LDAP_CONFIG,
      eventType: SettingsAuditEventType.UPDATED,
      entityId: config.id,
      entityLabel: `LDAP (${audience}) — test connection`,
      changes: result,
    });

    return result.success ? { success: true } : { success: false, error: result.error };
  }

  // Used by LdapAuthProvider at real login time.
  async findAndBindUser(audience: AuthAudience, username: string, password: string): Promise<LdapIdentity | null> {
    const config = await this.findEnabledForAudience(audience);
    if (!config?.bindPasswordEncrypted) return null;
    return findAndBindLdapUser(this.toConnectionParams(config, config.bindPasswordEncrypted), username, password);
  }

  private toConnectionParams(config: LdapConfigEntity, bindPasswordEncrypted: string): LdapConnectionParams {
    return {
      url: config.url,
      bindDn: config.bindDn,
      bindPassword: this.directorySecretEncryption.decrypt(bindPasswordEncrypted),
      searchBase: config.searchBase,
      userFilterTemplate: config.userFilterTemplate,
      emailAttribute: config.emailAttribute,
      fullNameAttribute: config.fullNameAttribute,
      externalIdAttribute: config.externalIdAttribute,
      tlsRejectUnauthorized: config.tlsRejectUnauthorized,
    };
  }

  private assertRoleMatchesAudience(audience: AuthAudience, defaultRole: UserRole): void {
    const allowed = audience === AuthAudience.CLIENT ? [UserRole.CLIENT] : [UserRole.OPERATOR, UserRole.ADMIN];
    if (!allowed.includes(defaultRole)) {
      throw new BadRequestException(
        audience === AuthAudience.CLIENT
          ? 'Для клиентской аудитории роль по умолчанию должна быть «Клиент»'
          : 'Для сотрудников роль по умолчанию должна быть «Оператор» или «Администратор»',
      );
    }
  }
}
