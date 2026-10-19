import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ExamSecurityService } from './exam-security.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('exam-security')
@UseGuards(JwtAuthGuard)
export class ExamSecurityController {
  constructor(private readonly examSecurityService: ExamSecurityService) {}

  @Post(':assessmentId/secure-session/init')
  @HttpCode(200)
  async initSession(
    @Param('assessmentId') assessmentId: string,
    @CurrentUser('id') userId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string | undefined>,
    @Req() req?: any,
  ) {
    const fullUrl = req
      ? `${req.protocol || 'https'}://${req.get?.('host') || headers?.host || 'localhost'}${req.originalUrl || req.url || ''}`
      : undefined;
    return this.examSecurityService.initSecureSession(
      assessmentId,
      userId,
      body,
      headers,
      fullUrl,
    );
  }

  @Post('session/:sessionId/heartbeat')
  @HttpCode(200)
  async heartbeat(
    @Param('sessionId') sessionId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.examSecurityService.processHeartbeat(sessionId, userId);
  }

  @Post('session/:sessionId/violation')
  @HttpCode(200)
  async reportViolation(
    @Param('sessionId') sessionId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { eventType: string; metadata?: any },
  ) {
    return this.examSecurityService.reportViolation(
      sessionId,
      userId,
      body.eventType,
      body.metadata || {},
    );
  }
}

