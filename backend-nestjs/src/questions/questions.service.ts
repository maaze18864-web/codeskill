import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, In, IsNull } from 'typeorm';
import { Question as QuestionEntity } from '../database/entities/question.entity';
import { QuestionBank as QuestionBankEntity } from '../database/entities/question-bank.entity';
import { AuditLog as AuditLogEntity } from '../database/entities/audit-log.entity';
import { QuestionBulkUploadBatch } from '../database/entities/question-bulk-upload-batch.entity';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QueryQuestionsDto } from './dto/query-questions.dto';
import { CreateQuestionBankDto } from './dto/create-question-bank.dto';
import { CacheService } from '../redis/cache.service';
import * as XLSX from 'xlsx';
import * as crypto from 'crypto';
import type { SubmissionStore } from '../database/sharding/submission-store';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questionRepository: Repository<QuestionEntity>,
    @InjectRepository(QuestionBankEntity)
    private readonly questionBankRepository: Repository<QuestionBankEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
    private readonly cacheService: CacheService,
    @Optional() private readonly submissionStore?: SubmissionStore,
  ) {}

  private normalizeCategories(categories: string[]): string[] {
    return [
      ...new Set(categories.map((category) => category.trim()).filter(Boolean)),
    ];
  }

  async findAll(query: QueryQuestionsDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.questionRepository.createQueryBuilder('question')
      .leftJoinAndSelect('question.createdBy', 'createdBy')
      .leftJoinAndSelect('question.approvedBy', 'approvedBy');

    if (query.batchId) {
      qb.andWhere('question.bulk_upload_batch_id = :batchId', { batchId: query.batchId });
    }

    if (query.status && query.status !== 'all') {
      const normalizedStatus = query.status.trim().toLowerCase();
      const statusMap: Record<string, string[]> = {
        active: ['approved', 'active'],
        approved: ['approved', 'active'],
        pending_review: ['pending', 'pending_review'],
        pending: ['pending', 'pending_review'],
        draft: ['draft'],
        rejected: ['rejected'],
      };
      const allowedStatuses = statusMap[normalizedStatus] || [query.status];
      if (['active', 'approved'].includes(normalizedStatus)) {
        qb.andWhere('(question.status IN (:...statuses) OR question.status IS NULL)', {
          statuses: allowedStatuses,
        });
      } else {
        qb.andWhere('question.status IN (:...statuses)', { statuses: allowedStatuses });
      }
    } else {
      qb.andWhere('(question.status IS NULL OR question.status != :archived)', {
        archived: 'archived',
      });
    }

    if (query.topic && query.topic.trim()) {
      const topicVal = query.topic.trim();
      qb.andWhere(
        new Brackets((qbTopic) => {
          qbTopic.where('LOWER(TRIM(question.topic)) = LOWER(:topicVal)', { topicVal })
                 .orWhere('question.topic ILIKE :topicLike', { topicLike: `%${topicVal}%` })
                 .orWhere("(question.metadata->'categories') ? :topicVal", { topicVal })
                 .orWhere(
                   "EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(CASE WHEN jsonb_typeof(question.metadata->'categories') = 'array' THEN question.metadata->'categories' ELSE '[]'::jsonb END, '[]'::jsonb)) AS cat WHERE cat ILIKE :topicLike)",
                   { topicLike: `%${topicVal}%` },
                 );
        }),
      );
    }

    const questionType = query.questionType;
    if (questionType && questionType !== 'all') {
      const groups = [
        ['MCQ', 'single_choice'],
        ['MULTIPLE_CHOICE', 'multiple_choice'],
        ['TRUE_FALSE', 'true_false'],
        ['CODE_OUTPUT', 'code_output'],
        ['DSA', 'coding', 'algorithmic'],
      ];
      const types = groups.find((group) => group.includes(questionType)) || [
        questionType,
      ];
      qb.andWhere('question.questionType IN (:...questionTypes)', {
        questionTypes: types,
      });
    }

    if (query.subtopic && query.subtopic.trim()) {
      qb.andWhere('question.subtopic = :subtopic', { subtopic: query.subtopic.trim() });
    }

    if (query.difficulty && query.difficulty !== 'all') {
      qb.andWhere('question.difficulty = :difficulty', { difficulty: query.difficulty });
    }

    if (query.aiGenerated !== undefined && query.aiGenerated !== '') {
      qb.andWhere('question.aiGenerated = :aiGenerated', { aiGenerated: query.aiGenerated === 'true' });
    }

    if (query.search && query.search.trim()) {
      const search = `%${query.search.trim()}%`;
      qb.andWhere(new Brackets(qbInner => {
        qbInner.where('question.question ILIKE :search', { search })
               .orWhere('question.topic ILIKE :search', { search })
               .orWhere('question.subtopic ILIKE :search', { search })
               .orWhere(`EXISTS (SELECT 1 FROM unnest(question.tags) AS t WHERE t ILIKE :search)`);
      }));
    }

    const [questions, total] = await qb
      .orderBy('question.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    questions.forEach((q) => {
      if (['MCQ', 'single_choice', 'MULTIPLE_CHOICE', 'multiple_choice', 'TRUE_FALSE', 'true_false'].includes(q.questionType)) {
        (q as any).url_slug = q.slug;
      }
      if (q.questionType === 'TRUE_FALSE') {
        let isFalse = q.correctAnswer === 1;
        if (Array.isArray(q.options) && q.correctAnswer !== undefined) {
          const chosen = String(q.options[q.correctAnswer] || '').trim().toLowerCase();
          if (chosen === 'false') {
            isFalse = true;
          } else if (chosen === 'true') {
            isFalse = false;
          }
        }
        q.options = ['True', 'False'];
        q.correctAnswer = isFalse ? 1 : 0;
        q.correctAnswers = [q.correctAnswer];
      }
    });

    const pendingCount = await this.questionRepository.count({
      where: [{ status: 'pending' }, { status: 'pending_review' }],
    });
    const approvedCount = await this.questionRepository.count({
      where: [{ status: 'approved' }, { status: 'active' }, { status: IsNull() }],
    });

    return {
      questions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        total,
        pending: pendingCount,
        approved: approvedCount,
      },
    };
  }

  async getBulkUploadBatches(page = 1, limit = 20) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const [batches, total] = await this.questionRepository.manager
      .getRepository(QuestionBulkUploadBatch)
      .findAndCount({
        relations: { uploadedBy: true },
        order: { createdAt: 'DESC' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      });
    return {
      batches: batches.map(({ uploadedBy, ...batch }) => ({
        ...batch,
        totalRows: batch.totalQuestions,
        successCount: batch.successfulQuestions,
        failureCount: batch.failedQuestions,
        uploader: uploadedBy ? { id: uploadedBy.id, name: uploadedBy.name, email: uploadedBy.email } : null,
      })),
      pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) || 1 },
    };
  }

  async deleteBulkUploadBatch(id: string, mode: 'history' | 'with-questions') {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('Invalid bulk upload batch ID');
    }
    if (!['history', 'with-questions'].includes(mode)) {
      throw new BadRequestException('Deletion mode must be history or with-questions');
    }

    return this.questionRepository.manager.transaction(async (manager) => {
      const batchRepository = manager.getRepository(QuestionBulkUploadBatch);
      const batch = await batchRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!batch) throw new NotFoundException('Bulk upload batch not found');

      if (mode === 'history') {
        await batchRepository.delete(id);
        return { success: true, mode, batchId: id, deletedQuestions: 0 };
      }

      const questions = await manager
        .getRepository(QuestionEntity)
        .createQueryBuilder('question')
        .select(['question.id', 'question.mongoId'])
        .where('question.bulk_upload_batch_id = :id', { id })
        .setLock('pessimistic_write')
        .getMany();
      const questionIds = questions.map((question) => question.id);
      const referencedIds = [...new Set(questions.flatMap((question) => [question.id, question.mongoId].filter(Boolean) as string[]))];

      if (questionIds.length) {
        const uuidIds = questionIds;
        if (this.submissionStore?.isSharded) {
          const shardedSubmissions = await this.submissionStore.count({
            where: { problemSource: 'question', problemId: In(uuidIds) },
          });
          if (shardedSubmissions > 0) {
            throw new ConflictException('Questions in this batch have submissions. Delete is blocked to preserve submission history.');
          }
        }
        const dependencyRows = await manager.query(
          `SELECT 'assessments' AS dependency, count(*)::int AS count
             FROM assessments a
            WHERE a.questions && $1::text[]
               OR EXISTS (
                    SELECT 1
                      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.sections) = 'array' THEN a.sections ELSE '[]'::jsonb END) section
                      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(section->'questions') = 'array' THEN section->'questions' ELSE '[]'::jsonb END) item
                     WHERE item->>'questionId' = ANY($1::text[])
                  )
           UNION ALL
           SELECT 'assessment attempts' AS dependency, count(*)::int AS count
             FROM assessment_attempts a
            WHERE a."questionOrder" && $1::text[]
               OR EXISTS (
                    SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.responses) = 'array' THEN a.responses ELSE '[]'::jsonb END) item
                     WHERE item->>'questionId' = ANY($1::text[])
                  )
           UNION ALL
           SELECT 'question banks' AS dependency, count(*)::int AS count FROM question_banks b WHERE b.questions && $2::uuid[]
           UNION ALL
           SELECT 'contests' AS dependency, count(*)::int AS count FROM contests c WHERE c.problems && $1::text[]
           UNION ALL
           SELECT 'student records' AS dependency, count(*)::int AS count FROM users u WHERE u."solvedProblems" && $1::text[] OR u."bookmarkedProblems" && $1::text[]
           UNION ALL
           SELECT 'discussions' AS dependency, count(*)::int AS count FROM discussions d WHERE d."problemId" = ANY($1::text[])
           UNION ALL
           SELECT 'submissions' AS dependency, count(*)::int AS count FROM submissions s WHERE s."problemSource" = 'question' AND s."problemId" = ANY($2::uuid[])`,
          [referencedIds, uuidIds],
        );

        const dependencies = dependencyRows
          .filter((row: { count: number | string }) => Number(row.count) > 0)
          .map((row: { dependency: string }) => row.dependency);
        if (dependencies.length) {
          throw new ConflictException(`Cannot delete this batch because its questions are referenced by ${dependencies.join(', ')}.`);
        }
      }

      if (questionIds.length) await manager.delete(QuestionEntity, { bulk_upload_batch_id: id });
      await batchRepository.delete(id);
      return { success: true, mode, batchId: id, deletedQuestions: questionIds.length };
    });
  }

  private async createImportBatch(fileName: string, questionType: 'MCQ' | 'CODING', totalRows: number, adminUser: any) {
    const batchRepository = this.questionRepository.manager.getRepository(QuestionBulkUploadBatch);
    for (let attempt = 0; attempt < 4; attempt++) {
      const batchCode = `#${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      try {
        return await batchRepository.save(batchRepository.create({
          batchCode,
          questionType,
          batchName: batchCode,
          originalFilename: fileName.slice(0, 500),
          uploaded_by_id: adminUser?.id || adminUser?._id || undefined,
          totalQuestions: totalRows,
          successfulQuestions: 0,
          failedQuestions: totalRows,
          failureDetails: [],
          metadata: {},
          status: 'PROCESSING',
        }));
      } catch (error: any) {
        if (error?.code === '23505' && attempt < 3) continue;
        console.error('Failed to create question bulk-upload batch', error);
        throw error;
      }
    }
    throw new Error('Unable to generate a unique bulk-upload batch code');
  }

  async findById(id: string, isStudent = false) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) {
      throw new BadRequestException('Invalid question ID');
    }

    const question = await this.questionRepository.findOne({ where: { id } });
    if (!question || question.status === 'archived') {
      throw new NotFoundException('Question not found');
    }

    if (question.questionType === 'TRUE_FALSE') {
      let isFalse = question.correctAnswer === 1;
      if (Array.isArray(question.options) && question.correctAnswer !== undefined) {
        const chosen = String(question.options[question.correctAnswer] || '').trim().toLowerCase();
        if (chosen === 'false') {
          isFalse = true;
        } else if (chosen === 'true') {
          isFalse = false;
        }
      }
      question.options = ['True', 'False'];
      question.correctAnswer = isFalse ? 1 : 0;
      question.correctAnswers = [question.correctAnswer];
    }

    if (['MCQ', 'single_choice', 'MULTIPLE_CHOICE', 'multiple_choice', 'TRUE_FALSE', 'true_false'].includes(question.questionType)) {
      (question as any).url_slug = question.slug;
    }

    // Question Leakage Prevention: NEVER send answers or hidden data to students
    if (isStudent) {
      const {
        correctAnswer,
        correctAnswers,
        explanation,
        expectedOutput,
        referenceSolutions,
        metadata,
        ...studentSafeQuestion
      } = question as any;

      if (studentSafeQuestion.testCases) {
        studentSafeQuestion.testCases = studentSafeQuestion.testCases.filter(
          (tc: any) => !tc.isHidden,
        );
      }

      return studentSafeQuestion;
    }

    return question;
  }

  async create(
    dto: CreateQuestionDto,
    adminUser: any,
    ip = '',
    userAgent = '',
  ) {
    const {
      options: rawOptions,
      categories,
      visibility,
      contestOnly,
      url_slug,
      slug: explicitSlug,
      ...rest
    } = dto;
    const type = String(dto.questionType || 'single_choice');
    const isChoice = [
      'single_choice',
      'multiple_choice',
      'MCQ',
      'MULTIPLE_CHOICE',
      'TRUE_FALSE',
    ].includes(type);

    let options: string[] = [];
    let correctAnswers: number[] = dto.correctAnswers || [];
    let correctAnswer = dto.correctAnswer ?? 0;

    if (type === 'TRUE_FALSE') {
      const source =
        Array.isArray(rawOptions) && rawOptions.length > 0
          ? rawOptions
          : ['True', 'False'];

      if (source.length !== 2) {
        throw new BadRequestException(
          'True/False questions must contain exactly two options: True and False',
        );
      }

      const optTexts = source.map((o: any) =>
        (typeof o === 'string' ? o : o?.text || '').trim(),
      );
      const lowerTexts = optTexts.map((t) => t.toLowerCase());

      if (lowerTexts[0] === lowerTexts[1]) {
        throw new BadRequestException(
          'True/False questions cannot have duplicate options',
        );
      }

      if (
        !lowerTexts.includes('true') ||
        !lowerTexts.includes('false')
      ) {
        throw new BadRequestException(
          'True/False questions must contain True and False options',
        );
      }

      options = ['True', 'False'];

      let selectedAnswer: number | null = null;
      const flagged = source
        .map((o: any, i: number) => {
          if (typeof o === 'object' && o?.isCorrect) {
            return lowerTexts[i] === 'false' ? 1 : 0;
          }
          return -1;
        })
        .filter((i: number) => i >= 0);

      if (flagged.length > 1) {
        throw new BadRequestException(
          'True/False questions cannot have more than one correct answer',
        );
      } else if (flagged.length === 1) {
        selectedAnswer = flagged[0];
      }

      if (dto.correctAnswer !== undefined) {
        if (dto.correctAnswer !== 0 && dto.correctAnswer !== 1) {
          throw new BadRequestException(
            'correctAnswer for True/False must be 0 (True) or 1 (False)',
          );
        }
        selectedAnswer = dto.correctAnswer;
      }

      if (dto.correctAnswers !== undefined && dto.correctAnswers.length > 0) {
        if (dto.correctAnswers.length > 1) {
          throw new BadRequestException(
            'True/False questions cannot have more than one correct answer',
          );
        }
        if (dto.correctAnswers[0] !== 0 && dto.correctAnswers[0] !== 1) {
          throw new BadRequestException(
            'correctAnswers for True/False must contain 0 (True) or 1 (False)',
          );
        }
        selectedAnswer = dto.correctAnswers[0];
      }

      if (selectedAnswer === null) {
        selectedAnswer = 0;
      }

      correctAnswer = selectedAnswer;
      correctAnswers = [selectedAnswer];
    } else if (isChoice) {
      const source = Array.isArray(rawOptions) ? rawOptions : [];
      options = source.map((o: any) => (typeof o === 'string' ? o : o?.text || ''));
      const flagged = source
        .map((o: any, i: number) => (typeof o === 'object' && o?.isCorrect ? i : -1))
        .filter((i: number) => i >= 0);
      if (flagged.length > 0) {
        correctAnswers = flagged;
        correctAnswer = flagged[0];
      }
      if (options.length < 2 || options.some((o) => !o.trim())) {
        throw new BadRequestException(
          'Choice questions need at least 2 non-empty options',
        );
      }
      if (correctAnswer < 0 || correctAnswer >= options.length) {
        throw new BadRequestException(
          `correctAnswer must be a valid zero-based index between 0 and ${options.length - 1}`,
        );
      }
    }

    if (!(dto.question || (!isChoice && dto.title))) {
      throw new BadRequestException('Question text is required');
    }
    if (dto.marks !== undefined && dto.marks <= 0) {
      throw new BadRequestException('Marks must be greater than 0');
    }

    const status = dto.status ?? 'approved';
    const metadata = {
      ...(categories !== undefined
        ? { categories: this.normalizeCategories(categories) }
        : {}),
      ...(visibility !== undefined ? { visibility } : {}),
      ...(contestOnly !== undefined ? { contestOnly } : {}),
    };
    const isApproved = ['approved', 'active', 'published'].includes(status);
    // Resolve clean slug and guarantee uniqueness
    const rawSlugCandidate = (explicitSlug || url_slug || '').trim();
    let baseSlug = '';
    if (rawSlugCandidate) {
      baseSlug = rawSlugCandidate
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    } else if (dto.title?.trim() || dto.question?.trim()) {
      const source = (dto.title || dto.question || '').trim();
      baseSlug = source
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
        .slice(0, 100);
    }

    let finalSlug: string | null = null;
    if (baseSlug) {
      let candidate = baseSlug;
      let counter = 1;
      while (true) {
        const existing = await this.questionRepository.findOne({
          where: { slug: candidate },
        });
        if (!existing) {
          finalSlug = candidate;
          break;
        }
        counter++;
        candidate = `${baseSlug}-${counter}`;
        if (counter > 100) {
          finalSlug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
          break;
        }
      }
    }

    const newQuestion = this.questionRepository.create({
      ...rest,
      slug: finalSlug,
      ...(categories !== undefined
        ? {
            topic: this.normalizeCategories(categories)[0] || 'General',
          }
        : {}),
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      question: dto.question || (!isChoice ? dto.title : undefined),
      options,
      correctAnswer,
      correctAnswers,
      created_by_id: adminUser.id || adminUser._id,
      status,
      ...(isApproved
        ? {
            approved_by_id: adminUser.id || adminUser._id,
            approvedAt: new Date(),
          }
        : {}),
    } as any) as unknown as QuestionEntity;

    let question: QuestionEntity;
    try {
      question = await this.questionRepository.save(newQuestion);
    } catch (err: any) {
      if (
        err?.code === '23505' ||
        String(err?.message || '').includes('UQ_a9cd7cd3b1c78e50d8383aa0d79') ||
        String(err?.message || '').includes('unique constraint')
      ) {
        newQuestion.slug = `${baseSlug || 'question'}-${crypto.randomBytes(3).toString('hex')}`;
        question = await this.questionRepository.save(newQuestion);
      } else {
        throw err;
      }
    }
    if (isChoice) (question as any).url_slug = question.slug;
    await this.cacheService.invalidatePrefix('problems:');

    const auditLog = this.auditLogRepository.create({
      actorId: adminUser.id || adminUser._id,
      actorEmail: adminUser.email,
      action: 'CREATE_QUESTION',
      target: question.id,
      targetType: 'Question',
      ipAddress: ip,
      userAgent: userAgent,
      metadata: {
        topic: question.topic,
        difficulty: question.difficulty,
      },
    });
    await this.auditLogRepository.save(auditLog);

    return question;
  }

  async update(
    id: string,
    dto: UpdateQuestionDto,
    adminUser: any,
    ip = '',
    userAgent = '',
  ) {
    const question = await this.questionRepository.findOne({ where: { id } });
    if (!question || question.status === 'archived') {
      throw new NotFoundException('Question not found');
    }

    const type = String(dto.questionType || question.questionType || 'single_choice');
    const isMcqTitleType = ['single_choice', 'multiple_choice', 'MCQ', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'true_false'].includes(type);
    const isChoice = [
      'single_choice',
      'multiple_choice',
      'MCQ',
      'MULTIPLE_CHOICE',
      'TRUE_FALSE',
    ].includes(type);

    if (type === 'TRUE_FALSE') {
      const rawOptions = dto.options !== undefined ? dto.options : question.options;
      const source =
        Array.isArray(rawOptions) && rawOptions.length > 0
          ? rawOptions
          : ['True', 'False'];

      if (source.length !== 2) {
        throw new BadRequestException(
          'True/False questions must contain exactly two options: True and False',
        );
      }

      const optTexts = source.map((o: any) =>
        (typeof o === 'string' ? o : o?.text || '').trim(),
      );
      const lowerTexts = optTexts.map((t) => t.toLowerCase());

      if (lowerTexts[0] === lowerTexts[1]) {
        throw new BadRequestException(
          'True/False questions cannot have duplicate options',
        );
      }

      if (
        !lowerTexts.includes('true') ||
        !lowerTexts.includes('false')
      ) {
        throw new BadRequestException(
          'True/False questions must contain True and False options',
        );
      }

      dto.options = ['True', 'False'];

      let selectedAnswer: number | null = null;
      if (dto.options !== undefined && Array.isArray(rawOptions)) {
        const flagged = rawOptions
          .map((o: any, i: number) => {
            if (typeof o === 'object' && o?.isCorrect) {
              return lowerTexts[i] === 'false' ? 1 : 0;
            }
            return -1;
          })
          .filter((i: number) => i >= 0);

        if (flagged.length > 1) {
          throw new BadRequestException(
            'True/False questions cannot have more than one correct answer',
          );
        } else if (flagged.length === 1) {
          selectedAnswer = flagged[0];
        }
      }

      if (dto.correctAnswer !== undefined) {
        if (dto.correctAnswer !== 0 && dto.correctAnswer !== 1) {
          throw new BadRequestException(
            'correctAnswer for True/False must be 0 (True) or 1 (False)',
          );
        }
        selectedAnswer = dto.correctAnswer;
      }

      if (dto.correctAnswers !== undefined && dto.correctAnswers.length > 0) {
        if (dto.correctAnswers.length > 1) {
          throw new BadRequestException(
            'True/False questions cannot have more than one correct answer',
          );
        }
        if (dto.correctAnswers[0] !== 0 && dto.correctAnswers[0] !== 1) {
          throw new BadRequestException(
            'correctAnswers for True/False must contain 0 (True) or 1 (False)',
          );
        }
        selectedAnswer = dto.correctAnswers[0];
      }

      if (selectedAnswer !== null) {
        dto.correctAnswer = selectedAnswer;
        dto.correctAnswers = [selectedAnswer];
      } else {
        const existingAns = question.correctAnswer === 1 ? 1 : 0;
        dto.correctAnswer = existingAns;
        dto.correctAnswers = [existingAns];
      }
    } else if (isChoice) {
      if (dto.options !== undefined) {
        const rawOptions = dto.options;
        const source = Array.isArray(rawOptions) ? rawOptions : [];
        const options = source.map((o: any) =>
          typeof o === 'string' ? o : o?.text || '',
        );
        const flagged = source
          .map((o: any, i: number) => (typeof o === 'object' && o?.isCorrect ? i : -1))
          .filter((i: number) => i >= 0);

        if (flagged.length > 0 && dto.correctAnswer === undefined) {
          dto.correctAnswers = flagged;
          dto.correctAnswer = flagged[0];
        }

        if (options.length < 2 || options.some((o) => !o.trim())) {
          throw new BadRequestException(
            'Choice questions need at least 2 non-empty options',
          );
        }

        const effectiveCorrectAnswer =
          dto.correctAnswer !== undefined ? dto.correctAnswer : question.correctAnswer;
        if (
          effectiveCorrectAnswer !== undefined &&
          (effectiveCorrectAnswer < 0 || effectiveCorrectAnswer >= options.length)
        ) {
          throw new BadRequestException(
            `correctAnswer must be a valid zero-based index between 0 and ${options.length - 1}`,
          );
        }
        dto.options = options;
      } else if (dto.correctAnswer !== undefined) {
        const currentOptions = question.options || [];
        if (
          currentOptions.length > 0 &&
          (dto.correctAnswer < 0 || dto.correctAnswer >= currentOptions.length)
        ) {
          throw new BadRequestException(
            `correctAnswer must be a valid index between 0 and ${currentOptions.length - 1}`,
          );
        }
      }
    }

    const isMcqQuestion = isMcqTitleType;
    if (isMcqQuestion && dto.url_slug !== undefined && dto.slug === undefined) {
      dto.slug = dto.url_slug;
    }
    delete (dto as any).url_slug;
    if (!isMcqQuestion && dto.title && !dto.question) {
      dto.question = dto.title;
    }

    if (dto.slug !== undefined) {
      const trimmedSlug = (dto.slug || '').trim();
      if (!trimmedSlug) {
        dto.slug = null as any;
      } else {
        const normalized = trimmedSlug
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');

        const existing = await this.questionRepository.findOne({
          where: { slug: normalized },
        });
        if (existing && existing.id !== question.id) {
          throw new BadRequestException(
            `URL slug "${normalized}" is already in use by another question.`,
          );
        }
        dto.slug = normalized;
      }
    }

    const { categories, visibility, contestOnly, timeComplexity, spaceComplexity, ...updates } = dto;
    const existingCategories: unknown = question.metadata?.categories;
    if (categories !== undefined) {
      const topics = this.normalizeCategories(categories);
      question.metadata = { ...question.metadata, categories: topics };
      updates.topic = topics[0] || 'General';
    } else if (
      updates.topic !== undefined &&
      Array.isArray(existingCategories)
    ) {
      question.metadata = {
        ...question.metadata,
        categories: this.normalizeCategories([
          updates.topic,
          ...existingCategories
            .slice(1)
            .filter(
              (category: unknown): category is string =>
                typeof category === 'string',
            ),
        ]),
      };
    }
    if (visibility !== undefined) {
      question.metadata = { ...question.metadata, visibility };
    }
    if (contestOnly !== undefined) {
      question.metadata = { ...question.metadata, contestOnly };
    }
    if (timeComplexity !== undefined || spaceComplexity !== undefined) {
      question.metadata = {
        ...question.metadata,
        ...(timeComplexity !== undefined ? { timeComplexity } : {}),
        ...(spaceComplexity !== undefined ? { spaceComplexity } : {}),
      };
    }
    Object.assign(question, updates);
    await this.questionRepository.save(question);
    if (isMcqQuestion) (question as any).url_slug = question.slug;
    await this.cacheService.invalidatePrefix('problems:');

    const auditLog = this.auditLogRepository.create({
      actorId: adminUser.id || adminUser._id,
      actorEmail: adminUser.email,
      action: 'UPDATE_QUESTION',
      target: question.id,
      targetType: 'Question',
      ipAddress: ip,
      userAgent: userAgent,
      metadata: { updates: dto },
    });
    await this.auditLogRepository.save(auditLog);

    return question;
  }

  async bulkUpdate(
    ids: string[],
    updates: UpdateQuestionDto,
    adminUser: any,
    ip = '',
    userAgent = '',
  ) {
    if (!ids || !ids.length) {
      throw new BadRequestException('Question IDs are required for bulk update');
    }
    const questions = await this.questionRepository.findBy({ id: In(ids) });
    if (!questions.length) {
      throw new NotFoundException('No questions found matching provided IDs');
    }

    const { categories, visibility, contestOnly, ...restUpdates } = updates as any;
    for (const q of questions) {
      if (categories !== undefined) {
        const topics = this.normalizeCategories(categories);
        q.metadata = { ...q.metadata, categories: topics };
        q.topic = topics[0] || q.topic || 'General';
      }
      if (visibility !== undefined) {
        q.metadata = { ...q.metadata, visibility };
        if (visibility === 'Published') q.status = 'active';
        else if (visibility === 'Draft') q.status = 'draft';
      }
      if (contestOnly !== undefined) {
        q.metadata = { ...q.metadata, contestOnly };
      }
      for (const [key, val] of Object.entries(restUpdates)) {
        if (val !== undefined && val !== null && val !== '') {
          (q as any)[key] = val;
        }
      }
    }

    await this.questionRepository.save(questions);
    await this.cacheService.invalidatePrefix('problems:');

    const auditLog = this.auditLogRepository.create({
      actorId: adminUser.id || adminUser._id,
      actorEmail: adminUser.email,
      action: 'BULK_UPDATE_QUESTIONS',
      target: ids.join(','),
      targetType: 'Question',
      ipAddress: ip,
      userAgent: userAgent,
      metadata: { ids, updates },
    });
    await this.auditLogRepository.save(auditLog);

    return {
      success: true,
      message: `Successfully updated ${questions.length} questions`,
      updatedCount: questions.length,
    };
  }

  async delete(id: string, adminUser: any, ip = '', userAgent = '') {
    const question = await this.questionRepository.findOne({ where: { id } });
    if (!question) throw new NotFoundException('Question not found');

    question.status = 'archived';
    await this.questionRepository.save(question);
    await this.cacheService.invalidatePrefix('problems:');

    const auditLog = this.auditLogRepository.create({
      actorId: adminUser.id || adminUser._id,
      actorEmail: adminUser.email,
      action: 'DELETE_QUESTION',
      target: question.id,
      targetType: 'Question',
      ipAddress: ip,
      userAgent: userAgent,
    });
    await this.auditLogRepository.save(auditLog);

    return { success: true, message: 'Question successfully archived' };
  }

  async review(
    id: string,
    status: 'approved' | 'rejected',
    reason = '',
    adminUser: any,
    ip = '',
    userAgent = '',
  ) {
    const question = await this.questionRepository.findOne({ where: { id } });
    if (!question) throw new NotFoundException('Question not found');

    question.status = status;
    if (status === 'approved') {
      question.approved_by_id = adminUser.id || adminUser._id;
      question.approvedAt = new Date();
      question.rejectedReason = undefined;
    } else {
      question.rejectedReason =
        reason || 'Declined during administrative review';
    }

    await this.questionRepository.save(question);
    await this.cacheService.invalidatePrefix('problems:');

    const auditLog = this.auditLogRepository.create({
      actorId: adminUser.id || adminUser._id,
      actorEmail: adminUser.email,
      action: status === 'approved' ? 'APPROVE_QUESTION' : 'REJECT_QUESTION',
      target: question.id,
      targetType: 'Question',
      ipAddress: ip,
      userAgent: userAgent,
      metadata: { reason },
    });
    await this.auditLogRepository.save(auditLog);

    return question;
  }

  async getTopicsDistribution(subject?: string) {
    if (subject?.trim()) {
      const rows = await this.questionRepository.query(
        `SELECT DISTINCT subtopic AS topic
         FROM questions
         WHERE (status IS NULL OR status = 'approved' OR status = 'active')
           AND subtopic IS NOT NULL
           AND BTRIM(subtopic) <> ''
           AND (topic = $1 OR (metadata->'categories') ? $1)
         ORDER BY subtopic`,
        [subject.trim()],
      );
      return rows.map((row: { topic: string }) => row.topic);
    }

    const query = await this.questionRepository.query(`
      SELECT 
        category as topic,
        COUNT(*) as total,
        SUM(CASE WHEN difficulty = 'easy' THEN 1 ELSE 0 END) as easy,
        SUM(CASE WHEN difficulty = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN difficulty = 'hard' THEN 1 ELSE 0 END) as hard,
        SUM(CASE WHEN status = 'approved' OR status = 'active' OR status IS NULL THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'pending' OR status = 'pending_review' THEN 1 ELSE 0 END) as pending
      FROM questions
      CROSS JOIN LATERAL (
        SELECT DISTINCT value AS category
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(COALESCE(metadata->'categories', '[]'::jsonb)) = 'array' AND COALESCE(metadata->'categories', '[]'::jsonb) <> '[]'::jsonb
            THEN metadata->'categories'
            ELSE jsonb_build_array(COALESCE(NULLIF(topic, ''), 'General'))
          END
        )
      ) AS categories
      WHERE (status IS NULL OR status != 'archived')
      GROUP BY category
      ORDER BY total DESC
    `);

    return query.map((t: any) => ({
      topic: t.topic,
      total: Number(t.total) || 0,
      easy: Number(t.easy) || 0,
      medium: Number(t.medium) || 0,
      hard: Number(t.hard) || 0,
      approved: Number(t.approved) || 0,
      pending: Number(t.pending) || 0,
    }));
  }

  // --- Question Bank Collection Methods ---

  async findAllBanks(topic?: string) {
    const qb = this.questionBankRepository.createQueryBuilder('bank')
      .leftJoinAndSelect('bank.createdBy', 'createdBy');
    
    if (topic) {
      qb.where('bank.topic = :topic', { topic });
    }

    const banks = await qb.orderBy('bank.createdAt', 'DESC').getMany();

    // Map questions for frontend if we were populated before
    for (const bank of banks) {
      if (bank.questions && bank.questions.length > 0) {
        const qEntities = await this.questionRepository.find({
          where: { id: In(bank.questions) },
          select: { id: true, question: true, topic: true, difficulty: true, marks: true, options: true }
        });
        (bank as any).questions = qEntities;
      }
    }

    return banks;
  }

  async findBankById(id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) throw new BadRequestException('Invalid ID');

    const bank = await this.questionBankRepository.findOne({
      where: { id },
      relations: { createdBy: true }
    });

    if (!bank) throw new NotFoundException('Question Bank not found');

    if (bank.questions && bank.questions.length > 0) {
      const qEntities = await this.questionRepository.find({
        where: { id: In(bank.questions) },
      });
      (bank as any).questions = qEntities;
    }

    return bank;
  }

  async createBank(dto: CreateQuestionBankDto, adminUser: any) {
    const bank = this.questionBankRepository.create({
      ...dto,
      questions: dto.questions || [],
      createdBy_id: adminUser.id || adminUser._id,
    });
    return this.questionBankRepository.save(bank);
  }

  async updateBank(id: string, dto: Partial<CreateQuestionBankDto>) {
    const bank = await this.questionBankRepository.findOne({ where: { id } });
    if (!bank) throw new NotFoundException('Question Bank not found');

    if (dto.questions) bank.questions = dto.questions;
    if (dto.name) bank.name = dto.name;
    if (dto.description !== undefined) bank.description = dto.description;
    if (dto.topic) bank.topic = dto.topic;
    if (dto.isPublic !== undefined) bank.isPublic = dto.isPublic;
    if (dto.tags) bank.tags = dto.tags;

    return this.questionBankRepository.save(bank);
  }

  async deleteBank(id: string) {
    const res = await this.questionBankRepository.delete(id);
    if (res.affected === 0) throw new NotFoundException('Question Bank not found');
    return { success: true, message: 'Question Bank removed' };
  }

  // --- Bulk Question Import (XLSX / CSV) with Duplicate Detection & Merge Strategy ---

  normalizeQuestionStem(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/<[^>]*>/g, '') // strip HTML
      .replace(/[^\w\s]/g, '') // strip punctuation
      .replace(/\s+/g, ' ') // collapse whitespace
      .trim();
  }

  calculateContentHash(stem: string, questionType: string, topic: string): string {
    const normStem = this.normalizeQuestionStem(stem);
    const normType = (questionType || 'single_choice').toLowerCase().trim();
    const normTopic = (topic || 'general').toLowerCase().trim();
    return crypto
      .createHash('sha256')
      .update(`${normStem}:::${normType}:::${normTopic}`)
      .digest('hex');
  }

  private normalizeOptionList(options: any[]): string[] {
    if (!Array.isArray(options)) return [];
    return options
      .map((o) => {
        const text = typeof o === 'string' ? o : o.text || '';
        return text.toLowerCase().replace(/\s+/g, ' ').trim();
      })
      .filter(Boolean);
  }

  async parseAndValidateQuestionsImport(
    fileBuffer: Buffer,
    sheetName?: string,
    requireSheetSelection = false,
  ) {
    const workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
      sheetStubs: false,
      raw: true,
      dense: true,
    });
    const sheetNames = workbook.SheetNames;
    if (!sheetNames.length) {
      throw new BadRequestException(
        'The uploaded spreadsheet contains no sheets.',
      );
    }

    const selectedSheet = sheetName || (!requireSheetSelection || sheetNames.length === 1 ? sheetNames[0] : null);
    if (selectedSheet && !sheetNames.includes(selectedSheet)) {
      throw new BadRequestException('Selected worksheet does not exist in the uploaded file.');
    }
    if (!selectedSheet) {
      return {
        sheetNames,
        selectedSheet: null,
        summary: {
          totalRows: 0, validCount: 0, invalidCount: 0, duplicateCount: 0,
          newCount: 0, exactDuplicateCount: 0, conflictCount: 0,
          toInsertCount: 0, toUpdateCount: 0,
        },
        validRows: [],
        errors: [],
      };
    }

    const worksheet = workbook.Sheets[selectedSheet];
    const rawParsed: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawParsed || rawParsed.length === 0) {
      throw new BadRequestException(
        'The uploaded spreadsheet contains no data rows.',
      );
    }

    // Sanitize rows against Prototype Pollution (CVE-2023-30533, CVE-2024-22363)
    const rawRows = rawParsed.map((row) => {
      const clean: Record<string, any> = {};
      for (const [key, val] of Object.entries(row)) {
        const lowerKey = key.trim().toLowerCase();
        if (
          lowerKey === '__proto__' ||
          lowerKey === 'constructor' ||
          lowerKey === 'prototype'
        ) {
          continue;
        }
        clean[key] = val;
      }
      return clean;
    });

    const normalizeHeader = (str: string) =>
      str.toLowerCase().replace(/[\s\-_.]/g, '');

    const findField = (row: any, aliases: string[]) => {
      const keys = Object.keys(row);
      const normalizedAliases = aliases.map(normalizeHeader);
      for (const key of keys) {
        if (normalizedAliases.includes(normalizeHeader(key))) {
          const val = row[key];
          return typeof val === 'string' ? val.trim() : String(val).trim();
        }
      }
      return '';
    };

    const isEnabled = (value: string) =>
      ['1', 'true', 'yes', 'y', 'on'].includes(value.toLowerCase());

    const parsedRows: any[] = [];
    const fileHashMap = new Map<string, number>();

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      // Coding imports commonly provide a short title plus a separate `question`
      // column containing the full prompt (see the downloadable CSV template).
      // Keep those fields separate so the assessment can render the prompt.
      const explicitTitle = findField(row, [
        'title',
        'question_title',
        'name',
      ]);
      const questionText = findField(row, [
        'question',
        'question_text',
        'question_statement',
        'problem_statement',
        'problem',
      ]);
      let question = explicitTitle || questionText;
      const explicitSlug = findField(row, ['url_slug', 'slug']);
      const problemStatement =
        findField(row, [
          'problem_statement',
          'problem_description',
          'question_description',
          'statement',
          'description',
        ]) || (explicitTitle ? questionText : '');
      const rawQuestionType =
        findField(row, ['question_type', 'type', 'qtype']) || 'single_choice';
      const topic =
        findField(row, ['topic', 'subject', 'category']) || 'General';
      const subtopic = findField(row, ['subtopic', 'sub_topic', 'chapter']);
      const difficulty = (
        findField(row, ['difficulty', 'level']) || 'medium'
      ).toLowerCase();

      const rawMarks = findField(row, ['marks', 'mark', 'score', 'points']);
      const marks = rawMarks ? Number(rawMarks) : 1;

      const rawNeg = findField(row, [
        'negative_marks',
        'negative_mark',
        'negative',
        'penalty',
      ]);
      const negativeMarks = rawNeg ? Number(rawNeg) : 0;

      const optA = findField(row, [
        'option_a',
        'optiona',
        'option_1',
        'opt_a',
        'a',
      ]);
      const optB = findField(row, [
        'option_b',
        'optionb',
        'option_2',
        'opt_b',
        'b',
      ]);
      const optC = findField(row, [
        'option_c',
        'optionc',
        'option_3',
        'opt_c',
        'c',
      ]);
      const optD = findField(row, [
        'option_d',
        'optiond',
        'option_4',
        'opt_d',
        'd',
      ]);
      const optE = findField(row, [
        'option_e',
        'optione',
        'option_5',
        'opt_e',
        'e',
      ]);

      const correctAnswerRaw = findField(row, [
        'correct_answer',
        'correct',
        'answer',
        'key',
        'ans',
      ]);
      const explanation = findField(row, [
        'explanation',
        'solution',
        'rationale',
      ]);
      const codeSnippet = findField(row, [
        'code_snippet',
        'code',
        'snippet',
        'starter_code',
        'startercode',
      ]);
      const language = findField(row, ['language', 'lang']) || 'general';
      const rawTags = findField(row, ['tags', 'tag']);
      const tags = rawTags
        ? rawTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      const visibility = findField(row, ['visibility']) || 'Published';
      const inputFormat = findField(row, ['input_format']);
      const outputFormat = findField(row, ['output_format']);
      const timeComplexity = findField(row, ['time_complexity']);
      const spaceComplexity = findField(row, ['space_complexity']);
      const solutionExplanation = findField(row, ['solution_explanation']);
      const hasCodingTemplateColumns = Object.keys(row).some((key) =>
        ['language_cpp', 'language_java', 'language_python', 'reference_solution_cpp']
          .some((header) => normalizeHeader(key) === normalizeHeader(header)),
      );
      const codingLanguages = [
        { id: 'cpp', selected: findField(row, ['language_cpp']), starter: findField(row, ['starter_code_cpp']), reference: findField(row, ['reference_solution_cpp']) },
        { id: 'java', selected: findField(row, ['language_java']), starter: findField(row, ['starter_code_java']), reference: findField(row, ['reference_solution_java']) },
        { id: 'python3', selected: findField(row, ['language_python', 'language_python3']), starter: findField(row, ['starter_code_python', 'starter_code_python3']), reference: findField(row, ['reference_solution_python', 'reference_solution_python3']) },
      ];
      const supportedLanguages = codingLanguages
        .filter((item) => isEnabled(item.selected))
        .map((item) => item.id);
      const starterCode = codingLanguages
        .filter((item) => supportedLanguages.includes(item.id) && item.starter)
        .map((item) => ({ language: item.id, code: item.starter }));
      const referenceSolutions = codingLanguages
        .filter((item) => supportedLanguages.includes(item.id) && item.reference)
        .map((item) => ({ language: item.id, sourceCode: item.reference }));
      const examples = [1, 2].map((index) => ({
        input: findField(row, [`sample_input_${index}`]),
        output: findField(row, [`sample_output_${index}`]),
        explanation: findField(row, [`sample_explanation_${index}`]),
      })).filter((example) => example.input || example.output);
      const defaultLanguage = supportedLanguages.includes(language)
        ? language
        : supportedLanguages.includes('python3')
          ? 'python3'
          : supportedLanguages[0] || language;

      // Algorithmic / Coding specific columns
      const constraints = findField(row, [
        'constraints',
        'constraint',
        'limits',
      ]);
      const timeLimitRaw = findField(row, [
        'time_limit',
        'timelimit',
        'time_limit_ms',
      ]);
      const timeLimit =
        timeLimitRaw && !isNaN(Number(timeLimitRaw))
          ? Number(timeLimitRaw)
          : 2000;
      const memoryLimitRaw = findField(row, [
        'memory_limit',
        'memorylimit',
        'memory_limit_mb',
      ]);
      const memoryLimit =
        memoryLimitRaw && !isNaN(Number(memoryLimitRaw))
          ? Number(memoryLimitRaw)
          : 256;

      // Extract test cases
      const testCases: Array<{
        input: string;
        output: string;
        isHidden?: boolean;
        explanation?: string;
        weight?: number;
      }> = [];
      for (let tcIdx = 1; tcIdx <= 10; tcIdx++) {
        const inp = findField(row, [
          `test_input_${tcIdx}`,
          `testinput${tcIdx}`,
          `input_${tcIdx}`,
          `in_${tcIdx}`,
        ]);
        const out = findField(row, [
          `test_expected_output_${tcIdx}`,
          `test_output_${tcIdx}`,
          `testoutput${tcIdx}`,
          `output_${tcIdx}`,
          `out_${tcIdx}`,
        ]);
        if (inp || out) {
          testCases.push({
            input: inp,
            output: out,
            isHidden: isEnabled(findField(row, [`test_hidden_${tcIdx}`])) ||
              (findField(row, [`test_hidden_${tcIdx}`]) === '' && tcIdx > 2),
            explanation: findField(row, [`test_explanation_${tcIdx}`]),
            weight: Number(findField(row, [`test_weight_${tcIdx}`])) || 1,
          });
        }
      }
      let testCaseJsonError = false;
      const rawTestCasesJson = findField(row, [
        'test_cases',
        'testcases',
        'testcase',
        'tests',
      ]);
      if (rawTestCasesJson) {
        try {
          const parsedTc = JSON.parse(rawTestCasesJson);
          if (Array.isArray(parsedTc)) {
            testCases.push(...parsedTc);
          } else {
            testCaseJsonError = true;
          }
        } catch (e) {
          testCaseJsonError = true;
        }
      }

      const typeKey = rawQuestionType.toLowerCase().replace(/[\s-]/g, '_');
      const TYPE_MAP: Record<string, string> = {
        single_choice: 'single_choice',
        mcq: 'single_choice',
        single: 'single_choice',
        multiple_choice: 'multiple_choice',
        multiple: 'multiple_choice',
        msq: 'multiple_choice',
        true_false: 'true_false',
        truefalse: 'true_false',
        tf: 'true_false',
        coding: 'coding',
        algorithmic: 'coding',
        algorithm: 'coding',
        code: 'coding',
        dsa: 'coding',
      };
      const mappedType = TYPE_MAP[typeKey];
      const isCoding = mappedType === 'coding' || testCases.length > 0;
      const unknownType = !isCoding && !mappedType;

      // True/False is stored as a two-option single choice question
      const isTrueFalse = !isCoding && mappedType === 'true_false';
      const questionType = isCoding
        ? 'coding'
        : isTrueFalse
          ? 'single_choice'
          : mappedType || typeKey;

      // The coding CSV contract keeps title as its imported question text.
      // MCQ rows carry a separate title and student-facing question statement.
      const title = !isCoding ? explicitTitle || questionText : explicitTitle;
      if (!isCoding) question = questionText || explicitTitle;
      const slug = isCoding
        ? explicitSlug
        : explicitSlug || (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const contentHash = this.calculateContentHash(
        question,
        questionType,
        topic,
      );

      parsedRows.push({
        rowNumber: i + 2,
        question,
        title,
        slug,
        slugProvided: Boolean(explicitSlug),
        slugCollision: false,
        problemStatement,
        questionType,
        unknownType,
        rawQuestionType,
        testCaseJsonError,
        rawMarks,
        rawNeg,
        topic,
        subtopic,
        difficulty: ['easy', 'medium', 'hard'].includes(difficulty)
          ? difficulty
          : 'medium',
        marks,
        negativeMarks,
        optA: isTrueFalse ? 'True' : optA,
        optB: isTrueFalse ? 'False' : optB,
        optC: isTrueFalse ? '' : optC,
        optD: isTrueFalse ? '' : optD,
        optE: isTrueFalse ? '' : optE,
        correctAnswerRaw,
        explanation,
        codeSnippet,
        language: defaultLanguage,
        tags,
        constraints,
        timeLimit,
        memoryLimit,
        testCases,
        visibility,
        inputFormat,
        outputFormat,
        timeComplexity,
        spaceComplexity,
        solutionExplanation,
        hasCodingTemplateColumns,
        supportedLanguages,
        starterCode,
        referenceSolutions,
        examples,
        isCoding,
        contentHash,
      });
    }

    // Retrieve potential database matches for all topics in the file
    const allTopics = [...new Set(parsedRows.map((r) => r.topic).filter(Boolean))];
    const existingDbQuestions = allTopics.length > 0
      ? await this.questionRepository.createQueryBuilder('question')
          .select([
            'question.id',
            'question.question',
            'question.slug',
            'question.questionType',
            'question.topic',
            'question.options',
            'question.correctAnswer',
            'question.correctAnswers',
            'question.marks',
            'question.explanation',
            'question.subtopic',
            'question.tags',
          ])
          .where('question.topic IN (:...topics)', { topics: allTopics })
          .andWhere('question.status != :archived', { archived: 'archived' })
          .getMany()
      : [];
    const existingSlugRows = await this.questionRepository.createQueryBuilder('question')
      .select('question.slug', 'slug')
      .where('question.slug IS NOT NULL')
      .getRawMany<{ slug: string }>();

    // Map existing questions by content hash and normalized stem for fast lookups
    const dbHashToQuestion = new Map<string, QuestionEntity>();
    const dbStemToQuestions = new Map<string, QuestionEntity[]>();

    for (const eq of existingDbQuestions) {
      const hash = this.calculateContentHash(eq.question, eq.questionType, eq.topic);
      dbHashToQuestion.set(hash, eq);

      const normStemKey = `${eq.topic.toLowerCase()}:::${this.normalizeQuestionStem(eq.question)}`;
      if (!dbStemToQuestions.has(normStemKey)) {
        dbStemToQuestions.set(normStemKey, []);
      }
      dbStemToQuestions.get(normStemKey)!.push(eq);
    }

    // Slugs remain globally unique even for archived questions. Keep that
    // database invariant while allocating a fresh slug for re-imported rows.
    const usedSlugs = new Set(
      existingSlugRows.map((question) => question.slug).filter(Boolean),
    );
    for (const row of parsedRows) {
      if (!row.slug) continue;
      const stemKey = `${row.topic.toLowerCase()}:::${this.normalizeQuestionStem(row.question)}`;
      const activeMatch = (dbStemToQuestions.get(stemKey) || []).find((candidate) =>
        row.isCoding
          ? ['coding', 'algorithmic', 'DSA'].includes(candidate.questionType)
          : ['MCQ', 'single_choice', 'MULTIPLE_CHOICE', 'multiple_choice', 'TRUE_FALSE', 'true_false'].includes(candidate.questionType),
      );
      if (activeMatch?.slug) {
        row.slug = activeMatch.slug;
        usedSlugs.add(row.slug);
        continue;
      }
      const base = row.slug;
      let candidate = base;
      let suffix = 2;
      while (usedSlugs.has(candidate)) candidate = `${base}-${suffix++}`;
      row.slug = candidate;
      usedSlugs.add(candidate);
    }

    const errors: { row: number; question?: string; questionType?: string; error: string; isDuplicate?: boolean }[] = [];
    const validRows: any[] = [];
    let duplicatesInFile = 0;
    let exactDuplicatesCount = 0;
    let conflictsCount = 0;
    let newCount = 0;
    let invalid = 0;

    for (const row of parsedRows) {
      const rowErrors: string[] = [];

      if (!row.question) {
        rowErrors.push('Question statement is missing');
      }
      if (!row.isCoding && !row.title) rowErrors.push('Title is required for MCQs');
      if (!row.isCoding && !row.slug) rowErrors.push('URL slug is required for MCQs');
      if (row.slugCollision) rowErrors.push('URL slug is already in use');

      if (!row.topic) {
        rowErrors.push('Topic is required');
      }

      if (row.unknownType) {
        rowErrors.push(
          `Unsupported question type '${row.rawQuestionType}' (use single_choice, multiple_choice, true_false or coding)`,
        );
      }

      if (row.rawMarks && (isNaN(row.marks) || row.marks <= 0)) {
        rowErrors.push('Marks must be a positive number');
      }
      if (row.rawNeg && (isNaN(row.negativeMarks) || row.negativeMarks < 0)) {
        rowErrors.push('Negative marks must be zero or a positive number');
      }

      if (row.isCoding) {
        if (row.testCaseJsonError) {
          rowErrors.push('test_cases column is not a valid JSON array');
        }
        const usable = (row.testCases || []).filter(
          (t: any) => t && String(t.output ?? t.expectedOutput ?? '').trim(),
        );
        if (usable.length === 0) {
          rowErrors.push(
            'Coding questions require at least one test case with expected output',
          );
        }
        if (row.hasCodingTemplateColumns) {
          if (!row.slug) rowErrors.push('URL slug is required for coding questions');
          if (row.supportedLanguages.length !== 3) {
            rowErrors.push('C++, Java and Python must all be selected');
          }
          for (const language of row.supportedLanguages) {
            if (!row.starterCode.some((code: any) => code.language === language)) {
              rowErrors.push(`Starter code is required for ${language}`);
            }
            if (!row.referenceSolutions.some((code: any) => code.language === language)) {
              rowErrors.push(`Reference solution is required for ${language}`);
            }
          }
          if (row.examples.length < 2 || row.examples.some((example: any) => !example.input || !example.output)) {
            rowErrors.push('Two complete sample examples are required');
          }
          if (usable.length < 2) rowErrors.push('Two test cases with expected output are required');
          if (!row.solutionExplanation || !row.timeComplexity || !row.spaceComplexity) {
            rowErrors.push('Solution explanation, time complexity and space complexity are required');
          }
        }
      }

      const isChoice = ['single_choice', 'multiple_choice'].includes(
        row.questionType,
      );
      let formattedOptions: Array<{
        text: string;
        isCorrect: boolean;
        explanation?: string;
      }> = [];

      if (isChoice) {
        const rawOptions = [
          { key: 'A', text: row.optA },
          { key: 'B', text: row.optB },
          { key: 'C', text: row.optC },
          { key: 'D', text: row.optD },
          ...(row.optE ? [{ key: 'E', text: row.optE }] : []),
        ].filter((o) => o.text && o.text.trim());

        if (rawOptions.length < 2) {
          rowErrors.push(
            'Multiple choice questions require at least 2 populated options',
          );
        }

        if (!row.correctAnswerRaw) {
          rowErrors.push('Correct answer is missing');
        } else {
          const rawAnswerParts = row.correctAnswerRaw
            .toUpperCase()
            .split(/[,/|]/)
            .map((s: string) => s.trim());

          formattedOptions = rawOptions.map((opt, idx) => {
            const matchesKey = rawAnswerParts.includes(opt.key);
            const matchesNumeric = rawAnswerParts.includes(String(idx + 1));
            const matchesText = rawAnswerParts.some(
              (ans: string) => ans.toLowerCase() === opt.text.toLowerCase(),
            );
            return {
              text: opt.text,
              isCorrect: matchesKey || matchesNumeric || matchesText,
            };
          });

          const correctCount = formattedOptions.filter(
            (o) => o.isCorrect,
          ).length;
          if (correctCount === 0) {
            rowErrors.push(
              `Correct answer '${row.correctAnswerRaw}' did not match any of options (A, B, C, D)`,
            );
          } else if (row.questionType === 'single_choice' && correctCount > 1) {
            rowErrors.push(
              'Single choice question cannot have multiple correct answers',
            );
          }
        }
      }

      // Check duplicates within the uploaded file itself
      let isFileDuplicate = false;
      if (fileHashMap.has(row.contentHash)) {
        rowErrors.push(
          `Duplicate question within the uploaded file (matches row ${fileHashMap.get(row.contentHash)})`,
        );
        duplicatesInFile++;
        isFileDuplicate = true;
      } else {
        fileHashMap.set(row.contentHash, row.rowNumber);
      }

      if (rowErrors.length > 0) {
        invalid++;
        errors.push({
          row: row.rowNumber,
          question: row.question || `Row ${row.rowNumber}`,
          questionType: row.isCoding ? 'coding' : 'mcq',
          error: rowErrors.join('. '),
          isDuplicate: isFileDuplicate,
        });
        continue;
      }

      // Option-Aware Duplicate & Conflict Detection against database
      let matchStatus: 'new' | 'exact_duplicate' | 'conflict' = 'new';
      let conflictReason = '';
      let existingQuestion: QuestionEntity | null = null;

      const normStemKey = `${row.topic.toLowerCase()}:::${this.normalizeQuestionStem(row.question)}`;
      const candidates = dbStemToQuestions.get(normStemKey) || [];

      if (candidates.length > 0) {
        existingQuestion = candidates[0];
        const existingOpts = this.normalizeOptionList(existingQuestion.options || []);
        const importedOpts = this.normalizeOptionList(formattedOptions);

        if (isChoice && existingOpts.length > 0 && importedOpts.length > 0) {
          const sameLength = existingOpts.length === importedOpts.length;
          const sameOpts = sameLength && existingOpts.every((opt, idx) => opt === importedOpts[idx]);

          const importedCorrectIdx = formattedOptions.findIndex((o) => o.isCorrect);
          const sameAnswer =
            existingQuestion.correctAnswer === (importedCorrectIdx >= 0 ? importedCorrectIdx : 0);

          if (sameOpts && sameAnswer) {
            matchStatus = 'exact_duplicate';
            conflictReason = 'Identical question with matching options and correct answer exists in bank';
            exactDuplicatesCount++;
          } else {
            matchStatus = 'conflict';
            const reasons: string[] = [];
            if (!sameOpts) reasons.push('Option variation detected');
            if (!sameAnswer) {
              reasons.push(
                `Correct answer difference (DB: option ${existingQuestion.correctAnswer + 1}, import: option ${importedCorrectIdx + 1})`,
              );
            }
            conflictReason = reasons.join('; ');
            conflictsCount++;
          }
        } else {
          // Coding or matching without options
          matchStatus = 'exact_duplicate';
          conflictReason = 'Question statement already exists in this topic';
          exactDuplicatesCount++;
        }
      } else {
        matchStatus = 'new';
        newCount++;
      }

      validRows.push({
        rowNumber: row.rowNumber,
        question: row.question,
        ...(!row.isCoding ? { title: row.title, slug: row.slug, url_slug: row.slug } : {}),
        problemStatement: row.problemStatement,
        questionType: row.questionType,
        topic: row.topic,
        subtopic: row.subtopic || undefined,
        difficulty: row.difficulty,
        marks: row.marks,
        negativeMarks: row.negativeMarks,
        options: isChoice ? formattedOptions : undefined,
        explanation: row.solutionExplanation || row.explanation || undefined,
        codeSnippet: row.codeSnippet || undefined,
        language: row.language !== 'general' ? row.language : undefined,
        tags: row.tags,
        constraints: row.constraints,
        timeLimit: row.timeLimit,
        memoryLimit: row.memoryLimit,
        testCases: row.testCases,
        slug: row.slug || undefined,
        visibility: row.visibility,
        inputFormat: row.inputFormat,
        outputFormat: row.outputFormat,
        timeComplexity: row.timeComplexity,
        spaceComplexity: row.spaceComplexity,
        solutionExplanation: row.solutionExplanation,
        supportedLanguages: row.supportedLanguages,
        starterCode: row.starterCode,
        referenceSolutions: row.referenceSolutions,
        examples: row.examples,
        contentHash: row.contentHash,
        matchStatus,
        conflictReason: conflictReason || undefined,
        existingQuestionId: existingQuestion?.id,
        isUpdate: matchStatus !== 'new',
        status: 'approved',
      });
    }

    return {
      sheetNames,
      selectedSheet,
      summary: {
        totalRows: parsedRows.length,
        validCount: validRows.length,
        invalidCount: invalid,
        duplicateCount: duplicatesInFile,
        newCount,
        exactDuplicateCount: exactDuplicatesCount,
        conflictCount: conflictsCount,
        toInsertCount: newCount,
        toUpdateCount: exactDuplicatesCount + conflictsCount,
      },
      validRows,
      errors,
    };
  }

  async confirmQuestionsImport(
    validRows: any[],
    adminUser: any,
    ip = '',
    userAgent = '',
    mergeStrategy: 'skip' | 'update' | 'merge' = 'skip',
    batchContext?: { fileName: string; totalRows: number; invalidCodingCount?: number },
  ) {
    if ((!validRows || validRows.length === 0) && !batchContext) {
      throw new BadRequestException('No valid question rows to import.');
    }

    const invalidCodingCount = Number(batchContext?.invalidCodingCount) || 0;
    const invalidMcqCount = Math.max(0, (batchContext?.totalRows || 0) - (validRows?.length || 0) - invalidCodingCount);
    const batches = batchContext
      ? await Promise.all((['MCQ', 'CODING'] as const)
          .filter((type) => validRows.some((row) => (row.questionType === 'coding') === (type === 'CODING')) || type === 'CODING' && invalidCodingCount > 0 || type === 'MCQ' && invalidMcqCount > 0)
          .map((type) => this.createImportBatch(
            batchContext.fileName,
            type,
            validRows.filter((row) => (row.questionType === 'coding') === (type === 'CODING')).length + (type === 'CODING' ? invalidCodingCount : invalidMcqCount),
            adminUser,
          )))
      : [];

    if (!validRows || validRows.length === 0) {
      if (batches.length) {
        await Promise.all(batches.map((batch) => this.questionRepository.manager.getRepository(QuestionBulkUploadBatch).update(batch.id, {
          successfulQuestions: 0,
          failedQuestions: batch.totalQuestions,
          status: 'FAILED',
        })));
      }
      return {
        success: true,
        message: 'No questions were imported because every row failed validation.',
        count: 0,
        totalProcessed: 0,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        mergeStrategy,
        batches: batches.map((batch) => ({ id: batch.id, batchCode: batch.batchCode, questionType: batch.questionType, createdAt: batch.createdAt })),
      };
    }

    const docs = validRows.map((r) => {
      let optionsList: string[] = [];
      let correctAnswerIndex = 0;
      if (Array.isArray(r.options)) {
        optionsList = r.options.map((o: any) =>
          typeof o === 'string' ? o : o.text || '',
        );
        const correctIdx = r.options.findIndex(
          (o: any) => typeof o === 'object' && o.isCorrect,
        );
        correctAnswerIndex = correctIdx >= 0 ? correctIdx : 0;
      }

      const isCodingRow = r.questionType === 'coding';
      const correctIndices = Array.isArray(r.options)
        ? r.options
            .map((o: any, idx: number) =>
              typeof o === 'object' && o.isCorrect ? idx : -1,
            )
            .filter((idx: number) => idx >= 0)
        : [];
      const normalizedTestCases = (r.testCases || [])
        .map((t: any, idx: number) => ({
          id: String(t.id ?? idx + 1),
          input: String(t.input ?? ''),
          expectedOutput: String(t.expectedOutput ?? t.output ?? ''),
          isHidden: t.isHidden ?? idx >= 2,
          weight: Number(t.weight) > 0 ? Number(t.weight) : 1,
          ...(t.explanation ? { explanation: String(t.explanation) } : {}),
        }))
        .filter((t: any) => t.expectedOutput.trim());
      const constraintList = Array.isArray(r.constraints)
        ? r.constraints
        : String(r.constraints || '')
            .split('\n')
            .map((c: string) => c.trim())
            .filter(Boolean);

      const contentHash =
        r.contentHash ||
        this.calculateContentHash(r.question, r.questionType, r.topic);

      return {
        question: r.question,
        ...(!isCodingRow ? { title: r.title, slug: r.slug ?? r.url_slug, url_slug: r.url_slug ?? r.slug } : {}),
        questionType: r.questionType || 'single_choice',
        topic: r.topic,
        subtopic: r.subtopic || '',
        difficulty: r.difficulty || 'medium',
        marks: r.marks || 1,
        negativeMarks: r.negativeMarks || 0,
        options: optionsList,
        correctAnswer: correctAnswerIndex,
        correctAnswers: correctIndices,
        explanation: r.explanation || '',
        codeSnippet: r.codeSnippet || '',
        language: r.language || 'general',
        tags: r.tags || [],
        status: isCodingRow && ['draft', 'private'].includes(String(r.visibility || '').toLowerCase())
          ? 'draft'
          : 'approved',
        createdBy_id: adminUser?.id || adminUser?._id,
        approvedBy_id: isCodingRow && ['draft', 'private'].includes(String(r.visibility || '').toLowerCase())
          ? undefined
          : adminUser?.id || adminUser?._id,
        approvedAt: isCodingRow && ['draft', 'private'].includes(String(r.visibility || '').toLowerCase())
          ? undefined
          : new Date(),
        contentHash,
        existingQuestionId: r.existingQuestionId,
        matchStatus: r.matchStatus || 'new',
        ...(isCodingRow
          ? {
              problemStatement: r.problemStatement || r.question,
              title: r.question,
              slug: r.slug || undefined,
              inputFormat: r.inputFormat || '',
              outputFormat: r.outputFormat || '',
              examples: r.examples || [],
              starterCode: r.starterCode || [],
              referenceSolutions: r.referenceSolutions || [],
              supportedLanguages: r.supportedLanguages || [],
              constraints: constraintList,
              timeLimit: r.timeLimit || 2000,
              memoryLimit: r.memoryLimit || 256,
              testCases: normalizedTestCases,
            }
          : {}),
        metadata: {
          importedVia: 'bulk_csv',
          originalRow: r.rowNumber,
          contentHash,
          ...(isCodingRow ? {
            visibility: r.visibility || 'Published',
            timeComplexity: r.timeComplexity || '',
            spaceComplexity: r.spaceComplexity || '',
            solutionExplanation: r.solutionExplanation || '',
          } : {}),
        },
      };
    });

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const insertedByType: Record<'MCQ' | 'CODING', number> = { MCQ: 0, CODING: 0 };
    const updatedByType: Record<'MCQ' | 'CODING', number> = { MCQ: 0, CODING: 0 };
    const skippedByType: Record<'MCQ' | 'CODING', number> = { MCQ: 0, CODING: 0 };
    const totalProcessed = docs.length;

    // Execute transactional import with merge strategy protection
    try {
      await this.questionRepository.manager.transaction(async (manager) => {
      for (const doc of docs) {
        let existing: QuestionEntity | null = null;

        if (doc.existingQuestionId) {
          existing = await manager.findOne(QuestionEntity, {
            where: { id: doc.existingQuestionId },
          });
        }
        if (!existing) {
          existing = await manager.findOne(QuestionEntity, {
            where: { question: doc.question, topic: doc.topic },
          });
        }
        if (existing?.status === 'archived') existing = null;

        if (existing) {
          if (mergeStrategy === 'skip') {
            totalSkipped++;
            skippedByType[doc.questionType === 'coding' ? 'CODING' : 'MCQ']++;
            continue;
          }

          if (mergeStrategy === 'update') {
            // Update question in place while strictly preserving question ID and assessment integrity
            existing.question = doc.question;
            if (doc.questionType !== 'coding') {
              existing.title = doc.title;
              existing.slug = doc.slug;
            }
            existing.questionType = doc.questionType;
            existing.topic = doc.topic;
            existing.subtopic = doc.subtopic;
            existing.difficulty = doc.difficulty;
            existing.marks = doc.marks;
            existing.negativeMarks = doc.negativeMarks;
            existing.options = doc.options;
            existing.correctAnswer = doc.correctAnswer;
            existing.correctAnswers = doc.correctAnswers;
            existing.explanation = doc.explanation || existing.explanation;
            existing.codeSnippet = doc.codeSnippet || existing.codeSnippet;
            existing.language = doc.language || existing.language;
            existing.tags = [...new Set([...(existing.tags || []), ...(doc.tags || [])])];
            if (doc.questionType === 'coding') {
              existing.status = doc.status;
              existing.timeLimit = doc.timeLimit;
              existing.memoryLimit = doc.memoryLimit;
            }
            existing.metadata = {
              ...(existing.metadata || {}),
              ...doc.metadata,
              lastMergedAt: new Date().toISOString(),
              mergeStrategy: 'update',
            };
            if (doc.problemStatement) existing.problemStatement = doc.problemStatement;
            if (doc.constraints) existing.constraints = doc.constraints;
            if (doc.testCases && doc.testCases.length > 0) existing.testCases = doc.testCases;
            if (doc.slug) existing.slug = doc.slug;
            if (doc.title) existing.title = doc.title;
            if (doc.inputFormat) existing.inputFormat = doc.inputFormat;
            if (doc.outputFormat) existing.outputFormat = doc.outputFormat;
            if (doc.examples?.length) existing.examples = doc.examples;
            if (doc.starterCode?.length) existing.starterCode = doc.starterCode;
            if (doc.referenceSolutions?.length) existing.referenceSolutions = doc.referenceSolutions;
            if (doc.supportedLanguages?.length) existing.supportedLanguages = doc.supportedLanguages;

            await manager.save(existing);
            totalUpdated++;
            updatedByType[doc.questionType === 'coding' ? 'CODING' : 'MCQ']++;
          } else if (mergeStrategy === 'merge') {
            // Safe merge: preserve existing answers, options, and marks, but enrich missing metadata
            if (!existing.subtopic && doc.subtopic) existing.subtopic = doc.subtopic;
            if (!existing.explanation && doc.explanation) existing.explanation = doc.explanation;
            if (!existing.codeSnippet && doc.codeSnippet) existing.codeSnippet = doc.codeSnippet;
            if (!existing.language && doc.language) existing.language = doc.language;
            existing.tags = [...new Set([...(existing.tags || []), ...(doc.tags || [])])];
            if ((!existing.testCases || existing.testCases.length === 0) && doc.testCases) {
              existing.testCases = doc.testCases;
            }
            if (!existing.slug && doc.slug) existing.slug = doc.slug;
            if (!existing.problemStatement && doc.problemStatement) existing.problemStatement = doc.problemStatement;
            if (!existing.inputFormat && doc.inputFormat) existing.inputFormat = doc.inputFormat;
            if (!existing.outputFormat && doc.outputFormat) existing.outputFormat = doc.outputFormat;
            if ((!existing.examples || existing.examples.length === 0) && doc.examples?.length) existing.examples = doc.examples;
            // Starter templates are explicit author-provided execution inputs. Refresh them
            // from the import when present, even when other existing question content is
            // intentionally preserved by the non-destructive merge strategy.
            if (doc.starterCode?.length) existing.starterCode = doc.starterCode;
            if ((!existing.referenceSolutions || existing.referenceSolutions.length === 0) && doc.referenceSolutions?.length) existing.referenceSolutions = doc.referenceSolutions;
            if ((!existing.supportedLanguages || existing.supportedLanguages.length === 0) && doc.supportedLanguages?.length) existing.supportedLanguages = doc.supportedLanguages;
            existing.metadata = {
              ...(existing.metadata || {}),
              ...doc.metadata,
              lastMergedAt: new Date().toISOString(),
              mergeStrategy: 'merge',
            };
            await manager.save(existing);
            totalUpdated++;
            updatedByType[doc.questionType === 'coding' ? 'CODING' : 'MCQ']++;
          }
        } else {
          const { existingQuestionId, matchStatus, ...newDocData } = doc;
          const newDoc = manager.create(QuestionEntity, {
            ...newDocData,
          ...(batchContext ? { bulk_upload_batch_id: batches.find((batch) => batch.questionType === (doc.questionType === 'coding' ? 'CODING' : 'MCQ'))?.id } : {}),
          } as any);
          await manager.save(newDoc);
          totalInserted++;
          insertedByType[doc.questionType === 'coding' ? 'CODING' : 'MCQ']++;
        }
      }
        if (batches.length) {
          const transactionalBatchRepository = manager.getRepository(QuestionBulkUploadBatch);
          for (const batch of batches) {
            const successCount = insertedByType[batch.questionType];
            const failedCount = batchContext?.invalidCodingCount !== undefined
              ? batch.questionType === 'CODING'
                ? invalidCodingCount
                : invalidMcqCount
              : 0;
            await transactionalBatchRepository.update(batch.id, {
              successfulQuestions: successCount,
              failedQuestions: failedCount,
              status: failedCount > 0
                ? successCount > 0 ? 'PARTIALLY_COMPLETED' : 'FAILED'
                : 'COMPLETED',
              metadata: {
                mergeStrategy,
                insertedCount: successCount,
                updatedCount: updatedByType[batch.questionType],
                skippedCount: skippedByType[batch.questionType],
              } as any,
            } as any);
          }
        }
      });
    } catch (error) {
      if (batches.length) {
        await Promise.all(batches.map((batch) => this.questionRepository.manager.getRepository(QuestionBulkUploadBatch).update(batch.id, {
          successfulQuestions: 0,
          failedQuestions: batch.totalQuestions,
          status: 'FAILED',
        }))).catch((trackingError) => console.error('Failed to mark question bulk-upload batch as failed', trackingError));
      }
      throw error;
    }

    await this.cacheService.invalidatePrefix('problems:');

    const auditLog = this.auditLogRepository.create({
      actorId: adminUser?.id || adminUser?._id,
      actorEmail: adminUser?.email || 'admin',
      action: 'BULK_IMPORT_QUESTIONS_MERGE',
      target: 'Question',
      targetType: 'Question',
      ipAddress: ip,
      userAgent: userAgent,
      metadata: {
        totalProcessed,
        newlyInserted: totalInserted,
        updated: totalUpdated,
        skipped: totalSkipped,
        mergeStrategy,
        sampleTopics: [...new Set(docs.map((d) => d.topic))].slice(0, 5),
      },
    });
    await this.auditLogRepository.save(auditLog);

    return {
      success: true,
      message: `Import processed with '${mergeStrategy}' strategy: ${totalInserted} questions created, ${totalUpdated} updated, ${totalSkipped} duplicate questions skipped.`,
      count: totalProcessed,
      totalProcessed,
      insertedCount: totalInserted,
      updatedCount: totalUpdated,
      skippedCount: totalSkipped,
      mergeStrategy,
      ...(batches.length ? { batches: batches.map(({ id, batchCode, questionType, createdAt }) => ({ id, batchCode, questionType, createdAt })) } : {}),
    };
  }

  async autoImportQuestions(
    fileBuffer: Buffer,
    adminUser: any,
    ip = '',
    userAgent = '',
    mergeStrategy: 'skip' | 'update' | 'merge' = 'skip',
    sheetName?: string,
    fileName = 'upload',
  ) {
    const preview = await this.parseAndValidateQuestionsImport(fileBuffer, sheetName, true);
    if (!preview.selectedSheet) {
      throw new BadRequestException('Select a worksheet before importing questions.');
    }
    if (!preview.validRows || preview.validRows.length === 0) {
      throw new BadRequestException(
        preview.errors?.[0]?.error || 'No valid question rows found in file.',
      );
    }
    const commit = await this.confirmQuestionsImport(
      preview.validRows,
      adminUser,
      ip,
      userAgent,
      mergeStrategy,
      {
        fileName,
        totalRows: preview.summary.totalRows,
        invalidCodingCount: preview.errors.filter((row: any) => row.questionType === 'coding').length,
      },
    );
    return {
      success: true,
      message: commit.message,
      summary: {
        ...preview.summary,
        insertedCount: commit.insertedCount,
        updatedCount: commit.updatedCount,
        skippedCount: commit.skippedCount,
      },
      validCount: preview.validRows.length,
      invalidCount: preview.summary.invalidCount,
      errors: preview.errors,
      mergeStrategy,
    };
  }
}
