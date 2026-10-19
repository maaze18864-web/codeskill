jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => { },
}));

import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { QuestionsService } from './questions.service';

describe('QuestionsService - True/False Questions Handling', () => {
  let service: QuestionsService;
  let mockQuestionRepo: any;
  let mockQuestionBankRepo: any;
  let mockAuditLogRepo: any;

  const mockAdminUser = { id: 'admin-uuid-1', email: 'admin@codeskill.com' };

  beforeEach(() => {
    mockQuestionRepo = {
      create: jest.fn((dto) => ({ id: 'question-uuid-1', ...dto })),
      save: jest.fn(async (entity) => ({ id: 'question-uuid-1', ...entity })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(),
      query: jest.fn(),
    };

    mockQuestionBankRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockAuditLogRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn().mockResolvedValue(true),
    };

    service = new QuestionsService(
      mockQuestionRepo,
      mockQuestionBankRepo,
      mockAuditLogRepo,
      { invalidatePrefix: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  describe('create - True/False Questions', () => {
    it('should successfully create a True/False question with True as correct answer', async () => {
      const dto: any = {
        question: 'Is JavaScript single-threaded?',
        topic: 'JavaScript',
        difficulty: 'easy',
        questionType: 'TRUE_FALSE',
        options: [
          { text: 'True', isCorrect: true },
          { text: 'False', isCorrect: false },
        ],
        marks: 2,
      };

      const result = await service.create(dto, mockAdminUser);
      expect(result.options).toEqual(['True', 'False']);
      expect(result.correctAnswer).toBe(0);
      expect(result.correctAnswers).toEqual([0]);
    });

    it('should successfully create a True/False question with False as correct answer', async () => {
      const dto: any = {
        question: 'Is HTML a programming language?',
        topic: 'Web',
        difficulty: 'easy',
        questionType: 'TRUE_FALSE',
        options: [
          { text: 'True', isCorrect: false },
          { text: 'False', isCorrect: true },
        ],
        marks: 1,
      };

      const result = await service.create(dto, mockAdminUser);
      expect(result.options).toEqual(['True', 'False']);
      expect(result.correctAnswer).toBe(1);
      expect(result.correctAnswers).toEqual([1]);
    });

    it('should reject True/False question if more than 2 options are provided', async () => {
      const dto: any = {
        question: 'Invalid T/F question',
        topic: 'General',
        questionType: 'TRUE_FALSE',
        options: ['True', 'False', 'Maybe', 'Neither'],
      };

      await expect(service.create(dto, mockAdminUser)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(dto, mockAdminUser)).rejects.toThrow(
        'True/False questions must contain exactly two options: True and False',
      );
    });

    it('should reject True/False question if less than 2 options are provided', async () => {
      const dto: any = {
        question: 'Invalid T/F question',
        topic: 'General',
        questionType: 'TRUE_FALSE',
        options: ['True'],
      };

      await expect(service.create(dto, mockAdminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject True/False question if options do not contain True and False', async () => {
      const dto: any = {
        question: 'Invalid T/F options',
        topic: 'General',
        questionType: 'TRUE_FALSE',
        options: ['Yes', 'No'],
      };

      await expect(service.create(dto, mockAdminUser)).rejects.toThrow(
        'True/False questions must contain True and False options',
      );
    });

    it('should reject True/False question if duplicate options are provided', async () => {
      const dto: any = {
        question: 'Duplicate T/F options',
        topic: 'General',
        questionType: 'TRUE_FALSE',
        options: ['True', 'True'],
      };

      await expect(service.create(dto, mockAdminUser)).rejects.toThrow(
        'True/False questions cannot have duplicate options',
      );
    });

    it('should reject True/False question if multiple correct answers are flagged', async () => {
      const dto: any = {
        question: 'Both marked correct',
        topic: 'General',
        questionType: 'TRUE_FALSE',
        options: [
          { text: 'True', isCorrect: true },
          { text: 'False', isCorrect: true },
        ],
      };

      await expect(service.create(dto, mockAdminUser)).rejects.toThrow(
        'True/False questions cannot have more than one correct answer',
      );
    });

    it('should reject True/False question if correctAnswer index is out of bounds', async () => {
      const dto: any = {
        question: 'Invalid index',
        topic: 'General',
        questionType: 'TRUE_FALSE',
        options: ['True', 'False'],
        correctAnswer: 2,
      };

      await expect(service.create(dto, mockAdminUser)).rejects.toThrow(
        'correctAnswer for True/False must be 0 (True) or 1 (False)',
      );
    });
  });

  describe('update - True/False Questions', () => {
    it('should update True/False question and toggle correct answer to False', async () => {
      mockQuestionRepo.findOne.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        question: 'Original Question',
        questionType: 'TRUE_FALSE',
        options: ['True', 'False'],
        correctAnswer: 0,
        correctAnswers: [0],
        status: 'approved',
      });

      const updateDto: any = {
        question: 'Updated Question',
        options: [
          { text: 'True', isCorrect: false },
          { text: 'False', isCorrect: true },
        ],
        correctAnswer: 1,
      };

      const result = await service.update(
        '11111111-1111-1111-1111-111111111111',
        updateDto,
        mockAdminUser,
      );

      expect(result.options).toEqual(['True', 'False']);
      expect(result.correctAnswer).toBe(1);
      expect(result.correctAnswers).toEqual([1]);
    });

    it('should reject update if attempting to add 4 options to a True/False question', async () => {
      mockQuestionRepo.findOne.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        question: 'Original Question',
        questionType: 'TRUE_FALSE',
        options: ['True', 'False'],
        correctAnswer: 0,
        status: 'approved',
      });

      const updateDto: any = {
        options: ['True', 'False', 'Option 3', 'Option 4'],
      };

      await expect(
        service.update(
          '11111111-1111-1111-1111-111111111111',
          updateDto,
          mockAdminUser,
        ),
      ).rejects.toThrow(
        'True/False questions must contain exactly two options: True and False',
      );
    });
  });

  describe('findById - Existing Data Normalization', () => {
    it('should normalize legacy True/False question with 4 options to exactly True and False', async () => {
      mockQuestionRepo.findOne.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        question: 'Legacy Question with 4 options',
        questionType: 'TRUE_FALSE',
        options: ['True', 'False', 'Option C', 'Option D'],
        correctAnswer: 1, // False
        status: 'approved',
      });

      const result = await service.findById(
        '11111111-1111-1111-1111-111111111111',
        false,
      );

      expect(result.options).toEqual(['True', 'False']);
      expect(result.options).toHaveLength(2);
      expect(result.correctAnswer).toBe(1);
      expect(result.correctAnswers).toEqual([1]);
    });

    it('should preserve correct answer True (0) when normalizing legacy True/False question', async () => {
      mockQuestionRepo.findOne.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        question: 'Legacy Question',
        questionType: 'TRUE_FALSE',
        options: ['True', 'False', 'True', 'False'],
        correctAnswer: 0, // True
        status: 'approved',
      });

      const result = await service.findById(
        '11111111-1111-1111-1111-111111111111',
        false,
      );

      expect(result.options).toEqual(['True', 'False']);
      expect(result.correctAnswer).toBe(0);
    });
  });

  describe('Preserve Multiple Choice Questions', () => {
    it('returns the persisted MCQ slug alias and options from the detail lookup', async () => {
      mockQuestionRepo.findOne.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Java Inheritance',
        slug: 'java-inheritance',
        question: 'Which statement describes inheritance?',
        questionType: 'MCQ',
        options: ['A class inherits members', 'Inheritance prevents reuse'],
        correctAnswer: 0,
      });

      const result = await service.findById('11111111-1111-1111-1111-111111111111');
      expect(result).toEqual(expect.objectContaining({
        url_slug: 'java-inheritance',
        options: ['A class inherits members', 'Inheritance prevents reuse'],
        correctAnswer: 0,
      }));
    });

    it('imports MCQ slug and options through validation and persistence', async () => {
      const sheet = XLSX.utils.json_to_sheet([{
        title: 'Java Inheritance',
        url_slug: 'java-inheritance',
        question: 'Which statement correctly describes inheritance in Java?',
        question_type: 'single_choice',
        topic: 'Java',
        option_a: 'A class inherits members from another class',
        option_b: 'Inheritance prevents code reuse',
        option_c: 'Java classes inherit from multiple classes directly',
        option_d: 'Inheritance applies only to interfaces',
        correct_answer: 'A',
      }]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'MCQs');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      const preview = await service.parseAndValidateQuestionsImport(buffer);

      expect(preview.validRows).toHaveLength(1);
      expect(preview.validRows[0]).toEqual(expect.objectContaining({
        title: 'Java Inheritance',
        slug: 'java-inheritance',
        url_slug: 'java-inheritance',
        question: 'Which statement correctly describes inheritance in Java?',
        options: [
          expect.objectContaining({ text: 'A class inherits members from another class', isCorrect: true }),
          expect.objectContaining({ text: 'Inheritance prevents code reuse', isCorrect: false }),
          expect.objectContaining({ text: 'Java classes inherit from multiple classes directly', isCorrect: false }),
          expect.objectContaining({ text: 'Inheritance applies only to interfaces', isCorrect: false }),
        ],
      }));

      const saved: any[] = [];
      const manager = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((_entity, value) => value),
        save: jest.fn(async (value) => { saved.push(value); return value; }),
      };
      mockQuestionRepo.manager = { transaction: (callback) => callback(manager) };
      await service.confirmQuestionsImport(preview.validRows, mockAdminUser);
      expect(saved[0]).toEqual(expect.objectContaining({
        title: 'Java Inheritance',
        slug: 'java-inheritance',
        question: 'Which statement correctly describes inheritance in Java?',
        options: [
          'A class inherits members from another class',
          'Inheritance prevents code reuse',
          'Java classes inherit from multiple classes directly',
          'Inheritance applies only to interfaces',
        ],
        correctAnswer: 0,
      }));
    });

    it('generates a lowercase hyphenated MCQ slug when the CSV omits one', async () => {
      const collision = {
        id: 'existing-question',
        question: 'A different question',
        questionType: 'MCQ',
        topic: 'Java',
        slug: 'java-inheritance-basics',
        options: [],
      };
      mockQuestionRepo.find.mockResolvedValueOnce([collision]).mockResolvedValueOnce([collision]);
      const sheet = XLSX.utils.json_to_sheet([{
        title: 'Java Inheritance Basics',
        question: 'What is inheritance?',
        question_type: 'single_choice',
        topic: 'Java', option_a: 'A', option_b: 'B', correct_answer: 'A',
      }]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'MCQs');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      const preview = await service.parseAndValidateQuestionsImport(buffer);
      expect(preview.validRows[0].slug).toBe('java-inheritance-basics-2');
    });

    it('persists an MCQ title and slug separately from its student-facing question', async () => {
      const result = await service.create({
        title: 'BST Search Complexity',
        url_slug: 'bst-search-complexity',
        question: 'What is the worst-case search time in a balanced BST?',
        topic: 'Data Structures',
        questionType: 'MCQ',
        options: [
          { text: 'O(1)', isCorrect: false },
          { text: 'O(log n)', isCorrect: true },
        ],
      } as any, mockAdminUser);

      expect(result).toEqual(expect.objectContaining({
        title: 'BST Search Complexity',
        slug: 'bst-search-complexity',
        url_slug: 'bst-search-complexity',
        question: 'What is the worst-case search time in a balanced BST?',
      }));
    });

    it('updates an MCQ title and url_slug without replacing an omitted statement', async () => {
      mockQuestionRepo.findOne.mockResolvedValue({
        id: 'question-uuid-1',
        title: 'Java Inheritance',
        slug: 'java-inheritance',
        question: 'Which statement correctly describes inheritance in Java?',
        questionType: 'MCQ',
        topic: 'Java',
        options: ['A', 'B'],
        metadata: {},
      });

      await service.update('question-uuid-1', {
        title: 'Java Class Inheritance',
        url_slug: 'java-class-inheritance',
      } as any, mockAdminUser);

      expect(mockQuestionRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Java Class Inheritance',
        slug: 'java-class-inheritance',
        question: 'Which statement correctly describes inheritance in Java?',
        url_slug: 'java-class-inheritance',
      }));
    });

    it('should allow multiple choice question with 4 configurable options', async () => {
      const dto: any = {
        question: 'Which of the following are sorting algorithms?',
        topic: 'Algorithms',
        questionType: 'MULTIPLE_CHOICE',
        options: [
          { text: 'Merge Sort', isCorrect: true },
          { text: 'Quick Sort', isCorrect: true },
          { text: 'Binary Search', isCorrect: false },
          { text: 'DFS', isCorrect: false },
        ],
        marks: 4,
      };

      const result = await service.create(dto, mockAdminUser);
      expect(result.options).toEqual([
        'Merge Sort',
        'Quick Sort',
        'Binary Search',
        'DFS',
      ]);
      expect(result.correctAnswers).toEqual([0, 1]);
    });
  });
  describe('Topic categories and independent question types', () => {
    it('stores every topic in metadata, deduplicated, without a type tag', async () => {
      const question = await service.create({ question: 'Coding task', topic: 'Arrays', categories: ['Arrays', ' Trees ', 'Arrays'], questionType: 'DSA', marks: 1 }, mockAdminUser);
      expect(question.questionType).toBe('DSA');
      expect(question.topic).toBe('Arrays');
      expect(question.metadata.categories).toEqual(['Arrays', 'Trees']);
      expect(question).not.toHaveProperty('categories');
    });

    it('updates category metadata while preserving unrelated metadata', async () => {
      mockQuestionRepo.findOne.mockResolvedValue({ id: 'question-uuid-1', question: 'Task', questionType: 'DSA', topic: 'Arrays', options: [], metadata: { categories: ['Arrays'], imported: true } });
      await service.update('question-uuid-1', { categories: ['Trees', 'Graphs'], questionType: 'CODE_OUTPUT' }, mockAdminUser);
      expect(mockQuestionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ questionType: 'CODE_OUTPUT', topic: 'Trees', metadata: { categories: ['Trees', 'Graphs'], imported: true } }));
    });

    it('preserves existing coding title/slug update behavior', async () => {
      mockQuestionRepo.findOne.mockResolvedValue({
        id: 'question-uuid-1', question: 'Original coding prompt', questionType: 'DSA',
        title: 'Original coding title', slug: 'original-coding-slug', options: [],
      });
      await service.update('question-uuid-1', {
        title: 'Changed title', slug: 'changed-title', questionType: 'DSA',
      } as any, mockAdminUser);
      expect(mockQuestionRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        question: 'Changed title', title: 'Changed title', slug: 'changed-title',
      }));
    });

    it('keeps legacy topic-only creates compatible', async () => {
      const question = await service.create({ question: 'Task', topic: 'Strings', questionType: 'DSA' }, mockAdminUser);
      expect(question.topic).toBe('Strings');
      expect(question.metadata?.categories).toBeUndefined();
    });

    it.each([
      ['MCQ', ['MCQ', 'single_choice']],
      ['MULTIPLE_CHOICE', ['MULTIPLE_CHOICE', 'multiple_choice']],
      ['TRUE_FALSE', ['TRUE_FALSE', 'true_false']],
      ['CODE_OUTPUT', ['CODE_OUTPUT', 'code_output']],
      ['DSA', ['DSA', 'coding', 'algorithmic']],
    ])('filters %s across legacy and unified values', async (type, aliases) => {
      const qb = { leftJoinAndSelect: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getManyAndCount: jest.fn().mockResolvedValue([[], 0]) };
      mockQuestionRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll({ questionType: type as string });
      expect(qb.andWhere).toHaveBeenCalledWith('question.questionType IN (:...questionTypes)', { questionTypes: aliases });
    });
  });

  describe('Subject-specific topic options', () => {
    it('returns distinct approved subtopics matching the selected subject', async () => {
      mockQuestionRepo.query.mockResolvedValue([
        { topic: 'Algebra' },
        { topic: 'Geometry' },
      ]);

      await expect(service.getTopicsDistribution('Mathematics')).resolves.toEqual([
        'Algebra',
        'Geometry',
      ]);
      expect(mockQuestionRepo.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'approved'"),
        ['Mathematics'],
      );
      expect(mockQuestionRepo.query.mock.calls[0][0]).toContain(
        "(topic = $1 OR (metadata->'categories') ? $1)",
      );
    });
  });

  describe('bulkUpdate', () => {
    it('should bulk update marks, difficulty, and negativeMarks across multiple questions', async () => {
      const q1 = { id: 'q1', marks: 1, negativeMarks: 0, difficulty: 'easy', metadata: {} };
      const q2 = { id: 'q2', marks: 1, negativeMarks: 0, difficulty: 'easy', metadata: {} };
      mockQuestionRepo.findBy = jest.fn().mockResolvedValue([q1, q2]);
      mockQuestionRepo.save = jest.fn().mockResolvedValue([q1, q2]);

      const res = await service.bulkUpdate(
        ['q1', 'q2'],
        { marks: 5, negativeMarks: 1, difficulty: 'hard' },
        mockAdminUser,
      );

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(2);
      expect(q1.marks).toBe(5);
      expect(q1.negativeMarks).toBe(1);
      expect(q1.difficulty).toBe('hard');
      expect(mockQuestionRepo.save).toHaveBeenCalledWith([q1, q2]);
      expect(mockAuditLogRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if question IDs are empty', async () => {
      await expect(service.bulkUpdate([], {}, mockAdminUser)).rejects.toThrow(BadRequestException);
    });
  });
});
