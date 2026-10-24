import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import type { LabProjectAssignment } from '../../projects/lab-project-template';

export interface ProjectFile {
  path: string;
  content: string;
}

@Entity('project_workspaces')
@Index(['ownerId', 'updatedAt'])
@Index(
  'project_workspaces_owner_lab_problem_idx',
  ['ownerId', 'labProblemId'],
  { unique: true, where: 'lab_problem_id IS NOT NULL' },
)
export class ProjectWorkspace {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'owner_id', type: 'uuid' }) ownerId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;
  @Column({ length: 100 }) name: string;
  @Column({ length: 20 }) mode: string;
  @Column({
    name: 'frontend_stack',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  frontendStack: string | null;
  @Column({
    name: 'backend_stack',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  backendStack: string | null;
  @Column({ type: 'jsonb' }) files: ProjectFile[];
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  directories: string[];
  @Column({ name: 'lab_problem_id', type: 'uuid', nullable: true })
  labProblemId: string | null;
  @Column({ name: 'lab_assignment', type: 'jsonb', nullable: true })
  labAssignment: LabProjectAssignment | null;
  @Column({ type: 'int', default: 1 }) revision: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
