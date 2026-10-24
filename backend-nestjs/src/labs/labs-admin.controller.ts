import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { LabsService } from './labs.service';
import { LabsDashboardQueryDto } from './dto/labs-dashboard-query.dto';
import {
  AssignLabToSectionsDto,
  AssignTeacherDto,
  AttachLabProblemDto,
  CreateLabDto,
  CreateLabExperimentDto,
  CreateLabSectionDto,
  CreateLabSubgroupDto,
  EnrollStudentsDto,
  UpdateLabDto,
  UpdateLabExperimentDto,
  UpdateLabSectionDto,
  SaveLabProjectProblemDto,
  SaveLabSqlProblemDto,
  LabMarksDto,
} from './dto/labs.dto';

@ApiTags('Admin Labs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/labs')
export class LabsAdminController {
  constructor(private readonly labsService: LabsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Labs admin overview metrics' })
  getDashboard(@Query() query: LabsDashboardQueryDto) {
    return this.labsService.getAdminDashboard(query.sectionId, query.labId);
  }

  @Get('teachers')
  @ApiOperation({ summary: 'List users eligible as lab teachers' })
  listTeachers() {
    return this.labsService.listTeachers();
  }

  // ── Sections ───────────────────────────────────────────────────────

  @Post('sections')
  createSection(@Body() dto: CreateLabSectionDto, @CurrentUser() user: User) {
    return this.labsService.createSection(dto, user);
  }

  @Get('sections')
  listSections() {
    return this.labsService.listSections();
  }

  @Get('sections/:id')
  getSection(@Param('id') id: string) {
    return this.labsService.getSectionById(id);
  }

  @Put('sections/:id')
  updateSection(@Param('id') id: string, @Body() dto: UpdateLabSectionDto) {
    return this.labsService.updateSection(id, dto);
  }

  @Delete('sections/:id')
  deleteSection(@Param('id') id: string) {
    return this.labsService.deleteSection(id);
  }

  @Post('sections/:id/subgroups')
  addSubgroup(@Param('id') id: string, @Body() dto: CreateLabSubgroupDto) {
    return this.labsService.addSubgroup(id, dto);
  }

  @Delete('sections/:id/subgroups/:subgroupId')
  deleteSubgroup(
    @Param('id') id: string,
    @Param('subgroupId') subgroupId: string,
  ) {
    return this.labsService.deleteSubgroup(id, subgroupId);
  }

  @Post('sections/:id/enrollments')
  enrollStudents(@Param('id') id: string, @Body() dto: EnrollStudentsDto) {
    return this.labsService.enrollStudents(id, dto);
  }

  @Get('sections/:id/enrollments')
  listEnrollments(@Param('id') id: string) {
    return this.labsService.listEnrollments(id);
  }

  @Delete('sections/:id/enrollments/:enrollmentId')
  removeEnrollment(
    @Param('id') id: string,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.labsService.removeEnrollment(id, enrollmentId);
  }

  // ── Catalog ────────────────────────────────────────────────────────

  @Post()
  createLab(@Body() dto: CreateLabDto, @CurrentUser() user: User) {
    return this.labsService.createLab(dto, user);
  }

  @Get()
  listLabs() {
    return this.labsService.listLabs();
  }

  @Get(':id')
  getLab(@Param('id') id: string) {
    return this.labsService.getLabById(id);
  }

  @Put(':id')
  updateLab(@Param('id') id: string, @Body() dto: UpdateLabDto) {
    return this.labsService.updateLab(id, dto);
  }

  @Delete(':id')
  deleteLab(@Param('id') id: string) {
    return this.labsService.deleteLab(id);
  }

  @Post(':id/sections')
  assignSections(@Param('id') id: string, @Body() dto: AssignLabToSectionsDto) {
    return this.labsService.assignLabToSections(id, dto);
  }

  @Delete(':id/sections/:sectionId')
  unassignSection(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
  ) {
    return this.labsService.unassignLabFromSection(id, sectionId);
  }

  @Post(':id/teachers')
  assignTeacher(@Param('id') id: string, @Body() dto: AssignTeacherDto) {
    return this.labsService.assignTeacher(id, dto);
  }

  @Delete(':id/teachers/:assignmentId')
  removeTeacher(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.labsService.removeTeacherAssignment(id, assignmentId);
  }

  @Post(':id/experiments')
  createExperiment(
    @Param('id') id: string,
    @Body() dto: CreateLabExperimentDto,
  ) {
    return this.labsService.createExperiment(id, dto);
  }

  @Put(':id/experiments/:experimentId')
  updateExperiment(
    @Param('id') id: string,
    @Param('experimentId') experimentId: string,
    @Body() dto: UpdateLabExperimentDto,
  ) {
    return this.labsService.updateExperiment(id, experimentId, dto);
  }

  @Delete(':id/experiments/:experimentId')
  deleteExperiment(
    @Param('id') id: string,
    @Param('experimentId') experimentId: string,
  ) {
    return this.labsService.deleteExperiment(id, experimentId);
  }

  @Post(':id/experiments/:experimentId/problems')
  attachProblem(
    @Param('id') id: string,
    @Param('experimentId') experimentId: string,
    @Body() dto: AttachLabProblemDto,
  ) {
    return this.labsService.attachProblem(id, experimentId, dto);
  }

  @Delete(':id/experiments/:experimentId/problems/:problemLinkId')
  detachProblem(
    @Param('id') id: string,
    @Param('experimentId') experimentId: string,
    @Param('problemLinkId') problemLinkId: string,
  ) {
    return this.labsService.detachProblem(id, experimentId, problemLinkId);
  }

  @Post(':id/experiments/:experimentId/project-problems')
  createProjectProblem(
    @Param('id') id: string,
    @Param('experimentId') experimentId: string,
    @Body() dto: SaveLabProjectProblemDto,
  ) {
    return this.labsService.saveProjectProblem(id, experimentId, dto);
  }
  @Post(':id/experiments/:experimentId/sql-problems')
  createSql(
    @Param('id') id: string,
    @Param('experimentId') experimentId: string,
    @Body() dto: SaveLabSqlProblemDto,
  ) {
    return this.labsService.saveSqlProblem(id, experimentId, dto);
  }
  @Put(':id/experiments/:experimentId/sql-problems/:problemId')
  updateSql(
    @Param('id') id: string,
    @Param('experimentId') experimentId: string,
    @Param('problemId') problemId: string,
    @Body() dto: SaveLabSqlProblemDto,
  ) {
    return this.labsService.saveSqlProblem(id, experimentId, dto, problemId);
  }
  @Put(':id/experiments/:experimentId/problems/:problemId/marks')
  practiceMarks(
    @Param('id') id: string,
    @Param('experimentId') experimentId: string,
    @Param('problemId') problemId: string,
    @Body() dto: LabMarksDto,
  ) {
    return this.labsService.setPracticeMarks(
      id,
      experimentId,
      problemId,
      dto.maxScore,
    );
  }
  @Put(':id/experiments/:experimentId/assessments/:assessmentId/marks')
  assessmentMarks(
    @Param('id') id: string,
    @Param('experimentId') experimentId: string,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: LabMarksDto,
  ) {
    return this.labsService.setAssessmentMarks(
      id,
      experimentId,
      assessmentId,
      dto.maxScore,
    );
  }

  @Put(':id/experiments/:experimentId/project-problems/:problemId')
  updateProjectProblem(
    @Param('id') id: string,
    @Param('experimentId') experimentId: string,
    @Param('problemId') problemId: string,
    @Body() dto: SaveLabProjectProblemDto,
  ) {
    return this.labsService.saveProjectProblem(
      id,
      experimentId,
      dto,
      problemId,
    );
  }

  @Get(':id/metrics')
  teacherMetricsAsAdmin(
    @Param('id') id: string,
    @Query('sectionId') sectionId: string,
    @CurrentUser() user: User,
  ) {
    return this.labsService.getTeacherMetrics(user, id, sectionId);
  }
}
