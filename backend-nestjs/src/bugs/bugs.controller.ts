import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AssignBugDto } from './dto/assign-bug.dto';
import { CreateBugCommentDto } from './dto/create-bug-comment.dto';
import { CreateBugDto } from './dto/create-bug.dto';
import { UpdateBugDto } from './dto/update-bug.dto';
import { UpdateBugCommentDto } from './dto/update-bug-comment.dto';
import { BugsService } from './bugs.service';

const MAX_IMAGES_PER_UPLOAD = 10;
const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

function imageFilter(
  _request: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!allowedImageTypes.has(file.mimetype)) {
    callback(new BadRequestException('Images must be PNG, JPG, or WebP.'), false);
    return;
  }
  callback(null, true);
}

const imageUploadInterceptor = FilesInterceptor('images', MAX_IMAGES_PER_UPLOAD, {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_IMAGES_PER_UPLOAD },
  fileFilter: imageFilter,
});

@ApiTags('Admin Bugs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/bugs')
export class BugsController {
  constructor(private readonly bugsService: BugsService) {}

  @Get()
  @ApiOperation({ summary: 'List reported bugs with status counts' })
  list(
    @Query('search') search = '',
    @Query('sort') sort: 'newest' | 'oldest' | 'priority' = 'newest',
  ) {
    return this.bugsService.list(search, sort);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(imageUploadInterceptor)
  @ApiOperation({ summary: 'Report a bug with optional screenshots' })
  create(
    @Body() dto: CreateBugDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @CurrentUser() user: any,
  ) {
    return this.bugsService.create(dto, files, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a bug report, comments, images, and activity' })
  getOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bugsService.getOne(id, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a bug report title and description' })
  updateBug(
    @Param('id') id: string,
    @Body() dto: UpdateBugDto,
    @CurrentUser() user: any,
  ) {
    return this.bugsService.updateBug(id, dto, user);
  }

  @Put(':id/assign')
  @ApiOperation({ summary: 'Claim a new bug for work' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignBugDto,
    @CurrentUser() user: any,
  ) {
    return this.bugsService.assign(id, dto.assigneeName, user);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Mark a bug fixed or reopen it' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'fixed' | 'new',
    @CurrentUser() user: any,
  ) {
    if (status !== 'fixed' && status !== 'new') {
      throw new BadRequestException('Status must be fixed or new.');
    }
    return this.bugsService.updateStatus(id, status, user);
  }

  @Post(':id/images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(imageUploadInterceptor)
  @ApiOperation({ summary: 'Attach additional screenshots to a bug' })
  addImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @CurrentUser() user: any,
  ) {
    return this.bugsService.addImages(id, files, user);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a bug report' })
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateBugCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.bugsService.addComment(id, dto, user);
  }

  @Put(':id/comments/:commentId')
  @ApiOperation({ summary: 'Edit a comment written by the current user' })
  updateComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateBugCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.bugsService.updateComment(id, commentId, dto.text, user);
  }
}
