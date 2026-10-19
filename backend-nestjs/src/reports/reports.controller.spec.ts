jest.mock('@nestjs/typeorm', () => ({ InjectRepository: () => () => {} }));
jest.mock('@react-pdf/renderer', () => ({
  renderToStream: jest.fn().mockResolvedValue({
    pipe: jest.fn((res) => res.end('mock-pdf-stream')),
  }),
  StyleSheet: {
    create: (styles: any) => styles,
  },
  Font: {
    register: jest.fn(),
  },
  Document: () => null,
  Page: () => null,
  Text: () => null,
  View: () => null,
  Image: () => null,
  Svg: () => null,
  Path: () => null,
  Circle: () => null,
  Rect: () => null,
  G: () => null,
  Line: () => null,
}));

import { NotFoundException } from '@nestjs/common';
import { ReportsController } from './reports.controller';

describe('ReportsController candidate confidentiality (AUD-003)', () => {
  let controller: ReportsController;
  const mockAttemptRepo = { findOne: jest.fn() };
  const mockAssessmentRepo = { findOne: jest.fn() };
  const mockQuestionRepo = { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]) };

  const ownerStudent = { id: 'student-owner-uuid', email: 'owner@test.com', role: 'student', isAdmin: false };
  const otherStudent = { id: 'other-student-uuid', email: 'other@test.com', role: 'student', isAdmin: false };
  const adminUser = { id: 'admin-uuid', email: 'admin@test.com', role: 'super_admin', isAdmin: true };

  const attemptId = 'attempt-uuid-1';
  const mockAttempt = {
    id: attemptId,
    studentId: ownerStudent.id,
    assessmentId: 'assessment-uuid-1',
    studentName: 'Test Student',
    studentEmail: ownerStudent.email,
    responses: [],
    score: 85,
    maxScore: 100,
    timeSpentSeconds: 1200,
  };

  const mockAssessment = {
    id: 'assessment-uuid-1',
    title: 'Final Examination',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAttemptRepo.findOne.mockResolvedValue(mockAttempt);
    mockAssessmentRepo.findOne.mockResolvedValue(mockAssessment);

    controller = new ReportsController(
      mockAttemptRepo as never,
      mockAssessmentRepo as never,
      mockQuestionRepo as never,
    );
  });

  it('allows the candidate who owns the attempt to download the report', async () => {
    const res = { set: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), end: jest.fn() };
    await controller.getStudentResultReport(attemptId, ownerStudent, res as never);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }),
    );
  });

  it('allows an administrator to download candidate reports', async () => {
    const res = { set: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), end: jest.fn() };
    await controller.getStudentResultReport(attemptId, adminUser, res as never);
    expect(res.set).toHaveBeenCalled();
  });

  it('rejects another student from viewing someone elses attempt report', async () => {
    const res = { set: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), end: jest.fn() };
    await expect(
      controller.getStudentResultReport(attemptId, otherStudent, res as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 when attempt is not found', async () => {
    mockAttemptRepo.findOne.mockResolvedValue(null);
    const res = { set: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), end: jest.fn() };
    await expect(
      controller.getStudentResultReport('non-existent', ownerStudent, res as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('batches question lookups in a single query instead of N+1 individual queries (ISSUE-DAT-003)', async () => {
    const attemptWithQuestions = {
      ...mockAttempt,
      responses: [
        { questionId: 'q-1', isCorrect: true, marksAwarded: 10 },
        { questionId: 'q-2', isCorrect: false, marksAwarded: 0 },
      ],
    };
    mockAttemptRepo.findOne.mockResolvedValue(attemptWithQuestions);
    mockQuestionRepo.find.mockResolvedValue([
      { id: 'q-1', title: 'Question 1', difficulty: 'Easy' },
      { id: 'q-2', title: 'Question 2', difficulty: 'Hard' },
    ]);
    const res = { set: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), end: jest.fn() };
    await controller.getStudentResultReport(attemptId, ownerStudent, res as never);

    expect(mockQuestionRepo.find).toHaveBeenCalledTimes(1);
    expect(mockQuestionRepo.findOne).not.toHaveBeenCalled();
  });
});
