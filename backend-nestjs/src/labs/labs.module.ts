import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabSection } from '../database/entities/lab-section.entity';
import { LabSubgroup } from '../database/entities/lab-subgroup.entity';
import { LabSectionEnrollment } from '../database/entities/lab-section-enrollment.entity';
import { Lab } from '../database/entities/lab.entity';
import { LabSectionAssignment } from '../database/entities/lab-section-assignment.entity';
import { LabTeacherAssignment } from '../database/entities/lab-teacher-assignment.entity';
import { LabExperiment } from '../database/entities/lab-experiment.entity';
import { LabExperimentProblem } from '../database/entities/lab-experiment-problem.entity';
import { LabProblemProgress } from '../database/entities/lab-problem-progress.entity';
import { ProblemMetadata } from '../database/entities/problem-metadata.entity';
import { User } from '../database/entities/user.entity';
import { LabsService } from './labs.service';
import { LabsAdminController } from './labs-admin.controller';
import { LabsTeacherController } from './labs-teacher.controller';
import { LabsStudentController } from './labs-student.controller';
import { ProjectsModule } from '../projects/projects.module';
import { Assessment } from '../database/entities/assessment.entity';
import { Question } from '../database/entities/question.entity';
import { AssessmentAttempt } from '../database/entities/assessment-attempt.entity';
import { SqlModule } from '../sql/sql.module';
import { SubmissionShardingModule } from '../database/sharding/sharding.module';

@Module({
  imports: [
    ProjectsModule,
    SqlModule,
    SubmissionShardingModule,
    TypeOrmModule.forFeature([
      LabSection,
      LabSubgroup,
      LabSectionEnrollment,
      Lab,
      LabSectionAssignment,
      LabTeacherAssignment,
      LabExperiment,
      LabExperimentProblem,
      LabProblemProgress,
      ProblemMetadata,
      User,
      Assessment,
      AssessmentAttempt,
      Question,
    ]),
  ],
  controllers: [
    LabsAdminController,
    LabsTeacherController,
    LabsStudentController,
  ],
  providers: [LabsService],
  exports: [LabsService],
})
export class LabsModule {}
