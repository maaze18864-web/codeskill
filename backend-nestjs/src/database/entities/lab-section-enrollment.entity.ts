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
import { LabSection } from './lab-section.entity';
import { LabSubgroup } from './lab-subgroup.entity';

export type LabEnrollmentStatus = 'invited' | 'active' | 'completed' | 'dropped';

@Entity('lab_section_enrollments')
@Index(['lab_section_id', 'student_id'], { unique: true })
export class LabSectionEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LabSection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_section_id' })
  section: LabSection;

  @Column({ type: 'uuid' })
  lab_section_id: string;

  @ManyToOne(() => LabSubgroup, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'lab_subgroup_id' })
  subgroup?: LabSubgroup;

  @Column({ type: 'uuid', nullable: true })
  lab_subgroup_id?: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ type: 'uuid' })
  student_id: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: LabEnrollmentStatus;

  @CreateDateColumn()
  enrolledAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
