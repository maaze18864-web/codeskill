import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { BugImage } from './bug-image.entity';
import { BugComment } from './bug-comment.entity';
import { BugActivity } from './bug-activity.entity';

export type BugStatus = 'new' | 'in_process' | 'fixed';
export type BugPriority = 'low' | 'medium' | 'high' | 'critical';

@Entity('bug_reports')
@Check('CHK_bug_reports_status', `"status" IN ('new', 'in_process', 'fixed')`)
@Check('CHK_bug_reports_priority', `"priority" IN ('low', 'medium', 'high', 'critical')`)
@Index('IDX_bug_reports_status_created_at', ['status', 'createdAt'])
export class BugReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  creatorName: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creatorUserId' })
  creatorUser?: User | null;

  @Column({ type: 'uuid', nullable: true })
  creatorUserId: string | null;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: BugStatus;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority: BugPriority;

  @Column({ type: 'varchar', length: 80, nullable: true })
  assigneeName: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigneeUserId' })
  assigneeUser?: User | null;

  @Column({ type: 'uuid', nullable: true })
  assigneeUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fixedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @OneToMany(() => BugImage, (image) => image.bug)
  images?: BugImage[];

  @OneToMany(() => BugComment, (comment) => comment.bug)
  comments?: BugComment[];

  @OneToMany(() => BugActivity, (activity) => activity.bug)
  activities?: BugActivity[];

  // Populated by TypeORM's loadRelationCountAndMap for list responses.
  commentCount?: number;
  imageCount?: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
