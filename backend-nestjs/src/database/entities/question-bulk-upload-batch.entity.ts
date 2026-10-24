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

@Entity('question_bulk_upload_batches')
@Index(['questionType', 'createdAt'])
export class QuestionBulkUploadBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  batchCode: string;

  @Column({ type: 'varchar', length: 100 })
  batchName: string;

  @Column({ type: 'varchar', length: 20 })
  questionType: 'MCQ' | 'CODING';

  @Column({ type: 'varchar', length: 500 })
  originalFilename: string;

  @Column({ type: 'int', default: 0 })
  totalQuestions: number;

  @Column({ type: 'int', default: 0 })
  successfulQuestions: number;

  @Column({ type: 'int', default: 0 })
  failedQuestions: number;

  @Column({ type: 'varchar', length: 30, default: 'PROCESSING' })
  status: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy?: User;

  @Column({ type: 'uuid', nullable: true })
  uploaded_by_id?: string;

  @Column({ type: 'jsonb', default: [] })
  failureDetails: any[];

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
