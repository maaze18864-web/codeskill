import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Admin - Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of students with filters' })
  async findAll(@Query() query: QueryStudentsDto) {
    return this.studentsService.findAll(query);
  }

  @Get('email-status')
  @ApiOperation({
    summary: 'Get delivery metrics and log entries for credential emails',
  })
  async getEmailStatus(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.studentsService.getEmailStatus(
      Number(page) || 1,
      Number(limit) || 20,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single student details' })
  @ApiParam({ name: 'id', description: 'Student User ID' })
  async findById(@Param('id') id: string) {
    return this.studentsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new assessment student' })
  async create(
    @Body() dto: CreateStudentDto,
    @CurrentUser() adminUser: any,
    @Req() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.studentsService.create(dto, adminUser, ip, userAgent);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update student profile/details' })
  @ApiParam({ name: 'id', description: 'Student User ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() adminUser: any,
    @Req() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.studentsService.update(id, dto, adminUser, ip, userAgent);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Activate or deactivate a student' })
  @ApiParam({ name: 'id', description: 'Student User ID' })
  async setStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @CurrentUser() adminUser: any,
    @Req() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.studentsService.setActiveStatus(
      id,
      isActive,
      adminUser,
      ip,
      userAgent,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate (soft delete) a student' })
  @ApiParam({ name: 'id', description: 'Student User ID' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() adminUser: any,
    @Req() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.studentsService.setActiveStatus(
      id,
      false,
      adminUser,
      ip,
      userAgent,
    );
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin resets student password to a temporary password',
  })
  @ApiParam({ name: 'id', description: 'Student User ID' })
  async resetPassword(
    @Param('id') id: string,
    @CurrentUser() adminUser: any,
    @Req() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.studentsService.resetPassword(id, adminUser, ip, userAgent);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Upload and validate spreadsheet (XLSX/CSV) for bulk student import',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    }),
  )
  async importPreview(
    @UploadedFile() file: Express.Multer.File,
    @Body('defaultBatch') defaultBatch?: string,
    @Body('defaultDepartment') defaultDepartment?: string,
    @Body('defaultCourse') defaultCourse?: string,
    @Body('defaultSemester') defaultSemester?: string,
    @Body('defaultYear') defaultYear?: string,
    @Body('defaultUniversity') defaultUniversity?: string,
    @Body('sheetName') sheetName?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Spreadsheet file is required');
    }
    const defaultOptions = {
      defaultBatch: defaultBatch?.trim(),
      defaultDepartment: defaultDepartment?.trim(),
      defaultCourse: defaultCourse?.trim(),
      defaultSemester: defaultSemester ? Number(defaultSemester) : undefined,
      defaultYear: defaultYear ? Number(defaultYear) : undefined,
      defaultUniversity: defaultUniversity?.trim(),
      sheetName: sheetName?.trim(),
    };
    return this.studentsService.parseAndValidateImport(file.buffer, defaultOptions, true);
  }

  @Post('import/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Commit validated students import into database with idempotent duplicate handling',
  })
  async confirmImport(
    @Body('validRows') validRows: any[],
    @Body('defaultOptions') defaultOptions: any,
    @CurrentUser() adminUser: any,
    @Req() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.studentsService.confirmImport(
      validRows,
      adminUser,
      ip,
      userAgent,
      defaultOptions,
    );
  }

  @Post('send-credentials')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enqueue credential dispatch emails into BullMQ queue',
  })
  async sendCredentials(
    @Body('jobIds') jobIds?: string[],
    @Body('portalUrl') portalUrl?: string,
  ) {
    return this.studentsService.sendCredentials(jobIds, portalUrl);
  }

  @Post(':id/send-credential')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enqueue single student credential email' })
  @ApiParam({ name: 'id', description: 'Student User ID' })
  async sendSingleCredential(
    @Param('id') studentId: string,
    @Body('portalUrl') portalUrl?: string,
  ) {
    return this.studentsService.sendIndividualCredential(studentId, portalUrl);
  }

  @Post('retry-failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry all failed credential email jobs' })
  async retryFailed(@Body('portalUrl') portalUrl?: string) {
    return this.studentsService.retryFailedCredentials(portalUrl);
  }
}
