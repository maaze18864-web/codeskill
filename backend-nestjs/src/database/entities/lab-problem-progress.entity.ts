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
import { User } from './user.entity';
import { Lab } from './lab.entity';
import { LabExperimentProblem } from './lab-experiment-problem.entity';
import { Submission } from './submission.entity';

export type LabProblemProgressStatus =
  'not_started' | 'in_progress' | 'solved' | 'failed';

@Entity('lab_problem_progress')
@Index(['lab_experiment_problem_id', 'student_id'], { unique: true })
@Index(['lab_id', 'student_id'])
export class LabProblemProgress {
  @Column({ type: 'text', nullable: true })
  lastCode?: string;
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Lab, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_id' })
  lab: Lab;

  @Column({ type: 'uuid' })
  lab_id: string;

  @ManyToOne(() => LabExperimentProblem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_experiment_problem_id' })
  experimentProblem: LabExperimentProblem;

  @Column({ type: 'uuid' })
  lab_experiment_problem_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ type: 'uuid' })
  student_id: string;

  @Column({ type: 'varchar', length: 20, default: 'not_started' })
  status: LabProblemProgressStatus;

  @ManyToOne(() => Submission, {
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'best_submission_id' })
  bestSubmission?: Submission;

  @Column({ type: 'uuid', nullable: true })
  best_submission_id?: string;

  @Column({ type: 'int', default: 0 })
  attemptsCount: number;

  @Column({ type: 'float', nullable: true })
  score?: number;

  @Column({ type: 'int', default: 0 })
  timeSpentSeconds: number;

  @Column({ type: 'timestamptz', nullable: true })
  firstSolvedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastActivityAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
