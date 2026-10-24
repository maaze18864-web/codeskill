import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TeacherGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { LabsService } from './labs.service';
import { LabsDashboardQueryDto } from './dto/labs-dashboard-query.dto';

@ApiTags('Teacher Labs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TeacherGuard)
@Controller('teacher/labs')
export class LabsTeacherController {
  constructor(private readonly labsService: LabsService) {}

  @Get()
  @ApiOperation({ summary: 'List labs assigned to the teacher' })
  list(@CurrentUser() user: User) {
    return this.labsService.getTeacherLabs(user);
  }

  @Get('dashboard')
  @ApiOperation({
    summary:
      'Lab participation and progress for assigned subject-sections only',
  })
  dashboard(@Query() query: LabsDashboardQueryDto, @CurrentUser() user: User) {
    return this.labsService.getTeacherDashboard(
      user,
      query.sectionId,
      query.labId,
    );
  }

  @Get(':labId/metrics')
  @ApiOperation({ summary: 'Class metrics for a lab + section' })
  metrics(
    @Param('labId') labId: string,
    @Query('sectionId') sectionId: string,
    @CurrentUser() user: User,
  ) {
    return this.labsService.getTeacherMetrics(user, labId, sectionId);
  }

  @Get(':labId/experiments')
  experiments(@Param('labId') labId: string, @CurrentUser() user: User) {
    return this.labsService.getLabExperimentsForUser(user, labId);
  }

  @Get(':labId/experiments/:experimentId')
  workspace(
    @Param('labId') labId: string,
    @Param('experimentId') experimentId: string,
    @CurrentUser() user: User,
  ) {
    return this.labsService.getExperimentWorkspace(user, labId, experimentId);
  }
}
