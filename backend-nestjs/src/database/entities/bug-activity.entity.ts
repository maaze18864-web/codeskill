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

export type BugActivityType = 'reported' | 'assigned' | 'fixed' | 'reopened' | 'edited';

@Entity('bug_activities')
@Index('IDX_bug_activities_bug_id_created_at', ['bugId', 'createdAt'])
export class BugActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => BugReport, (bug) => bug.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bugId' })
  bug: BugReport;

  @Column({ type: 'uuid' })
  bugId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actorUserId' })
  actorUser?: User | null;

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 80 })
  actorName: string;

  @Column({ type: 'varchar', length: 20 })
  type: BugActivityType;

  @Column({ type: 'varchar', length: 240 })
  message: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
