import { Column, PrimaryColumn, Entity } from 'typeorm';

// Singleton row (id is always 1), same pattern as PresenceSettingsEntity —
// no migration-seeded data, the service layer treats a missing row as "no
// customization yet" and only ever upserts id=1. Scoped to the PUBLIC
// knowledge-base pages only (client-portal's /faq, /faq/:articleId) — the
// authenticated ticket-portal surface is a product UI, not the customer's
// own branded help-center, so it isn't themed by this.
@Entity('knowledge_theme')
export class KnowledgeThemeEntity {
  @PrimaryColumn({ type: 'smallint' })
  id!: number;

  @Column({ name: 'custom_css', type: 'text', nullable: true })
  customCss?: string | null;

  // Admin-authored, not user-generated — same trust level as an admin
  // already having full control over the system (permission groups, other
  // admins' passwords, etc.), just a more direct execution surface. Runs
  // in every visitor's browser on the public FAQ pages, so this is
  // deliberately gated ADMIN-only at the controller (see knowledge-theme
  // module), never exposed to operators or clients.
  @Column({ name: 'custom_js', type: 'text', nullable: true })
  customJs?: string | null;
}
