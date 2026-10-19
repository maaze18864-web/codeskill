import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BugActivity } from '../database/entities/bug-activity.entity';
import { BugComment } from '../database/entities/bug-comment.entity';
import { BugImage } from '../database/entities/bug-image.entity';
import { BugReport } from '../database/entities/bug-report.entity';
import { BugsController } from './bugs.controller';
import { BugsService } from './bugs.service';

@Module({
  imports: [TypeOrmModule.forFeature([BugReport, BugImage, BugComment, BugActivity])],
  controllers: [BugsController],
  providers: [BugsService],
})
export class BugsModule {}
