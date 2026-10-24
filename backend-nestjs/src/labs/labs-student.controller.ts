import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { LabsService } from './labs.service';
import { RecordLabProgressDto, ExecuteLabSqlDto } from './dto/labs.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Student Labs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('labs')
export class LabsStudentController {
  constructor(private readonly labsService: LabsService) {}

  @Get()
  @ApiOperation({ summary: 'Labs available to the enrolled student' })
  myLabs(@CurrentUser() user: User) {
    return this.labsService.getMyLabs(user);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Student lab progress dashboard' })
  myProgress(@CurrentUser() user: User) {
    return this.labsService.getMyProgress(user);
  }

  @Get(':labId')
  @ApiOperation({ summary: 'List experiments in a lab' })
  experiments(@Param('labId') labId: string, @CurrentUser() user: User) {
    return this.labsService.getLabExperimentsForUser(user, labId);
  }

  @Get(':labId/experiments/:experimentId')
  @ApiOperation({ summary: 'Open experiment workspace' })
  workspace(
    @Param('labId') labId: string,
    @Param('experimentId') experimentId: string,
    @CurrentUser() user: User,
  ) {
    return this.labsService.getExperimentWorkspace(user, labId, experimentId);
  }

  @Post(':labId/progress')
  @ApiOperation({ summary: 'Record lab problem progress after submission' })
  recordProgress(
    @Param('labId') labId: string,
    @Body() dto: RecordLabProgressDto,
    @CurrentUser() user: User,
  ) {
    return this.labsService.recordProgress(user, labId, dto);
  }
  @Post(':labId/experiments/:experimentId/sql/:problemId')
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 10, ttl: 10000 },
    long: { limit: 30, ttl: 60000 },
  })
  executeSql(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Param('experimentId', ParseUUIDPipe) experimentId: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Body() dto: ExecuteLabSqlDto,
    @CurrentUser() user: User,
  ) {
    return this.labsService.executeSql(
      user,
      labId,
      experimentId,
      problemId,
      dto.code,
      dto.mode === 'submit',
    );
  }
  @Post(':labId/experiments/:experimentId/projects/:problemId')
  openProject(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Param('experimentId', ParseUUIDPipe) experimentId: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @CurrentUser() user: User,
  ) {
    return this.labsService.openProjectProblem(
      user,
      labId,
      experimentId,
      problemId,
    );
  }
}
