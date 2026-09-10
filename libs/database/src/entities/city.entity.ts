import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Admin-managed catalog of allowed city names — same purpose and shape as
// CompanyEntity (see that file's own comment for why UserEntity.city stays
// a plain string rather than a FK column).
@Entity('cities')
export class CityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
