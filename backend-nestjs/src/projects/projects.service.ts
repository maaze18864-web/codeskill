import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import {
  LabProjectAssignment,
  LabProjectTemplate,
  validateLabProjectTemplate,
} from './lab-project-template';
import { ProjectWorkspace } from '../database/entities/project-workspace.entity';
import {
  createProjectTemplate,
  projectCatalog,
  validateProjectFiles,
  validateProjectDirectories,
} from './project-catalog';
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

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectWorkspace)
    private readonly projects: Repository<ProjectWorkspace>,
    private readonly config: ConfigService,
  ) {}

  catalog() {
    return { catalog: projectCatalog };
  }
  async list(ownerId: string) {
    return {
      projects: await this.projects.find({
        where: { ownerId },
        select: {
          id: true,
          name: true,
          mode: true,
          frontendStack: true,
          backendStack: true,
          revision: true,
          createdAt: true,
          updatedAt: true,
        },
        order: { updatedAt: 'DESC' },
        take: 100,
      }),
    };
  }
  async owned(ownerId: string, id: string, includeFiles = true) {
    const project = await this.projects.findOne({
      where: { id, ownerId },
      ...(!includeFiles
        ? {
            select: {
              id: true,
              ownerId: true,
              frontendStack: true,
              backendStack: true,
            },
          }
        : {}),
    });
    if (!project) throw new NotFoundException('Project not found.');
    return project;
  }
  async get(ownerId: string, id: string) {
    return { project: await this.owned(ownerId, id) };
  }
  async create(ownerId: string, dto: CreateProjectDto) {
    if ((await this.projects.countBy({ ownerId })) >= 100)
      throw new ConflictException('You can keep up to 100 projects.');
    return {
      project: await this.projects.save(
        this.projects.create({
          ownerId,
          ...createProjectTemplate(dto),
          revision: 1,
          directories: [],
        }),
      ),
    };
  }
  async openLabProject(
    ownerId: string,
    assignment: LabProjectAssignment,
    input: LabProjectTemplate,
  ) {
    const where = { ownerId, labProblemId: assignment.problemId };
    const existing = await this.projects.findOne({ where });
    if (existing) return { project: existing };
    if ((await this.projects.countBy({ ownerId })) >= 100)
      throw new ConflictException('You can keep up to 100 projects.');
    const template = validateLabProjectTemplate(input);
    // A unique owner/problem index makes concurrent opens return the same draft.
    await this.projects
      .createQueryBuilder()
      .insert()
      .into(ProjectWorkspace)
      .values({
        ownerId,
        name: template.name,
        mode: template.mode,
        frontendStack: template.frontendStack || null,
        backendStack: template.backendStack || null,
        files: template.files,
        directories: template.directories || [],
        revision: 1,
        labProblemId: assignment.problemId,
        labAssignment: assignment,
      })
      .orIgnore()
      .execute();
    const project = await this.projects.findOne({ where });
    if (!project)
      throw new ConflictException(
        'Could not open this lab project. Please retry.',
      );
    return { project };
  }
  async save(ownerId: string, id: string, dto: SaveProjectDto) {
    const project = await this.owned(ownerId, id);
    const files = validateProjectFiles(dto.files);
    const directories = validateProjectDirectories(
      dto.directories ?? project.directories ?? [],
      files,
    );
    const result = await this.projects
      .createQueryBuilder()
      .update(ProjectWorkspace)
      .set({
        files,
        directories,
        revision: () => 'revision + 1',
        updatedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('id = :id AND owner_id = :ownerId AND revision = :revision', {
        id,
        ownerId,
        revision: dto.revision,
      })
      .execute();
    if (!result.affected)
      throw new ConflictException(
        'This project changed in another tab. Download your edits before reloading.',
      );
    return this.get(ownerId, id);
  }
  async remove(ownerId: string, id: string) {
    await this.owned(ownerId, id, false);
    // Do not discard durable files while a runtime cannot be stopped.
    await this.runner(ownerId, id, 'DELETE', '/runtime');
    await this.projects.delete({ id, ownerId });
    return { deleted: true };
  }
  private async runner(
    ownerId: string,
    id: string,
    method: string,
    suffix: string,
    data?: unknown,
  ) {
    const url = this.config.get<string>('PROJECT_RUNNER_URL');
    const token = this.config.get<string>('PROJECT_RUNNER_TOKEN');
    if (!url || !token || token.length < 32)
      throw new ServiceUnavailableException(
        'Project runtime is offline. Your saved files are safe. Ask an administrator to start the project runner.',
      );
    try {
      const response = await axios.request<unknown>({
        url: `${url.replace(/\/$/, '')}/projects/${id}${suffix}`,
        method,
        data,
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Project-Owner': ownerId,
        },
        timeout: suffix === '/runtime' && method === 'POST' ? 90000 : 25000,
        maxContentLength: 3000000,
        maxBodyLength: 3000000,
        maxRedirects: 0,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError<{ message?: unknown }>(error)) {
        const status = error.response?.status;
        const detail = error.response?.data?.message;
        const message =
          typeof detail === 'string'
            ? detail.slice(0, 200)
            : 'The project runtime is unavailable. Saved files are safe.';
        if (status === 409 || status === 429)
          throw new ConflictException(message);
        if (status === 400) throw new BadRequestException(message);
        if (status === 404) throw new NotFoundException(message);
        if (status === 502 || status === 504)
          throw new BadGatewayException(message);
      }
      throw new BadGatewayException(
        'The project runtime is unavailable. Saved files are safe.',
      );
    }
  }
  async start(ownerId: string, id: string) {
    const project = await this.owned(ownerId, id);
    return this.runner(ownerId, id, 'POST', '/runtime', {
      revision: project.revision,
      frontendStack: project.frontendStack,
      backendStack: project.backendStack,
      files: project.files,
      directories: project.directories || [],
    });
  }
  async files(ownerId: string, id: string, dto: ProjectFilesReadDto) {
    await this.owned(ownerId, id, false);
    return this.runner(
      ownerId,
      id,
      'GET',
      `/files${dto.since ? `?since=${encodeURIComponent(dto.since)}` : ''}`,
    );
  }
  async runtime(
    ownerId: string,
    id: string,
    action: 'status' | 'stop' | 'sync' | 'heartbeat',
  ) {
    const project = await this.owned(ownerId, id, action === 'sync');
    if (action === 'stop')
      return this.runner(ownerId, id, 'DELETE', '/runtime');
    if (action === 'sync')
      return this.runner(ownerId, id, 'PUT', '/files', {
        files: project.files,
        directories: project.directories || [],
        revision: project.revision,
      });
    if (action === 'heartbeat')
      return this.runner(ownerId, id, 'POST', '/heartbeat');
    return this.runner(ownerId, id, 'GET', '/runtime');
  }
  async request(ownerId: string, id: string, dto: ProjectRequestDto) {
    const project = await this.owned(ownerId, id, false);
    if (!project.backendStack && project.frontendStack !== 'nextjs')
      throw new BadRequestException('This project has no backend.');
    if (
      !dto.path.startsWith('/') ||
      dto.path.startsWith('//') ||
      /[\r\n\\]/.test(dto.path)
    )
      throw new BadRequestException(
        'Use a relative API path such as /api/hello.',
      );
    return this.runner(ownerId, id, 'POST', '/request', dto);
  }
  async command(ownerId: string, id: string, dto: ProjectCommandDto) {
    await this.owned(ownerId, id, false);
    return this.runner(ownerId, id, 'POST', '/command', dto);
  }
  private async terminalRunner(
    ownerId: string,
    id: string,
    method: string,
    path: string,
    data?: unknown,
  ) {
    await this.owned(ownerId, id, false);
    return this.runner(ownerId, id, method, `/terminal${path}`, data);
  }
  startTerminal(ownerId: string, id: string, dto: ProjectTerminalSizeDto) {
    return this.terminalRunner(ownerId, id, 'POST', '', dto);
  }
  readTerminal(
    ownerId: string,
    id: string,
    terminalId: string,
    dto: ProjectTerminalReadDto,
  ) {
    return this.terminalRunner(
      ownerId,
      id,
      'GET',
      `/${encodeURIComponent(terminalId)}?after=${dto.after}`,
    );
  }
  writeTerminal(
    ownerId: string,
    id: string,
    terminalId: string,
    dto: ProjectTerminalInputDto,
  ) {
    return this.terminalRunner(
      ownerId,
      id,
      'POST',
      `/${encodeURIComponent(terminalId)}/input`,
      dto,
    );
  }
  resizeTerminal(
    ownerId: string,
    id: string,
    terminalId: string,
    dto: ProjectTerminalSizeDto,
  ) {
    return this.terminalRunner(
      ownerId,
      id,
      'PUT',
      `/${encodeURIComponent(terminalId)}/size`,
      dto,
    );
  }
  closeTerminal(ownerId: string, id: string, terminalId: string) {
    return this.terminalRunner(
      ownerId,
      id,
      'DELETE',
      `/${encodeURIComponent(terminalId)}`,
    );
  }
}
