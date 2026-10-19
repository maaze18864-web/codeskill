import { BugReport } from '../database/entities/bug-report.entity';
import { BugsService } from './bugs.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('BugsService', () => {
  it('returns status totals and image/comment counts for the current search result', async () => {
    const bugs = [
      { id: 'a', status: 'new', createdAt: new Date(), priority: 'high' },
      { id: 'b', status: 'fixed', createdAt: new Date(), priority: 'low' },
    ] as BugReport[];
    const query = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(bugs),
    };
    const manager = { query: jest.fn().mockResolvedValueOnce([{ bugId: 'a', count: 2 }]).mockResolvedValueOnce([{ bugId: 'b', count: 3 }]) };
    const repository = { createQueryBuilder: jest.fn().mockReturnValue(query), manager };
    const service = new BugsService(repository as any, {} as any, {} as any);

    const result = await service.list('parentheses', 'priority');

    expect(query.where).toHaveBeenCalledWith(expect.stringContaining('bug.title'), { search: '%parentheses%' });
    expect(result.counts).toEqual({ total: 2, new: 1, in_process: 0, fixed: 1 });
    expect(result.items.map((item) => item.commentCount)).toEqual([2, 0]);
    expect(result.items.map((item) => item.imageCount)).toEqual([0, 3]);
  });

  it('claims a new bug atomically and records assignment activity', async () => {
    const bug: any = {
      id: 'bug-1', status: 'new', assigneeName: null, assigneeUserId: null,
      creatorName: 'Reporter', title: 'Crash', description: 'The page crashes.', priority: 'high',
      fixedAt: null, createdAt: new Date(), updatedAt: new Date(), images: [], comments: [], activities: [],
    };
    const saveBug = jest.fn(async (value) => value);
    const saveActivity = jest.fn();
    const transactionalBugRepository = {
      findOne: jest.fn(async () => bug),
      save: saveBug,
    };
    const manager = {
      getRepository: jest.fn((entity) => entity === BugReport ? transactionalBugRepository : { save: saveActivity }),
    };
    const repository: any = {
      manager: { transaction: jest.fn(async (callback) => callback(manager)) },
      findOne: jest.fn(async () => bug),
    };
    const service = new BugsService(repository, {} as any, {} as any);

    await service.assign('bug-1', 'Asha', { id: 'user-1', name: 'Asha' });

    expect(transactionalBugRepository.findOne).toHaveBeenCalledWith({ where: { id: 'bug-1' }, lock: { mode: 'pessimistic_write' } });
    expect(bug.status).toBe('in_process');
    expect(bug.assigneeName).toBe('Asha');
    expect(bug.assigneeUserId).toBe('user-1');
    expect(saveBug).toHaveBeenCalledWith(bug);
    expect(saveActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'assigned', actorName: 'Asha' }));
  });

  it('records the fixed timestamp and activity when the assignee marks a bug fixed', async () => {
    const bug: any = {
      id: 'bug-2', status: 'in_process', assigneeName: 'Dev', assigneeUserId: 'user-2',
      creatorName: 'Reporter', title: 'Crash', description: 'The page crashes.', priority: 'medium',
      fixedAt: null, createdAt: new Date(), updatedAt: new Date(), images: [], comments: [], activities: [],
    };
    const saveBug = jest.fn(async (value) => value);
    const saveActivity = jest.fn();
    const transactionalBugRepository = { findOne: jest.fn(async () => bug), save: saveBug };
    const manager = {
      getRepository: jest.fn((entity) => entity === BugReport ? transactionalBugRepository : { save: saveActivity }),
    };
    const repository: any = {
      manager: { transaction: jest.fn(async (callback) => callback(manager)) },
      findOne: jest.fn(async () => bug),
    };
    const service = new BugsService(repository, {} as any, {} as any);

    await service.updateStatus('bug-2', 'fixed', { id: 'user-2', name: 'Dev' });

    expect(bug.status).toBe('fixed');
    expect(bug.fixedAt).toBeInstanceOf(Date);
    expect(saveActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'fixed', actorName: 'Dev' }));
  });
});
