import { runInNewContext } from 'node:vm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  createProjectTemplate,
  projectCatalog,
  validateProjectFiles,
  validateProjectDirectories,
} from './project-catalog';
import { ProjectsService } from './projects.service';
import axios from 'axios';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ProjectTerminalInputDto,
  ProjectTerminalReadDto,
  ProjectTerminalSizeDto,
} from './projects.dto';

describe('Project workspaces', () => {
  it('validates durable empty folders and rejects traversal and file/folder collisions', () => {
    expect(
      validateProjectDirectories(
        ['src/empty', 'src/empty'],
        [{ path: 'README.md', content: '' }],
      ),
    ).toEqual(['src/empty']);
    for (const path of [
      '../outside',
      '/tmp/a',
      'a//b',
      'node_modules/a',
      'README.md',
      'README.md/nested',
    ])
      expect(() =>
        validateProjectDirectories(
          [path],
          [{ path: 'README.md', content: '' }],
        ),
      ).toThrow(BadRequestException);
  });
  it('checks ownership before every terminal operation', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new ProjectsService(
      repo as never,
      { get: jest.fn() } as never,
    );
    for (const call of [
      () => service.startTerminal('other', 'p', { cols: 80, rows: 24 }),
      () => service.readTerminal('other', 'p', 't', { after: 0 }),
      () => service.writeTerminal('other', 'p', 't', { data: 'pwd\r' }),
      () => service.resizeTerminal('other', 'p', 't', { cols: 80, rows: 24 }),
      () => service.closeTerminal('other', 'p', 't'),
      () => service.files('other', 'p', {}),
    ])
      await expect(call()).rejects.toThrow(NotFoundException);
  });
  it('reads runtime files only through the authenticated private runner', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'p', ownerId: 'u' }),
    };
    const service = new ProjectsService(
      repo as never,
      {
        get: (key: string) =>
          key === 'PROJECT_RUNNER_URL'
            ? 'http://runner:5080'
            : 'private-token-'.repeat(4),
      } as never,
    );
    const request = jest.spyOn(axios, 'request').mockResolvedValueOnce({
      data: { files: [], directories: ['new_folder'] },
    });
    try {
      const result = await service.files('u', 'p', { since: 'a'.repeat(64) });
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: `http://runner:5080/projects/p/files?since=${'a'.repeat(64)}`,
        }),
      );
      expect(result).toEqual({ files: [], directories: ['new_folder'] });
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p', ownerId: 'u' } }),
      );
    } finally {
      request.mockRestore();
    }
  });
  it('relays terminal reads through the private runner with ownership and no browser-visible token', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'p', ownerId: 'u' }),
    };
    const secret = 'private-runner-token-'.repeat(3);
    const config = {
      get: jest.fn((key: string) =>
        key === 'PROJECT_RUNNER_URL' ? 'http://runner:5080' : secret,
      ),
    };
    const service = new ProjectsService(repo as never, config as never);
    const request = jest.spyOn(axios, 'request').mockResolvedValueOnce({
      data: { cursor: 7, data: 'cHdk', alive: true },
    });
    try {
      const result = await service.readTerminal('u', 'p', 't', { after: 6 });
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://runner:5080/projects/p/terminal/t?after=6',
          headers: {
            Authorization: `Bearer ${secret}`,
            'X-Project-Owner': 'u',
          },
        }),
      );
      expect(JSON.stringify(result)).not.toContain(secret);
    } finally {
      request.mockRestore();
    }
  });
  it('rejects invalid PTY geometry, oversized input, and invalid output cursors', async () => {
    for (const value of [
      { cols: 0, rows: 24 },
      { cols: 80, rows: 999 },
      { cols: 80.5, rows: 24 },
    ])
      expect(
        (await validate(plainToInstance(ProjectTerminalSizeDto, value))).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(ProjectTerminalSizeDto, { cols: 120, rows: 32 }),
      ),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(ProjectTerminalInputDto, { data: 'x'.repeat(8193) }),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(ProjectTerminalReadDto, { after: '-1' })))
        .length,
    ).toBeGreaterThan(0);
  });
  it('generates a valid Next.js base path configuration and Spring Boot starter', () => {
    const project = createProjectTemplate({
      name: 'Next + Spring',
      mode: 'fullstack',
      frontendStack: 'nextjs',
      backendStack: 'springboot',
    });
    const source = project.files.find(
      (f) => f.path === 'frontend/next.config.mjs',
    )!.content;
    const config: unknown = runInNewContext(
      source.replace('export default', 'globalThis.config ='),
      { process: { env: { PROJECT_PREVIEW_BASE: '/p/test/' } } },
    );
    expect(config).toMatchObject({ basePath: '/p/test' });
    expect(project.files.some((f) => f.path.endsWith('Application.java'))).toBe(
      true,
    );
    expect(
      project.files.some((f) => f.path === 'frontend/app/api/hello/route.js'),
    ).toBe(true);
  });

  test.each([
    '../secret',
    '/etc/passwd',
    'a/../../x',
    'a\\b',
    'a//b',
    'frontend/node_modules/x',
    '.git/config',
  ])('rejects unsafe path %s', (path) => {
    expect(() => validateProjectFiles([{ path, content: '' }])).toThrow(
      BadRequestException,
    );
  });
  it('rejects duplicate paths, file/folder collisions and oversized UTF-8 content', () => {
    expect(() =>
      validateProjectFiles([
        { path: 'a', content: '' },
        { path: 'a', content: '' },
      ]),
    ).toThrow();
    expect(() =>
      validateProjectFiles([
        { path: 'a', content: '' },
        { path: 'a/b', content: '' },
      ]),
    ).toThrow();
    expect(() =>
      validateProjectFiles([{ path: 'main.js', content: '😀'.repeat(60000) }]),
    ).toThrow();
  });
  it('builds every selectable frontend/backend combination with separate source files', () => {
    for (const frontend of projectCatalog.frontend)
      for (const backend of projectCatalog.backend) {
        const p = createProjectTemplate({
          name: 'Example',
          mode: 'fullstack',
          frontendStack: frontend.id,
          backendStack: backend.id,
        });
        expect(p.frontendStack).toBe(frontend.id);
        expect(p.backendStack).toBe(backend.id);
        expect(p.files.some((f) => f.path.startsWith('frontend/'))).toBe(true);
        expect(p.files.some((f) => f.path.startsWith('backend/'))).toBe(true);
        expect(() => validateProjectFiles(p.files)).not.toThrow();
      }
  });
  it('rejects unsupported stacks and blank names', () => {
    expect(() =>
      createProjectTemplate({
        name: 'x',
        mode: 'frontend',
        frontendStack: 'arbitrary-image',
      }),
    ).toThrow();
    expect(() =>
      createProjectTemplate({
        name: ' ',
        mode: 'backend',
        backendStack: 'flask',
      }),
    ).toThrow();
  });
  it('does not reveal another user’s project or invoke a runtime without ownership', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new ProjectsService(
      repo as never,
      { get: jest.fn() } as never,
    );
    await expect(service.start('user-a', 'project-b')).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'project-b', ownerId: 'user-a' },
    });
    await expect(
      service.command('user-a', 'project-b', { command: 'ls' }),
    ).rejects.toThrow(NotFoundException);
  });
  it('rejects an out-of-date revision rather than overwriting another tab', async () => {
    const query = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'p' }),
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };
    const service = new ProjectsService(repo as never, {} as never);
    await expect(
      service.save('u', 'p', {
        revision: 1,
        files: [{ path: 'main.js', content: 'new' }],
      }),
    ).rejects.toThrow(ConflictException);
    expect(query.where).toHaveBeenCalledWith(
      expect.stringContaining('revision = :revision'),
      { id: 'p', ownerId: 'u', revision: 1 },
    );
  });
  it('requires an owned backend and relative path for API testing', async () => {
    const repo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'p', backendStack: 'express' }),
    };
    const service = new ProjectsService(repo as never, {} as never);
    for (const path of [
      'https://169.254.169.254/latest/meta-data/',
      '//internal',
      '/x\r\ny',
    ])
      await expect(
        service.request('u', 'p', { method: 'GET', path }),
      ).rejects.toThrow(BadRequestException);
  });
});
