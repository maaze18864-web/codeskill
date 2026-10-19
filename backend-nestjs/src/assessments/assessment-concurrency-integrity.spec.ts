jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { ConflictException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';

describe('Assessment Concurrency & Integrity Hardening (ISSUE-CONC-001, ISSUE-CONC-002, ISSUE-SEC-002)', () => {
  let service: AssessmentsService;
  let attemptRepo: any;
  let assessmentRepo: any;
  let questionRepo: any;
  let auditLogRepo: any;

  beforeEach(() => {
    attemptRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation(async (entity) => entity),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockImplementation((e) => e),
      delete: jest.fn(),
    };
    assessmentRepo = {
      findOne: jest.fn(),
    };
    questionRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    auditLogRepo = {
      save: jest.fn(),
    };

    service = new AssessmentsService(
      assessmentRepo,
      attemptRepo,
      questionRepo,
      auditLogRepo,
      { runCode: jest.fn() } as any,
      undefined,
      { uploadBase64Image: jest.fn().mockResolvedValue('https://bucket.s3.amazonaws.com/proctoring/test.jpg') } as any,
      undefined as any,
    );
  });

  describe('ISSUE-CONC-002: CAS Submission Locking & Double-Evaluation Prevention', () => {
    it('throws ConflictException if an attempt is already in evaluating status', async () => {
      const assessment = { id: 'asmt-1', questions: [] };
      const attempt = {
        id: 'att-1',
        assessmentId: 'asmt-1',
        studentId: 'stud-1',
        status: 'evaluating',
      };

      jest.spyOn(service, 'findAssessmentByIdOrCode').mockResolvedValue(assessment as any);
      jest.spyOn(service as any, 'isStudentTargeted').mockReturnValue(true);
      attemptRepo.findOne.mockResolvedValue(attempt);

      await expect(
        (service as any).evaluateAttempt('asmt-1', { responses: [] }, { id: 'stud-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if concurrent request lost the CAS transition race (affected === 0)', async () => {
      const assessment = { id: 'asmt-1', questions: [] };
      const attempt = {
        id: 'att-1',
        assessmentId: 'asmt-1',
        studentId: 'stud-1',
        status: 'in_progress',
      };

      jest.spyOn(service, 'findAssessmentByIdOrCode').mockResolvedValue(assessment as any);
      jest.spyOn(service as any, 'isStudentTargeted').mockReturnValue(true);
      attemptRepo.findOne.mockResolvedValue(attempt);

      // Simulate lost race: update affected is 0 because another worker updated it first
      attemptRepo.update.mockResolvedValue({ affected: 0 });

      await expect(
        (service as any).evaluateAttempt('asmt-1', { responses: [] }, { id: 'stud-1' }),
      ).rejects.toThrow(ConflictException);

      expect(attemptRepo.update).toHaveBeenCalledWith(
        { id: 'att-1', status: 'in_progress' },
        { status: 'evaluating' },
      );
    });
  });

  describe('ISSUE-SEC-002: Server-Authoritative Violation Preservation', () => {
    it('never overwrites existing server-detected violations when client sends a tampered/shorter array', async () => {
      const assessment = {
        id: 'asmt-1',
        questions: [],
        totalMarks: 100,
        passingMarks: 40,
        proctoring: { mode: 'partial_proctored', violationPenaltyMarks: 5 },
      };
      const attempt = {
        id: 'att-1',
        assessmentId: 'asmt-1',
        studentId: 'stud-1',
        status: 'in_progress',
        violations: [
          { type: 'MULTIPLE_FACES_DETECTED', timestamp: new Date('2026-10-18T10:00:00Z'), details: 'Cheating detected' },
          { type: 'SECONDARY_DEVICE', timestamp: new Date('2026-10-18T10:01:00Z'), details: 'Phone detected' },
        ],
      };

      jest.spyOn(service, 'findAssessmentByIdOrCode').mockResolvedValue(assessment as any);
      jest.spyOn(service as any, 'isStudentTargeted').mockReturnValue(true);
      attemptRepo.findOne.mockResolvedValue(attempt);
      attemptRepo.update.mockResolvedValue({ affected: 1 });

      // Client submits only 1 harmless violation to erase the server infractions
      const clientDto = {
        responses: [],
        violations: [
          { type: 'TAB_BLUR', timestamp: new Date('2026-10-18T10:02:00Z') },
        ],
      };

      await (service as any).evaluateAttempt('asmt-1', clientDto, { id: 'stud-1' });

      // Assert attemptRepo.save was called with all 3 violations preserved
      expect(attemptRepo.save).toHaveBeenCalled();
      const savedAttempt = attemptRepo.save.mock.calls[0][0];
      expect(savedAttempt.violations.length).toBe(3);
      expect(savedAttempt.violations.some((v: any) => v.type === 'MULTIPLE_FACES_DETECTED')).toBe(true);
      expect(savedAttempt.violations.some((v: any) => v.type === 'SECONDARY_DEVICE')).toBe(true);
      expect(savedAttempt.violations.some((v: any) => v.type === 'TAB_BLUR')).toBe(true);
    });
  });

  describe('ISSUE-CONC-001: Proctor Capture State Refresh', () => {
    it('reloads fresh attempt after S3 upload so concurrent responses are not wiped', async () => {
      const assessment = { id: 'asmt-1' };
      const staleAttempt = {
        id: 'att-1',
        assessmentId: 'asmt-1',
        studentId: 'stud-1',
        status: 'in_progress',
        responses: [{ questionId: 'q-old', code: 'old code' }],
        captures: [],
      };
      const freshAttemptWithConcurrentResponses = {
        id: 'att-1',
        assessmentId: 'asmt-1',
        studentId: 'stud-1',
        status: 'in_progress',
        responses: [{ questionId: 'q-concurrent', code: 'student new code saved during S3 upload' }],
        captures: [],
      };

      jest.spyOn(service, 'findAssessmentByIdOrCode').mockResolvedValue(assessment as any);
      jest.spyOn(service as any, 'isStudentTargeted').mockReturnValue(true);

      // First call (before S3 upload) returns stale; second call (after S3 upload) returns fresh with concurrent updates
      attemptRepo.findOne
        .mockResolvedValueOnce(staleAttempt)
        .mockResolvedValueOnce(freshAttemptWithConcurrentResponses);

      await service.recordProctorCapture(
        'asmt-1',
        { type: 'webcam', image: 'data:image/jpeg;base64,AAAA' },
        { id: 'stud-1' },
      );

      expect(attemptRepo.save).toHaveBeenCalled();
      const saved = attemptRepo.save.mock.calls[0][0];
      // Must preserve the fresh response!
      expect(saved.responses).toEqual([
        { questionId: 'q-concurrent', code: 'student new code saved during S3 upload' },
      ]);
      expect(saved.captures.length).toBe(1);
    });
  });
});
