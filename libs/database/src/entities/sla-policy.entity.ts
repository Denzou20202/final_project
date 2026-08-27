import { TicketPriority } from '@veloxdesk/types';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sla_policies')
export class SlaPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'response_time_min', type: 'int' })
  responseTimeMin!: number;

  @Column({ name: 'resolution_time_min', type: 'int' })
  resolutionTimeMin!: number;

  // unique: concurrent create() calls for the same priority are guarded at
  // the service level too (findByPriority pre-check), but that check alone
  // is a TOCTOU race — see migration AddSlaPolicyPriorityUnique.
  @Column({ type: 'enum', enum: TicketPriority, unique: true })
  priority!: TicketPriority;
}
