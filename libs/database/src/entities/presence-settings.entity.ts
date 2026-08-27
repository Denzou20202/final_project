import { Column, Entity, PrimaryColumn } from 'typeorm';

// Singleton row (id is always 1) — no migration-seeded data, the service
// layer treats a missing row as "defaults" and only ever upserts id=1.
@Entity('presence_settings')
export class PresenceSettingsEntity {
  @PrimaryColumn({ type: 'smallint' })
  id!: number;

  @Column({ name: 'inactivity_timeout_minutes', type: 'integer', default: 15 })
  inactivityTimeoutMinutes!: number;
}
