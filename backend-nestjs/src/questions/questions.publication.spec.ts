jest.mock('@nestjs/typeorm', () => ({ InjectRepository: () => () => {} }));

import { QuestionsService } from './questions.service';

const admin = { id: 'admin-1', email: 'admin@example.edu' };
const baseQuestion = {
  question: 'Two Sum',
  title: 'Two Sum',
  slug: 'two-sum',
  topic: 'Arrays',
  categories: ['Arrays', ' Trees ', 'Arrays'],
  questionType: 'DSA',
  marks: 1,
};

describe('Question publication persistence', () => {
  let service: QuestionsService;
  let stored: Record<string, unknown>;
  const repository = {
    create: jest.fn((value: Record<string, unknown>) => ({
      id: 'q1',
      ...value,
    })),
    save: jest.fn((value: Record<string, unknown>) => {
      stored = { ...value };
      return Promise.resolve(value);
    }),
    findOne: jest.fn((options?: any) => {
      if (options?.where?.id) {
        return Promise.resolve(stored);
      }
      return Promise.resolve(null);
    }),
  };
  const audit = {
    create: jest.fn((value: unknown) => value),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const cache = { invalidatePrefix: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
    stored = {
      id: 'q1',
      question: 'Two Sum',
      title: 'Two Sum',
      slug: 'two-sum',
      questionType: 'DSA',
      topic: 'Arrays',
      options: [],
      status: 'approved',
      metadata: {
        categories: ['Arrays', 'Graphs'],
        visibility: 'Published',
        contestOnly: false,
        importedVia: 'csv',
        customFlag: true,
      },
    };
    service = new QuestionsService(
      repository as never,
      {} as never,
      audit as never,
      cache as never,
    );
  });

  it('keeps an explicitly saved draft as draft and stores visibility separately from topic categories', async () => {
    const question = await service.create(
      {
        ...baseQuestion,
        status: 'draft',
        visibility: 'Draft',
        contestOnly: false,
      },
      admin,
    );
    expect(question).toEqual(
      expect.objectContaining({
        status: 'draft',
        title: 'Two Sum',
        slug: 'two-sum',
        topic: 'Arrays',
        metadata: {
          categories: ['Arrays', 'Trees'],
          visibility: 'Draft',
          contestOnly: false,
        },
      }),
    );
    expect(question).not.toHaveProperty('visibility');
    expect(question).not.toHaveProperty('contestOnly');
    expect(question).not.toHaveProperty('categories');
    expect(question.approved_by_id).toBeUndefined();
    expect(question.approvedAt).toBeUndefined();
    expect(cache.invalidatePrefix).toHaveBeenCalledWith('problems:');
  });

  it('persists explicitly published coding visibility, title, slug and selected status', async () => {
    const question = await service.create(
      { ...baseQuestion, status: 'active', visibility: 'Published' },
      admin,
    );
    expect(question.status).toBe('active');
    expect(question.metadata).toEqual({
      categories: ['Arrays', 'Trees'],
      visibility: 'Published',
    });
    expect(question.title).toBe('Two Sum');
    expect(question.slug).toBe('two-sum');
    expect(question.approved_by_id).toBe(admin.id);
  });

  it('retains approved for APIs omitting status without inventing public visibility', async () => {
    const question = await service.create({ ...baseQuestion }, admin);
    expect(question.status).toBe('approved');
    expect(question.metadata).toEqual({ categories: ['Arrays', 'Trees'] });
    expect(question.metadata.visibility).toBeUndefined();
    expect(question.metadata.contestOnly).toBeUndefined();
  });

  it.each(['active', 'published'])(
    'does not infer public visibility from an explicit %s status',
    async (status) => {
      const question = await service.create({ ...baseQuestion, status }, admin);
      expect(question.status).toBe(status);
      expect(question.metadata.visibility).toBeUndefined();
    },
  );

  it('preserves contest-only selection as metadata rather than a topic or top-level field', async () => {
    const question = await service.create(
      { ...baseQuestion, visibility: 'Public', contestOnly: true },
      admin,
    );
    expect(question.metadata).toEqual({
      categories: ['Arrays', 'Trees'],
      visibility: 'Public',
      contestOnly: true,
    });
    expect(question).not.toHaveProperty('contestOnly');
  });

  it.each(['MCQ', 'DSA'])(
    'persists published Contest Only eligibility for %s questions',
    async (questionType) => {
      const question = await service.create(
        {
          ...baseQuestion,
          questionType,
          ...(questionType === 'MCQ'
            ? { options: ['First option', 'Second option'], correctAnswer: 0 }
            : {}),
          status: 'active',
          visibility: 'Published',
          contestOnly: true,
        },
        admin,
      );
      expect(question.metadata).toEqual({
        categories: ['Arrays', 'Trees'],
        visibility: 'Published',
        contestOnly: true,
      });
    },
  );

  it('unpublishes an existing question without losing categories or unrelated metadata', async () => {
    await service.update(
      'q1',
      { visibility: 'Private', status: 'draft' },
      admin,
    );
    expect(stored).toEqual(
      expect.objectContaining({
        status: 'draft',
        topic: 'Arrays',
        metadata: {
          categories: ['Arrays', 'Graphs'],
          visibility: 'Private',
          contestOnly: false,
          importedVia: 'csv',
          customFlag: true,
        },
      }),
    );
    expect(stored).not.toHaveProperty('visibility');
    expect(cache.invalidatePrefix).toHaveBeenCalledWith('problems:');
  });

  it('updates categories, title, slug and visibility together while retaining metadata flags', async () => {
    await service.update(
      'q1',
      {
        title: 'Updated title',
        slug: 'updated-title',
        categories: ['Strings', 'Trees'],
        visibility: 'Draft',
      },
      admin,
    );
    expect(stored).toEqual(
      expect.objectContaining({
        title: 'Updated title',
        question: 'Updated title',
        slug: 'updated-title',
        topic: 'Strings',
        metadata: {
          categories: ['Strings', 'Trees'],
          visibility: 'Draft',
          contestOnly: false,
          importedVia: 'csv',
          customFlag: true,
        },
      }),
    );
  });

  it('keeps existing publication metadata intact when unrelated fields are edited', async () => {
    const metadata = stored.metadata;
    await service.update('q1', { difficulty: 'hard' }, admin);
    expect(stored.metadata).toEqual(metadata);
    expect(stored.difficulty).toBe('hard');
  });

  it('persists contestOnly false so an administrator can leave contest-only mode', async () => {
    stored.metadata = {
      categories: ['Arrays'],
      visibility: 'Published',
      contestOnly: true,
      customFlag: true,
    };
    await service.update('q1', { contestOnly: false }, admin);
    expect(stored.metadata).toEqual({
      categories: ['Arrays'],
      visibility: 'Published',
      contestOnly: false,
      customFlag: true,
    });
    expect(stored).not.toHaveProperty('contestOnly');
  });

  it('invalidates the public catalog when a question is archived', async () => {
    await service.delete('q1', admin);
    expect(stored.status).toBe('archived');
    expect(cache.invalidatePrefix).toHaveBeenCalledWith('problems:');
  });

  it.each(['approved', 'rejected'] as const)(
    'invalidates review changes without treating %s as a publishing action',
    async (status) => {
      stored.metadata = { categories: ['Arrays'], customFlag: true };
      await service.review('q1', status, 'Reason', admin);
      expect(stored.status).toBe(status);
      expect(stored.metadata).toEqual({
        categories: ['Arrays'],
        customFlag: true,
      });
      expect(cache.invalidatePrefix).toHaveBeenCalledWith('problems:');
    },
  );
});
