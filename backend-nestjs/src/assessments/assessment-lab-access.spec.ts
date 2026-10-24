import { ForbiddenException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';

describe('Experiment assessment enrollment', () => {
  const student = { id: 'student' };
  const answer = { responses: [] };

  it.each([
    [
      'overview',
      (service: AssessmentsService) =>
        service.getStudentAssessmentOverview('assessment', student),
    ],
    [
      'start',
      (service: AssessmentsService) =>
        service.startStudentAttempt('assessment', student),
    ],
    [
      'retake',
      (service: AssessmentsService) =>
        service.retakeStudentAttempt('assessment', student),
    ],
    [
      'run',
      (service: AssessmentsService) =>
        service.evaluateCode(
          'assessment',
          { questionId: 'question', language: 'sql', code: 'SELECT 1' },
          student,
          true,
        ),
    ],
    [
      'save',
      (service: AssessmentsService) =>
        service.saveProgress('assessment', answer, student),
    ],
    [
      'submit',
      (service: AssessmentsService) =>
        service.submitAttempt('assessment', answer, student),
    ],
    [
      'result',
      (service: AssessmentsService) =>
        service.getStudentResult('assessment', student),
    ],
  ])(
    'denies direct %s access before reading or changing attempts',
    async (_name, action) => {
      const assessments = {
        findOne: jest
          .fn()
          .mockResolvedValue({
            id: 'assessment',
            labExperimentId: 'experiment',
            status: 'published',
          }),
        query: jest.fn().mockResolvedValue([{ allowed: false }]),
      };
      const attempts = {
        findOne: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      };
      const questions = { find: jest.fn(), findOne: jest.fn() };
      const service = new AssessmentsService(
        assessments as never,
        attempts as never,
        questions as never,
        {} as never,
      );

      await expect(action(service)).rejects.toThrow(ForbiddenException);
      expect(assessments.query).toHaveBeenCalledWith(expect.any(String), [
        'experiment',
        'student',
      ]);
      expect(attempts.findOne).not.toHaveBeenCalled();
      expect(attempts.save).not.toHaveBeenCalled();
      expect(attempts.update).not.toHaveBeenCalled();
      expect(questions.find).not.toHaveBeenCalled();
      expect(questions.findOne).not.toHaveBeenCalled();
    },
  );
});
