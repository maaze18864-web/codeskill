import { Repository } from 'typeorm';
import { LabsService } from './labs.service';
import { User } from '../database/entities/user.entity';

describe('Labs workspace public configuration', () => {
  it('returns starter code and execution settings without reference solutions or checker code', async () => {
    const empty = {} as Repository<never>;
    const experiments = {
      findOne: jest.fn().mockResolvedValue({
        id: 'experiment',
        lab_id: 'lab',
        isPublished: true,
        lab: { title: 'DSA' },
        problems: [
          { id: 'link', problem_metadata_id: 'metadata', maxScore: 5 },
        ],
      }),
    };
    const problems = {
      findOne: jest.fn().mockResolvedValue({
        title: 'Add',
        statement: {
          description: '<p>Add</p>',
          samples: [{ input: '1 2', output: '3' }],
        },
        config: {
          supportedLanguages: ['cpp'],
          starterCode: { cpp: 'starter' },
          timeLimit: 2000,
          memoryLimit: 256,
          referenceSolution: { cpp: 'SECRET_SOLUTION' },
          customCheckerCode: { python: 'SECRET_CHECKER' },
        },
      }),
    };
    const progress = { find: jest.fn().mockResolvedValue([]) };
    const service = new LabsService(
      empty,
      empty,
      empty,
      empty,
      empty,
      empty,
      experiments as never,
      empty,
      progress as never,
      problems as never,
      empty,
      {} as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await service.getExperimentWorkspace(
      { id: 'admin', isAdmin: true } as User,
      'lab',
      'experiment',
    );
    expect(result.problems[0].config).toMatchObject({
      supportedLanguages: ['cpp'],
      starterCode: { cpp: 'starter' },
      timeLimit: 2000,
      memoryLimit: 256,
    });
    expect(result.problems[0].config).not.toHaveProperty('referenceSolution');
    expect(result.problems[0].config).not.toHaveProperty('customCheckerCode');
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(result.problems[0].statement.samples).toEqual([
      { input: '1 2', output: '3' },
    ]);
  });
});

describe('Labs list counts', () => {
  const empty = {} as never;
  it('returns actual active enrollment counts in the section list', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ sectionId: 'section-a', count: '12' }]),
    };
    const sections = {
      find: jest
        .fn()
        .mockResolvedValue([{ id: 'section-a' }, { id: 'section-b' }]),
    };
    const enrollments = {
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };
    const service = new LabsService(
      sections as never,
      empty,
      enrollments as never,
      empty,
      empty,
      empty,
      empty,
      empty,
      empty,
      empty,
      empty,
      {} as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    expect(await service.listSections()).toEqual([
      { id: 'section-a', enrollmentCount: 12 },
      { id: 'section-b', enrollmentCount: 0 },
    ]);
    expect(query.where).toHaveBeenCalledWith('enrollment.status = :status', {
      status: 'active',
    });
  });
  it('counts published problems separately from experiments and excludes stale solved links', async () => {
    const enrollments = {
      find: jest.fn().mockResolvedValue([{ lab_section_id: 'section' }]),
    };
    const assignments = {
      find: jest.fn().mockResolvedValue([
        {
          lab_id: 'lab',
          lab_section_id: 'section',
          lab: { id: 'lab', status: 'published' },
          section: { code: 'CS-A' },
        },
      ]),
    };
    const experiments = {
      find: jest
        .fn()
        .mockResolvedValue([
          { problems: [{ id: 'a' }, { id: 'b' }] },
          { problems: [{ id: 'c' }] },
        ]),
    };
    const progress = {
      find: jest.fn().mockResolvedValue([
        { lab_experiment_problem_id: 'a', status: 'solved' },
        { lab_experiment_problem_id: 'c', status: 'solved' },
        { lab_experiment_problem_id: 'removed-link', status: 'solved' },
      ]),
    };
    const service = new LabsService(
      empty,
      empty,
      enrollments as never,
      empty,
      assignments as never,
      empty,
      experiments as never,
      empty,
      progress as never,
      empty,
      empty,
      {} as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const [result] = await service.getMyLabs({ id: 'student' } as User);
    expect(result).toMatchObject({
      experimentCount: 2,
      totalProblems: 3,
      solvedCount: 2,
      completedExperiments: 1,
    });
  });
});

describe('Class roster matches dashboard scope', () => {
  it('excludes inactive or orphaned enrollments and stale unpublished problem progress', async () => {
    const empty = {} as never;
    const sections = {
      findOne: jest.fn().mockResolvedValue({ id: 'section', code: 'CS-A' }),
    };
    const enrollments = {
      find: jest.fn().mockResolvedValue([
        {
          student_id: 'active',
          student: { id: 'active', name: 'Active', isActive: true },
        },
        {
          student_id: 'inactive',
          student: { id: 'inactive', name: 'Inactive', isActive: false },
        },
        { student_id: 'missing', student: null },
      ]),
    };
    const labs = {
      findOne: jest.fn().mockResolvedValue({ id: 'lab', title: 'Lab' }),
    };
    const experiments = {
      find: jest.fn().mockResolvedValue([{ problems: [{ id: 'published' }] }]),
    };
    const progress = {
      find: jest.fn().mockResolvedValue([
        {
          student_id: 'active',
          lab_experiment_problem_id: 'published',
          status: 'solved',
          attemptsCount: 1,
          timeSpentSeconds: 60,
          score: 5,
        },
        {
          student_id: 'active',
          lab_experiment_problem_id: 'removed',
          status: 'solved',
          attemptsCount: 99,
          timeSpentSeconds: 999,
          score: 5,
        },
      ]),
    };
    const service = new LabsService(
      sections as never,
      empty,
      enrollments as never,
      labs as never,
      empty,
      empty,
      experiments as never,
      empty,
      progress as never,
      empty,
      empty,
      {} as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await service.getTeacherMetrics(
      { role: 'super_admin' } as User,
      'lab',
      'section',
    );
    expect(result).toMatchObject({
      enrolledCount: 1,
      totalProblems: 1,
      classCompletionPercent: 100,
    });
    expect(result.students[0]).toMatchObject({
      solvedCount: 1,
      attempts: 1,
      timeSpentSeconds: 60,
    });
  });
});
