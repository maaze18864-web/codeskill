import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectWorkspace } from '../database/entities/project-workspace.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
@Module({
  imports: [TypeOrmModule.forFeature([ProjectWorkspace])],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
