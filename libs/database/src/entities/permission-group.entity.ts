import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// A permission group is an OPTIONAL additive layer on top of a staff
// member's existing role (client/operator/admin) — it only ever narrows
// what the base role already allows (department scope, own-tickets-only,
// can't-be-assignee, mandatory 2FA, login IP range), never grants more.
// A user with no group behaves exactly as before this feature existed.
@Entity('permission_groups')
export class PermissionGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'restrict_to_departments', type: 'boolean', default: false })
  restrictToDepartments!: boolean;

  @Column({ name: 'restrict_to_own_tickets', type: 'boolean', default: false })
  restrictToOwnTickets!: boolean;

  @Column({ name: 'cannot_be_assignee', type: 'boolean', default: false })
  cannotBeAssignee!: boolean;

  @Column({ name: 'require_two_factor', type: 'boolean', default: false })
  requireTwoFactor!: boolean;

  // CIDR ranges (e.g. "203.0.113.0/24"); empty array = login not IP-restricted.
  @Column({ name: 'ip_whitelist', type: 'text', array: true, default: '{}' })
  ipWhitelist!: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
