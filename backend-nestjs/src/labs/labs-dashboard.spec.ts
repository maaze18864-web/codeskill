import { ForbiddenException } from '@nestjs/common';
import { User } from '../database/entities/user.entity';
import { LabsService } from './labs.service';
import {
  DashboardLearner,
  DashboardSnapshot,
  LABS_DASHBOARD_SQL,
  summarizeLabsDashboard,
} from './labs-dashboard';

const learner = (
  overrides: Partial<DashboardLearner> = {},
): DashboardLearner => ({
  id: 'one',
  name: 'Student',
  uid: null,
  sections: 'CS-A',
  assigned: 4,
  solved: 1,
  started: true,
  started_problems: 3,
  attempts: 5,
  last_activity: '2026-10-22T12:00:00.000Z',
  repeated_unsolved: 0,
  ...overrides,
});
const snapshot = (learners: DashboardLearner[]): DashboardSnapshot => ({
  generatedAt: '2026-10-23T12:00:00.000Z',
  learners,
  cohorts: [],
  experiments: [],
});

describe('Labs dashboard metrics', () => {
  it('includes untouched assigned work in completion, counts unique learners, and separates participation from completion', () => {
    const data = summarizeLabsDashboard(
      snapshot([
        learner(),
        learner({
          id: 'two',
          started: false,
          solved: 0,
          attempts: 0,
          last_activity: null,
        }),
      ]),
    );
    expect(data.summary).toMatchObject({
      students: 2,
      started: 1,
      notStarted: 1,
      assigned: 8,
      solved: 1,
      completionPercent: 13,
      participationPercent: 50,
    });
    expect(data.notStartedLearners.map((s) => s.id)).toEqual(['two']);
  });
  it('flags repeated unsolved work and 7-day inactivity, excluding completed and never-started students', () => {
    const data = summarizeLabsDashboard(
      snapshot([
        learner({ id: 'repeat', repeated_unsolved: 1 }),
        learner({ id: 'inactive', last_activity: '2026-10-16T12:00:00.000Z' }),
        learner({
          id: 'complete',
          solved: 4,
          repeated_unsolved: 0,
          last_activity: '2026-09-01T12:00:00.000Z',
        }),
        learner({
          id: 'never',
          started: false,
          solved: 0,
          last_activity: null,
        }),
      ]),
    );
    expect(data.summary).toMatchObject({
      needsReview: 2,
      completed: 1,
      active7d: 1,
    });
    expect(data.attention.map((s) => s.id)).toEqual(['repeat', 'inactive']);
    expect(data.recentActivity[0].id).toBe('repeat');
  });
  it('returns an honest empty snapshot without NaN percentages', () => {
    expect(summarizeLabsDashboard(snapshot([])).summary).toMatchObject({
      students: 0,
      completionPercent: 0,
      participationPercent: 0,
      needsReview: 0,
    });
  });
  it('normalizes effort by started problems and partitions every learner into one distribution bucket', () => {
    const data = summarizeLabsDashboard(
      snapshot([
        learner({ id: 'small', assigned: 2, started_problems: 2, attempts: 4 }),
        learner({
          id: 'large',
          assigned: 20,
          started_problems: 20,
          attempts: 40,
        }),
        learner({ id: 'reading', started_problems: 1, attempts: 0 }),
        learner({
          id: 'never',
          started: false,
          started_problems: 0,
          solved: 0,
          attempts: 0,
          last_activity: null,
        }),
      ]),
    );
    expect(
      data.distributions.attempts.find((b) => b.label === '2–<3')?.count,
    ).toBe(2);
    expect(
      data.distributions.attempts.find((b) => b.label === 'Under 1')?.count,
    ).toBe(1);
    for (const bands of Object.values(data.distributions))
      expect(bands.reduce((sum, b) => sum + b.count, 0)).toBe(4);
  });
});

describe('Teacher dashboard authorization', () => {
  const setup = () => {
    const repo = { query: jest.fn().mockResolvedValue([snapshot([])]) };
    const empty = {} as never;
    return {
      repo,
      service: new LabsService(
        repo as never,
        empty,
        empty,
        empty,
        empty,
        empty,
        empty,
        empty,
        empty,
        empty,
        empty,
        empty,
        empty,
        empty,
        empty,
        empty,
        empty,
      ),
    };
  };
  it('binds the authenticated teacher ID and section filter, including teachers with no assignments', async () => {
    const { repo, service } = setup();
    await service.getTeacherDashboard(
      { id: 'teacher-a', role: 'teacher' } as User,
      'section-a',
      'lab-a',
    );
    expect(repo.query).toHaveBeenCalledWith(LABS_DASHBOARD_SQL, [
      'teacher-a',
      'section-a',
      'lab-a',
    ]);
  });
  it('rejects a student before reading data', async () => {
    const { repo, service } = setup();
    await expect(
      service.getTeacherDashboard({ id: 'student', role: 'student' } as User),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.query).not.toHaveBeenCalled();
  });
  it('permits institution-wide scope only for an administrator', async () => {
    const { repo, service } = setup();
    await service.getTeacherDashboard({
      id: 'admin',
      role: 'super_admin',
    } as User);
    expect(repo.query).toHaveBeenCalledWith(LABS_DASHBOARD_SQL, [
      null,
      null,
      null,
    ]);
  });
});
