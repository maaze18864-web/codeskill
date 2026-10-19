import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BugReport } from './bug-report.entity';
import { User } from './user.entity';

@Entity('bug_comments')
@Index('IDX_bug_comments_bug_id_created_at', ['bugId', 'createdAt'])
export class BugComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => BugReport, (bug) => bug.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bugId' })
  bug: BugReport;

  @Column({ type: 'uuid' })
  bugId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorUserId' })
  authorUser?: User | null;

  @Column({ type: 'uuid', nullable: true })
  authorUserId: string | null;

  @Column({ type: 'varchar', length: 80 })
  authorName: string;

  @Column({ type: 'varchar', length: 3000 })
  body: string;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
