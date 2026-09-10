import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { TeamEntity } from './team.entity.js';
import { UserEntity } from './user.entity.js';

@Entity('team_members')
export class TeamMemberEntity {
  @PrimaryColumn({ name: 'team_id', type: 'uuid' })
  teamId!: string;

  // Composite PK (team_id, user_id) already indexes team_id as the leading
  // column; user_id needs its own index for "teams for this user" lookups.
  @Index()
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => TeamEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team!: TeamEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;
}
