jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => {},
  InjectDataSource: () => () => {},
}));
import { ConflictException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminProblemsController } from './controllers/problems.controller';

describe('Practice problem authoring', () => {
  const repository = () => ({
    create: jest.fn((data) => ({ id: 'new-record', ...data })),
    save: jest.fn((data) => Promise.resolve(data)),
    findOne: jest.fn().mockResolvedValue(null),
  });
  let problems: ReturnType<typeof repository>;
  let statements: ReturnType<typeof repository>;
  let configs: ReturnType<typeof repository>;
  let tests: ReturnType<typeof repository>;
  let questions: ReturnType<typeof repository>;
  let cache: { invalidatePrefix: jest.Mock };
  let service: AdminService;

  beforeEach(() => {
    problems = repository();
    statements = repository();
    configs = repository();
    tests = repository();
    questions = repository();
    cache = { invalidatePrefix: jest.fn().mockResolvedValue(undefined) };
    service = new AdminService(
      {} as never,
      problems as never,
      statements as never,
      configs as never,
      tests as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      questions as never,
      cache as never,
    );
  });

  it('saves an independent practice record with private judge content and author identity', async () => {
    const payload = {
      metadata: {
        title: 'Practice copy',
        slug: 'practice-copy',
        tags: ['math'],
      },
      publishing: { visibility: 'Draft' },
      languages: ['cpp', 'python3'],
      defaultLanguage: 'cpp',
      execution: { timeLimit: 1500, memoryLimit: 128 },
      statement: {
        description: 'Add two integers',
        constraints: 'a, b <= 100',
      },
      starterCode: { cpp: '// starter' },
      referenceSolution: { cpp: '// private reference' },
      sampleExamples: [{ input: '1 2', output: '3' }],
      testCases: {
        cases: [
          { input: '1 2', output: '3', isHidden: false, weight: 1 },
          { input: '50 75', output: '125', isHidden: true, weight: 3 },
        ],
      },
    };
    const result = await service.createProblem(payload, 'admin-id');
    expect(result.problem).toEqual(
      expect.objectContaining({
        title: 'Practice copy',
        visibility: 'Draft',
        author_id: 'admin-id',
      }),
    );
    expect(configs.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultLanguage: 'cpp',
        supportedLanguages: ['cpp', 'python3'],
        referenceSolution: { cpp: '// private reference' },
      }),
    );
    expect(tests.save).toHaveBeenCalledWith(
      expect.objectContaining({ cases: payload.testCases.cases }),
    );
    expect(statements.save).toHaveBeenCalledWith(
      expect.objectContaining({ samples: payload.sampleExamples }),
    );
    expect(questions.save).not.toHaveBeenCalled();
  });

  it('persists only a changed default language while retaining reference and execution settings', async () => {
    problems.findOne.mockResolvedValue({ id: 'practice-id', slug: 'original' });
    configs.findOne.mockResolvedValue({
      metadata_id: 'practice-id',
      defaultLanguage: 'cpp',
      referenceSolution: { cpp: 'private' },
      executionMode: 'function',
    });
    await service.updateProblem('practice-id', { defaultLanguage: 'python3' });
    expect(configs.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultLanguage: 'python3',
        referenceSolution: { cpp: 'private' },
        executionMode: 'function',
      }),
    );
    expect(questions.save).not.toHaveBeenCalled();
  });

  it('rejects a duplicate copy slug before writing any problem content', async () => {
    problems.findOne.mockResolvedValue({
      id: 'already-exists',
      slug: 'sum-practice',
    });
    await expect(
      service.createProblem({ metadata: { slug: 'sum-practice' } }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(problems.save).not.toHaveBeenCalled();
    expect(statements.save).not.toHaveBeenCalled();
    expect(tests.save).not.toHaveBeenCalled();
  });

  it('rejects an edit using another problem slug and invalidates both slugs when renaming', async () => {
    problems.findOne
      .mockResolvedValueOnce({ id: 'practice-id', slug: 'original' })
      .mockResolvedValueOnce({ id: 'other-id', slug: 'occupied' });
    await expect(
      service.updateProblem('practice-id', { metadata: { slug: 'occupied' } }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(problems.save).not.toHaveBeenCalled();
    problems.findOne
      .mockResolvedValueOnce({ id: 'practice-id', slug: 'original' })
      .mockResolvedValueOnce(null);
    await service.updateProblem('practice-id', {
      metadata: { slug: 'new-slug' },
    });
    expect(cache.invalidatePrefix).toHaveBeenCalledWith('problem:original');
    expect(cache.invalidatePrefix).toHaveBeenCalledWith('problem:new-slug');
  });

  it('uses the canonical authenticated admin ID and retains the legacy ID alias', async () => {
    const create = jest
      .spyOn(service, 'createProblem')
      .mockResolvedValue({ success: true } as never);
    const controller = new AdminProblemsController(service);
    await controller.createProblem({}, { user: { id: 'admin-id' } });
    expect(create).toHaveBeenLastCalledWith({}, 'admin-id');
    await controller.createProblem({}, { user: { _id: 'legacy-id' } });
    expect(create).toHaveBeenLastCalledWith({}, 'legacy-id');
  });
});
