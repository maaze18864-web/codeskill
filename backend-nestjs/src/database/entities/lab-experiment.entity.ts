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
import { Lab } from './lab.entity';
import { LabExperimentProblem } from './lab-experiment-problem.entity';

@Entity('lab_experiments')
@Index(['lab_id', 'sortOrder'])
export class LabExperiment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Lab, (lab) => lab.experiments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_id' })
  lab: Lab;

  @Column({ type: 'uuid' })
  lab_id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isPublished: boolean;

  @OneToMany(() => LabExperimentProblem, (problem) => problem.experiment)
  problems: LabExperimentProblem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
