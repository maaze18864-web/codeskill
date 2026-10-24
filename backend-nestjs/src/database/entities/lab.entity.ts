import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { LabExperiment } from './lab-experiment.entity';

export type LabStatus = 'draft' | 'published' | 'archived';

@Entity('labs')
@Index(['slug'], { unique: true })
export class Lab {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: LabStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subject?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: User;

  @Column({ type: 'uuid', nullable: true })
  created_by_id?: string;

  @OneToMany(() => LabExperiment, (experiment) => experiment.lab)
  experiments: LabExperiment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
