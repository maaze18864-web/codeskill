import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AssessmentAttempt } from '../database/entities/assessment-attempt.entity';
import { Assessment } from '../database/entities/assessment.entity';
import { Question } from '../database/entities/question.entity';
import type { Response } from 'express';
import { renderToStream } from '@react-pdf/renderer';
import { StudentResultReport, StudentResult } from './student-result.pdf';
import * as React from 'react';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(
    @InjectRepository(AssessmentAttempt)
    private readonly attemptRepo: Repository<AssessmentAttempt>,
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
  ) {}

  @Get('assessment-attempt/:attemptId')
  async getStudentResultReport(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    if (!attemptId) {
      throw new BadRequestException('Invalid attempt ID');
    }

    const attempt = await this.attemptRepo.findOne({
      where: [{ id: attemptId }, { mongoId: attemptId }],
    });
    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    // Confidentiality enforcement (AUD-003):
    // Only the student who completed the attempt or an administrator may view the report.
    const studentId = attempt.studentId;
    const isOwner = user && (user.id === studentId || user.mongoId === studentId);
    const isAdmin =
      user &&
      (user.isAdmin === true ||
        ['admin', 'super_admin', 'assessment_admin'].includes(user.role));

    if (!isOwner && !isAdmin) {
      this.logger.warn(
        `User ${user?.id} attempted unauthorized access to attempt ${attemptId} of student ${studentId}`,
      );
      // Return 404 to prevent resource enumeration
      throw new NotFoundException('Attempt not found');
    }

    const assessmentId = attempt.assessmentId;
    const assessment = await this.assessmentRepo.findOne({
      where: [{ id: assessmentId }, { mongoId: assessmentId }],
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    // Populate question details for responses in a single batched query (eliminates N+1)
    const responses = Array.isArray(attempt.responses) ? attempt.responses : [];
    const questionIds = Array.from(
      new Set(
        responses
          .map((r: any) => r.questionId)
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
      ),
    );

    const questionsList =
      questionIds.length > 0
        ? await this.questionRepo.find({
            where: [{ id: In(questionIds) }, { mongoId: In(questionIds) }],
          })
        : [];

    const questionMap = new Map<string, Question>();
    for (const q of questionsList) {
      if (q.id) questionMap.set(q.id, q);
      if (q.mongoId) questionMap.set(q.mongoId, q);
    }

    const questions = responses.map((resp: any) => {
      const q = resp.questionId ? questionMap.get(resp.questionId) || null : null;
      const item: {
        id: string;
        title: string;
        difficulty: string;
        status: 'Passed' | 'Failed' | 'Partial';
        points: number;
      } = {
        id: String(resp.questionId || 'unknown'),
        title: q?.title ? q.title : 'Assessment Question',
        difficulty: q?.difficulty ? q.difficulty : 'Medium',
        status: resp.isCorrect ? 'Passed' : resp.marksAwarded > 0 ? 'Partial' : 'Failed',
        points: Number(resp.marksAwarded || 0),
      };
      return item;
    });

    const resultData: StudentResult = {
      studentName: attempt.studentName || 'Unknown Student',
      studentEmail: attempt.studentEmail || 'No Email',
      examName: assessment.title,
      dateTaken: attempt.startedAt
        ? new Date(attempt.startedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'Unknown Date',
      score: attempt.score || 0,
      maxScore: attempt.maxScore || 100,
      duration: `${Math.floor((attempt.timeSpentSeconds || 0) / 60)}m ${(attempt.timeSpentSeconds || 0) % 60}s`,
      questions,
    };

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="result-${attempt.studentUid || attempt.id}.pdf"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });

    try {
      const stream = await renderToStream(
        React.createElement(StudentResultReport, { result: resultData }) as any,
      );
      stream.pipe(res);
    } catch (error) {
      this.logger.error('Error generating PDF report', error);
      res.status(500).send('Error generating PDF');
    }
  }
}
