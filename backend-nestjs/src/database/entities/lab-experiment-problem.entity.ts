import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LabExperiment } from './lab-experiment.entity';
import { ProblemMetadata } from './problem-metadata.entity';
import type { LabProjectTemplate } from '../../projects/lab-project-template';
import type { SqlProblem } from '../../sql/sql-problem';

@Entity('lab_experiment_problems')
@Index(['lab_experiment_id', 'sortOrder'])
@Index(['lab_experiment_id', 'problem_metadata_id'], { unique: true })
export class LabExperimentProblem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LabExperiment, (experiment) => experiment.problems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'lab_experiment_id' })
  experiment: LabExperiment;

  @Column({ type: 'uuid' })
  lab_experiment_id: string;

  @ManyToOne(() => ProblemMetadata, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'problem_metadata_id' })
  problemMetadata: ProblemMetadata;

  @Column({ type: 'uuid', nullable: true })
  problem_metadata_id: string | null;

  @Column({ type: 'varchar', length: 20, default: 'coding' })
  kind: 'coding' | 'project' | 'sql';

  @Column({ type: 'jsonb', nullable: true })
  sqlProblem: SqlProblem | null;

  @Column({ type: 'uuid', nullable: true })
  sqlQuestionId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  projectTemplate: LabProjectTemplate | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'float', default: 5 })
  maxScore: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  difficulty?: string;

  @Column({ default: true })
  isRequired: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
