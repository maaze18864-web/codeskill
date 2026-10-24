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
import { Lab } from './lab.entity';
import { LabSection } from './lab-section.entity';

@Entity('lab_section_assignments')
@Index(['lab_id', 'lab_section_id'], { unique: true })
export class LabSectionAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Lab, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_id' })
  lab: Lab;

  @Column({ type: 'uuid' })
  lab_id: string;

  @ManyToOne(() => LabSection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_section_id' })
  section: LabSection;

  @Column({ type: 'uuid' })
  lab_section_id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
