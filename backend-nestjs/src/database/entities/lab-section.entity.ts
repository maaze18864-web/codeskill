import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { LabSubgroup } from './lab-subgroup.entity';

@Entity('lab_sections')
@Index(['code'], { unique: true })
export class LabSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  department?: string;

  @Column({ type: 'int', nullable: true })
  semester?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  academicYear?: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: User;

  @Column({ type: 'uuid', nullable: true })
  created_by_id?: string;

  @OneToMany(() => LabSubgroup, (subgroup) => subgroup.section)
  subgroups: LabSubgroup[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
