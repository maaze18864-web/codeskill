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
import { LabSection } from './lab-section.entity';

export type LabTeacherRole = 'owner' | 'instructor' | 'ta';

@Entity('lab_teacher_assignments')
@Index(['lab_section_id', 'lab_id', 'teacher_id'], { unique: true })
export class LabTeacherAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LabSection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_section_id' })
  section: LabSection;

  @Column({ type: 'uuid' })
  lab_section_id: string;

  @ManyToOne(() => Lab, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_id' })
  lab: Lab;

  @Column({ type: 'uuid' })
  lab_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ type: 'uuid' })
  teacher_id: string;

  @Column({ type: 'varchar', length: 20, default: 'instructor' })
  role: LabTeacherRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
