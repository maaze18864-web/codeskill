import { applyQuestionBulkUploadBatchesMigration } from './question-bulk-upload-batches';

describe('question bulk-upload batches migration', () => {
  it('creates a shared batch table and nullable, safe question association', async () => {
    const query = jest.fn().mockResolvedValue(undefined);

    await applyQuestionBulkUploadBatchesMigration({ query });

    expect(query).toHaveBeenCalledTimes(9);
    expect(query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS "question_bulk_upload_batches"');
    expect(query.mock.calls[0][0]).toContain('UNIQUE ("batchCode")');
    expect(query.mock.calls[0][0]).toContain('ON DELETE SET NULL');
    expect(query.mock.calls[5][0]).toContain('ADD COLUMN IF NOT EXISTS "bulk_upload_batch_id" uuid');
    expect(query.mock.calls[8][0]).toContain('ON DELETE SET NULL');
  });
});
