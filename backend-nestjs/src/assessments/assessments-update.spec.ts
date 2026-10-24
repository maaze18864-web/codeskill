jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { BadRequestException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';

function setup() {
  const assessment: any = {
    id: 'assessment-1',
    code: 'ORIGINAL',
    title: 'Original assessment',
    description: 'Keep this description',
    type: 'mcq',
    category: 'exam',
    durationMinutes: 60,
    totalMarks: 5,
    passingMarks: 2,
    negativeMarking: true,
    questions: ['question-1'],
    sections: [],
    targetBatches: ['2026'],
    targetDepartments: ['engineering'],
    targetCourses: ['computer-science'],
    targetSections: ['A'],
    targetStudentIds: ['student-1'],
    targetSemesters: ['1'],
    targetGroups: ['A'],
    startTime: new Date('2026-01-01T09:00:00.000Z'),
    endTime: new Date('2026-01-01T10:00:00.000Z'),
    shuffleQuestions: true,
    shuffleOptions: true,
    showResultImmediately: true,
    allowReview: true,
    allowedAttempts: 1,
    proctoring: {
      enforceFullscreen: true,
      blockCopyPaste: true,
      detectTabSwitch: true,
      maxTabSwitches: 3,
      autoSubmitOnViolation: true,
    },
    instructions: ['Original instruction'],
    status: 'draft',
  };
  const assessmentRepo = {
    findOne: jest.fn().mockResolvedValue(assessment),
    save: jest.fn().mockImplementation(async (value) => value),
  };
  const questionRepo = {
    count: jest.fn().mockResolvedValue(1),
    find: jest.fn().mockResolvedValue([{ id: 'question-1', marks: 5 }]),
  };
  const auditLogRepo = {
    create: jest.fn().mockImplementation((value) => value),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AssessmentsService(
    assessmentRepo as never,
    {} as never,
    questionRepo as never,
    auditLogRepo as never,
  );
  return { service, assessment, assessmentRepo, questionRepo };
}

describe('assessment update persistence', () => {
  it('keeps experiment assessments multi-question when edited', async () => {
    const { service, assessment, assessmentRepo } = setup();
    assessment.labExperimentId = 'experiment';
    assessment.questions = ['question-1', 'question-2'];
    await expect(service.update('assessment-1', {
      sections: [{ title: 'SQL', questions: [{ questionId: 'question-1', marks: 5 }] }],
    }, {})).rejects.toThrow('at least two questions');
    expect(assessmentRepo.save).not.toHaveBeenCalled();
  });

  it('applies partial updates while retaining omitted fields and nested proctoring values', async () => {
    const { service, assessment } = setup();

    await service.update('assessment-1', {
      description: 'Updated description',
      proctoring: { detectTabSwitch: false },
      targetGroups: ['B'],
    }, {});

    expect(assessment.description).toBe('Updated description');
    expect(assessment.proctoring).toEqual({
      enforceFullscreen: true,
      blockCopyPaste: true,
      detectTabSwitch: false,
      maxTabSwitches: 3,
      autoSubmitOnViolation: true,
    });
    expect(assessment.targetGroups).toEqual(['B']);
    expect(assessment.targetBatches).toEqual(['2026']);
    expect(assessment.targetStudentIds).toEqual(['student-1']);
    expect(assessment.instructions).toEqual(['Original instruction']);
  });

  it('persists sections, question IDs, recalculated marks, and settings together', async () => {
    const { service, assessment, questionRepo } = setup();
    questionRepo.count.mockResolvedValue(2);

    await service.update('assessment-1', {
      title: 'Updated assessment',
      category: 'quiz',
      durationMinutes: 75,
      sections: [{
        title: 'Section B',
        description: 'Updated section',
        order: 0,
        timeLimit: 30,
        autoSelection: { topic: 'Algorithms', easyCount: 1, mediumCount: 1, hardCount: 0 },
        questions: [
          { questionId: 'question-1', marks: 4, negativeMarks: 1, order: 0 },
          { questionId: 'question-2', marks: 6, negativeMarks: 0, order: 1 },
        ],
      }],
    } as UpdateAssessmentDto, {});

    expect(assessment.title).toBe('Updated assessment');
    expect(assessment.category).toBe('quiz');
    expect(assessment.durationMinutes).toBe(75);
    expect(assessment.questions).toEqual(['question-1', 'question-2']);
    expect(assessment.totalMarks).toBe(10);
    expect(assessment.sections[0]).toEqual({
      title: 'Section B',
      description: 'Updated section',
      order: 0,
      timeLimit: 30,
      autoSelection: { topic: 'Algorithms', easyCount: 1, mediumCount: 1, hardCount: 0 },
      questions: [
        { questionId: 'question-1', marks: 4, negativeMarks: 1, order: 0 },
        { questionId: 'question-2', marks: 6, negativeMarks: 0, order: 1 },
      ],
    });
    expect(assessment.targetBatches).toEqual(['2026']);
  });

  it('rejects duplicate or unknown questions instead of persisting a broken assessment', async () => {
    const { service, questionRepo } = setup();
    await expect(service.update('assessment-1', {
      sections: [{
        title: 'Repeated',
        questions: [
          { questionId: 'question-1', marks: 1, negativeMarks: 0, order: 0 },
          { questionId: 'question-1', marks: 1, negativeMarks: 0, order: 1 },
        ],
      }],
    } as UpdateAssessmentDto, {})).rejects.toThrow(BadRequestException);

    questionRepo.count.mockResolvedValue(0);
    await expect(service.update('assessment-1', {
      sections: [{
        title: 'Missing question',
        questions: [{ questionId: 'missing', marks: 1, negativeMarks: 0, order: 0 }],
      }],
    } as UpdateAssessmentDto, {})).rejects.toThrow('One or more valid questions could not be found.');
  });

});
