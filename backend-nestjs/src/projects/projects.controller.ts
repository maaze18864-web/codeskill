import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import {
  CreateProjectDto,
  ProjectCommandDto,
  ProjectFilesReadDto,
  ProjectRequestDto,
  ProjectTerminalInputDto,
  ProjectTerminalReadDto,
  ProjectTerminalSizeDto,
  SaveProjectDto,
} from './projects.dto';
import { ProjectsService } from './projects.service';
import { createProjectTemplate } from './project-catalog';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}
  @Get('catalog') catalog() {
    return this.projects.catalog();
  }
  @Post('template') template(@Body() dto: CreateProjectDto) {
    return { template: createProjectTemplate(dto) };
  }
  @Get() list(@CurrentUser() user: User) {
    return this.projects.list(user.id);
  }
  @Post() create(@CurrentUser() user: User, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.id, dto);
  }
  @Get(':id') get(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.get(user.id, id);
  }
  @Put(':id') save(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveProjectDto,
  ) {
    return this.projects.save(user.id, id, dto);
  }
  @Delete(':id') remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.remove(user.id, id);
  }
  @Post(':id/runtime') start(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.start(user.id, id);
  }
  @Get(':id/runtime') status(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.runtime(user.id, id, 'status');
  }
  @Delete(':id/runtime') stop(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.runtime(user.id, id, 'stop');
  }
  @Put(':id/runtime/files') sync(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.runtime(user.id, id, 'sync');
  }
  @Get(':id/runtime/files') files(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: ProjectFilesReadDto,
  ) {
    return this.projects.files(user.id, id, dto);
  }
  @Post(':id/runtime/heartbeat') heartbeat(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.runtime(user.id, id, 'heartbeat');
  }
  @Post(':id/request') request(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectRequestDto,
  ) {
    return this.projects.request(user.id, id, dto);
  }
  @Post(':id/command') command(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.projects.command(user.id, id, dto);
  }
  @Post(':id/terminal') startTerminal(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectTerminalSizeDto,
  ) {
    return this.projects.startTerminal(user.id, id, dto);
  }
  @Get(':id/terminal/:terminalId')
  @Throttle({
    short: { ttl: 1000, limit: 50 },
    medium: { ttl: 10000, limit: 400 },
    long: { ttl: 60000, limit: 2000 },
  })
  readTerminal(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('terminalId', ParseUUIDPipe) terminalId: string,
    @Query() dto: ProjectTerminalReadDto,
  ) {
    return this.projects.readTerminal(user.id, id, terminalId, dto);
  }
  @Post(':id/terminal/:terminalId/input')
  @Throttle({
    short: { ttl: 1000, limit: 50 },
    medium: { ttl: 10000, limit: 400 },
    long: { ttl: 60000, limit: 2000 },
  })
  writeTerminal(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('terminalId', ParseUUIDPipe) terminalId: string,
    @Body() dto: ProjectTerminalInputDto,
  ) {
    return this.projects.writeTerminal(user.id, id, terminalId, dto);
  }
  @Put(':id/terminal/:terminalId/size') resizeTerminal(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('terminalId', ParseUUIDPipe) terminalId: string,
    @Body() dto: ProjectTerminalSizeDto,
  ) {
    return this.projects.resizeTerminal(user.id, id, terminalId, dto);
  }
  @Delete(':id/terminal/:terminalId') closeTerminal(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('terminalId', ParseUUIDPipe) terminalId: string,
  ) {
    return this.projects.closeTerminal(user.id, id, terminalId);
  }
}
