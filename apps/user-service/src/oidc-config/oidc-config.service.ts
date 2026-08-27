import { JwtPayload, SettingsAuditLogService } from '@veloxdesk/common';
import { OidcConfigEntity } from '@veloxdesk/database';
import { AuthAudience, SettingsAuditEventType, SettingsAuditModule, UserRole } from '@veloxdesk/types';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DirectorySecretEncryptionService } from '../auth/directory-secret-encryption.service.js';
import { UpsertOidcConfigDto } from './dto/upsert-oidc-config.dto.js';
import { getOidcClientConfig } from './oidc-client-registry.js';
import { PublicOidcConfig, toPublicOidcConfig } from './oidc-config.public.js';

// See LdapConfigService's identical constant — editing any of these
// invalidates a prior "Test connection" result, since enabled=true is only
// allowed while lastTestSuccessAt still reflects the CURRENTLY saved config.
const CONNECTION_FIELD_CHANGED = (existing: OidcConfigEntity | undefined, dto: UpsertOidcConfigDto): boolean =>
  !existing ||
  existing.issuerUrl !== dto.issuerUrl ||
  existing.clientId !== dto.clientId ||
  existing.redirectUri !== dto.redirectUri ||
  dto.clientSecret !== undefined;

@Injectable()
export class OidcConfigService {
  constructor(
    @InjectRepository(OidcConfigEntity)
    private readonly repository: Repository<OidcConfigEntity>,
    private readonly directorySecretEncryption: DirectorySecretEncryptionService,
    private readonly settingsAuditLog: SettingsAuditLogService,
  ) {}

  async findByAudience(audience: AuthAudience): Promise<PublicOidcConfig | null> {
    const config = await this.repository.findOne({ where: { audience } });
    return config ? toPublicOidcConfig(config) : null;
  }

  // Used by AuthService/available-methods — only a row that is BOTH enabled
  // and has a stored client secret counts as "usable".
  async findEnabledForAudience(audience: AuthAudience): Promise<OidcConfigEntity | null> {
    const config = await this.repository.findOne({ where: { audience, enabled: true } });
    return config?.clientSecretEncrypted ? config : null;
  }

  async upsert(audience: AuthAudience, dto: UpsertOidcConfigDto, actor: JwtPayload): Promise<PublicOidcConfig> {
    this.assertRoleMatchesAudience(audience, dto.defaultRole);
    const existing = (await this.repository.findOne({ where: { audience } })) ?? undefined;

    const connectionChanged = CONNECTION_FIELD_CHANGED(existing, dto);
    const clientSecretEncrypted = dto.clientSecret
      ? this.directorySecretEncryption.encrypt(dto.clientSecret)
      : (existing?.clientSecretEncrypted ?? null);

    const enabled = dto.enabled ?? false;
    const lastTestSuccessAt = connectionChanged ? null : (existing?.lastTestSuccessAt ?? null);
    if (enabled && !lastTestSuccessAt) {
      throw new BadRequestException(
        'Перед включением проверьте подключение (Test connection) — тест обязателен после любого изменения параметров',
      );
    }
    if (enabled && !clientSecretEncrypted) {
      throw new BadRequestException('Укажите client secret перед включением');
    }

    const saved = await this.repository.save(
      this.repository.create({
        ...existing,
        audience,
        enabled,
        issuerUrl: dto.issuerUrl,
        clientId: dto.clientId,
        clientSecretEncrypted,
        redirectUri: dto.redirectUri,
        scopes: dto.scopes ?? existing?.scopes,
        emailClaim: dto.emailClaim ?? existing?.emailClaim,
        fullNameClaim: dto.fullNameClaim ?? existing?.fullNameClaim,
        defaultRole: dto.defaultRole,
        lastTestSuccessAt,
        lastTestError: connectionChanged ? null : (existing?.lastTestError ?? null),
      }),
    );

    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.OIDC_CONFIG,
      eventType: existing ? SettingsAuditEventType.UPDATED : SettingsAuditEventType.CREATED,
      entityId: saved.id,
      entityLabel: `OIDC (${audience})`,
      changes: { ...dto, clientSecret: dto.clientSecret ? '(changed)' : undefined },
    });

    return toPublicOidcConfig(saved);
  }

  // Confirms the issuer is reachable and publishes a well-formed OIDC
  // discovery document with the configured client id/secret — it does NOT
  // fully validate the client secret (that requires a real authorization
  // code, which only a genuine login through the IdP can produce); a typo'd
  // secret would only surface once someone actually tries to sign in.
  async testConnection(audience: AuthAudience, actor: JwtPayload): Promise<{ success: boolean; error?: string }> {
    const config = await this.repository.findOne({ where: { audience } });
    if (!config) {
      throw new NotFoundException('OIDC config not found — save it first');
    }
    if (!config.clientSecretEncrypted) {
      throw new BadRequestException('Укажите client secret перед проверкой подключения');
    }

    const result = await this.probeDiscovery(config);
    config.lastTestSuccessAt = result.success ? new Date() : null;
    config.lastTestError = result.success ? null : result.error;
    await this.repository.save(config);

    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.OIDC_CONFIG,
      eventType: SettingsAuditEventType.UPDATED,
      entityId: config.id,
      entityLabel: `OIDC (${audience}) — test connection`,
      changes: result,
    });

    return result.success ? { success: true } : { success: false, error: result.error };
  }

  // Exposed (not just used internally by probeDiscovery) so oidc-auth
  // .controller.ts can build the same client.Configuration without
  // duplicating the encryption dependency — it already injects this
  // service for findEnabledForAudience.
  decryptClientSecret(config: OidcConfigEntity): string {
    return this.directorySecretEncryption.decrypt(config.clientSecretEncrypted as string);
  }

  private async probeDiscovery(config: OidcConfigEntity): Promise<{ success: true } | { success: false; error: string }> {
    try {
      const clientConfig = await getOidcClientConfig(config.audience, {
        issuerUrl: config.issuerUrl,
        clientId: config.clientId,
        clientSecret: this.decryptClientSecret(config),
      });
      const metadata = clientConfig.serverMetadata();
      if (!metadata.authorization_endpoint || !metadata.token_endpoint) {
        return { success: false, error: 'Discovery document is missing authorization_endpoint/token_endpoint' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown OIDC discovery error' };
    }
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
