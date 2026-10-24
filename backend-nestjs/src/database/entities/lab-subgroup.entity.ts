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
import { LabSection } from './lab-section.entity';

@Entity('lab_subgroups')
@Index(['lab_section_id', 'code'], { unique: true })
export class LabSubgroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LabSection, (section) => section.subgroups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'lab_section_id' })
  section: LabSection;

  @Column({ type: 'uuid' })
  lab_section_id: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
