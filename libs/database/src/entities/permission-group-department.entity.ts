import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { PermissionGroupEntity } from './permission-group.entity.js';
import { TeamEntity } from './team.entity.js';

// A group's BASE department list — narrows ticket visibility for all its
// members when restrictToDepartments=true. Distinct from TeamMemberEntity
// (which routes tickets to a support queue) and from
// UserExtraDepartmentEntity (a per-user addition on top of this list).
@Entity('permission_group_departments')
export class PermissionGroupDepartmentEntity {
  @PrimaryColumn({ name: 'permission_group_id', type: 'uuid' })
  permissionGroupId!: string;

  @Index()
  @PrimaryColumn({ name: 'team_id', type: 'uuid' })
  teamId!: string;

  @ManyToOne(() => PermissionGroupEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_group_id' })
  permissionGroup!: PermissionGroupEntity;

  @ManyToOne(() => TeamEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team!: TeamEntity;
}
