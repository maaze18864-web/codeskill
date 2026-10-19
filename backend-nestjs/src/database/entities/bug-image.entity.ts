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

@Entity('bug_images')
@Index('IDX_bug_images_bug_id_created_at', ['bugId', 'createdAt'])
export class BugImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => BugReport, (bug) => bug.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bugId' })
  bug: BugReport;

  @Column({ type: 'uuid' })
  bugId: string;

  @Column({ type: 'varchar', length: 255 })
  url: string;

  @Column({ type: 'varchar', length: 80 })
  mimeType: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploadedByUserId' })
  uploadedByUser?: User | null;

  @Column({ type: 'uuid', nullable: true })
  uploadedByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
