import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { TeamEntity } from './team.entity.js';
import { UserEntity } from './user.entity.js';

// A personal addition to whatever departments a user's permission group
// already grants — an exception for one person, without touching the
// group's own list. Union'd with the group's departments when the login
// JWT's departmentIds snapshot is computed.
@Entity('user_extra_departments')
export class UserExtraDepartmentEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @PrimaryColumn({ name: 'team_id', type: 'uuid' })
  teamId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @ManyToOne(() => TeamEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team!: TeamEntity;
}
