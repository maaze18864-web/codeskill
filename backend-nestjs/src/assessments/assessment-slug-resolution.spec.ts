jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { AssessmentsService } from './assessments.service';

describe('Assessment Slug and UUID Resolution (AUD-029)', () => {
  const CANONICAL_UUID = '0cef9daa-2b02-4256-bf24-d53da05d82a7';
  const SLUG_CODE = 'exam-9227';
  const UPPER_CODE = 'EXAM-9227';

  const mockAssessment = {
    id: CANONICAL_UUID,
    code: UPPER_CODE,
    title: 'DSA-Test-2',
    status: 'published',
    durationMinutes: 60,
    questions: [],
    allowedAttempts: 1,
    targetBatches: [],
    targetDepartments: [],
  };

  function setup() {
    const qb = {
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockAssessment),
    };

    const assessmentRepo = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (Array.isArray(where)) {
          for (const clause of where) {
            if (clause.id === CANONICAL_UUID || clause.code === UPPER_CODE) {
              return Promise.resolve(mockAssessment);
            }
          }
        }
        return Promise.resolve(null);
      }),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const attemptRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((data) => ({ id: 'attempt-uuid-1', ...data })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'attempt-uuid-1', ...data })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const questionRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const service = new AssessmentsService(
      assessmentRepo as never,
      attemptRepo as never,
      questionRepo as never,
      {} as never,
    );

    return { service, assessmentRepo, attemptRepo, qb };
  }

  it('resolves assessment by canonical UUID without calling query builder', async () => {
    const { service, assessmentRepo, qb } = setup();
    const result = await service.findAssessmentByIdOrCode(CANONICAL_UUID);
    expect(result).toBeDefined();
    expect(result?.id).toBe(CANONICAL_UUID);
    expect(assessmentRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [{ id: CANONICAL_UUID }, { mongoId: CANONICAL_UUID }],
      }),
    );
    expect(qb.getOne).not.toHaveBeenCalled();
  });

  it('resolves assessment by alphanumeric slug/code case-insensitively', async () => {
    const { service, qb } = setup();
    const result = await service.findAssessmentByIdOrCode(SLUG_CODE);
    expect(result).toBeDefined();
    expect(result?.id).toBe(CANONICAL_UUID);
    expect(qb.where).toHaveBeenCalledWith(
      'LOWER(assessment.code) = LOWER(:code)',
      { code: SLUG_CODE },
    );
  });

  it('starts student attempt with slug exam-9227 using canonical UUID for attempt queries', async () => {
    const { service, attemptRepo } = setup();
    const studentUser = { id: 'student-uuid-1', role: 'student' };

    const attempt = await service.startStudentAttempt(SLUG_CODE, studentUser);
    expect(attempt).toBeDefined();
    expect(attempt.attemptId).toBe('attempt-uuid-1');

    // Verify all attemptRepo queries used the UUID, NEVER the alphanumeric string slug
    const findOneCalls = attemptRepo.findOne.mock.calls;
    for (const [args] of findOneCalls) {
      if (Array.isArray(args.where)) {
        for (const w of args.where) {
          if (w.assessmentId) {
            expect(w.assessmentId).toBe(CANONICAL_UUID);
            expect(w.assessmentId).not.toBe(SLUG_CODE);
          }
        }
      }
    }
  });

  it('retakes student attempt with slug exam-9227 using canonical UUID', async () => {
    const { service, attemptRepo } = setup();
    const studentUser = { id: 'student-uuid-1', role: 'student' };

    await service.retakeStudentAttempt(SLUG_CODE, studentUser);

    expect(attemptRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          assessmentId: CANONICAL_UUID,
          studentId: 'student-uuid-1',
          status: 'in_progress',
        },
      }),
    );
    expect(attemptRepo.delete).not.toHaveBeenCalled();
  });

  it('saves progress for slug exam-9227 looking up attempt by canonical UUID', async () => {
    const { service, attemptRepo } = setup();
    attemptRepo.findOne.mockResolvedValueOnce({
      id: 'attempt-uuid-1',
      assessmentId: CANONICAL_UUID,
      studentId: 'student-uuid-1',
      status: 'in_progress',
      responses: [],
    });

    const studentUser = { id: 'student-uuid-1', role: 'student' };
    const res = await service.saveProgress(SLUG_CODE, { responses: [] } as never, studentUser);
    expect(res.success).toBe(true);

    expect(attemptRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          assessmentId: CANONICAL_UUID,
          studentId: 'student-uuid-1',
          status: 'in_progress',
        },
      }),
    );
  });
});
