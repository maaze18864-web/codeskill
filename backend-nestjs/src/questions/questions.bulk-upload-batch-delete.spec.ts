jest.mock('@nestjs/typeorm', () => ({ InjectRepository: () => () => {} }));

import { QuestionsService } from './questions.service';
import { Question as QuestionEntity } from '../database/entities/question.entity';
import { QuestionBulkUploadBatch } from '../database/entities/question-bulk-upload-batch.entity';

describe('QuestionsService bulk upload batch deletion', () => {
  const batchId = '123e4567-e89b-42d3-a456-426614174000';
  let service: QuestionsService;
  let questionRepo: any;
  let batchRepo: any;
  let manager: any;

  beforeEach(() => {
    batchRepo = { findOne: jest.fn().mockResolvedValue({ id: batchId }), delete: jest.fn().mockResolvedValue({ affected: 1 }) };
    manager = {
      getRepository: jest.fn((entity) => entity === QuestionBulkUploadBatch ? batchRepo : questionRepo),
      query: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      transaction: jest.fn(async (work) => work(manager)),
    };
    const questionQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: batchId, mongoId: 'legacy-id' }]),
    };
    questionRepo = { createQueryBuilder: jest.fn(() => questionQueryBuilder) };
    manager.getRepository.mockImplementation((entity) => entity === QuestionBulkUploadBatch ? batchRepo : questionRepo);
    const rootRepository = { manager };
    service = new QuestionsService(rootRepository as any, {} as any, {} as any, {} as any, { isSharded: false } as any);
  });

  it('deletes history only and leaves imported questions untouched', async () => {
    const result = await service.deleteBulkUploadBatch(batchId, 'history');

    expect(result).toMatchObject({ success: true, mode: 'history', deletedQuestions: 0 });
    expect(batchRepo.delete).toHaveBeenCalledWith(batchId);
    expect(questionRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('blocks deleting questions when a dependent record exists', async () => {
    manager.query.mockResolvedValue([{ dependency: 'assessments', count: 1 }]);

    await expect(service.deleteBulkUploadBatch(batchId, 'with-questions')).rejects.toThrow(
      'Cannot delete this batch because its questions are referenced by assessments.',
    );

    expect(manager.delete).not.toHaveBeenCalled();
    expect(batchRepo.delete).not.toHaveBeenCalled();
  });

  it('deletes only questions linked to the selected batch when no dependencies exist', async () => {
    const result = await service.deleteBulkUploadBatch(batchId, 'with-questions');

    expect(manager.delete).toHaveBeenCalledWith(QuestionEntity, { bulk_upload_batch_id: batchId });
    expect(batchRepo.delete).toHaveBeenCalledWith(batchId);
    expect(result).toMatchObject({ success: true, mode: 'with-questions', deletedQuestions: 1 });
  });
});
