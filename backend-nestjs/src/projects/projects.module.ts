import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectWorkspace } from '../database/entities/project-workspace.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { LabsAccessGuard } from '../common/guards/labs-access.guard';
@Module({
  imports: [TypeOrmModule.forFeature([ProjectWorkspace])],
  controllers: [ProjectsController],
  providers: [ProjectsService, LabsAccessGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
