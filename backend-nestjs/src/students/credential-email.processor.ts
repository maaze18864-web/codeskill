import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailJob } from '../database/entities/email-job.entity';
import { EmailService } from '../emails/email.service';
import { decryptTemporaryPassword } from './utils/credential-crypto.util';

@Processor('credential-email')
export class CredentialEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(CredentialEmailProcessor.name);

  constructor(
    @InjectRepository(EmailJob)
    private readonly emailJobRepo: Repository<EmailJob>,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(
    job: Job<{ emailJobId: string; portalUrl?: string }>,
  ): Promise<any> {
    const { emailJobId, portalUrl } = job.data;
    this.logger.log(`[BullMQ] Processing credential email job: ${emailJobId}`);

    const emailJob = await this.emailJobRepo.findOne({
      where: [{ id: emailJobId }, { mongoId: emailJobId }],
    });
    if (!emailJob) {
      this.logger.error(`[BullMQ] EmailJob record ${emailJobId} not found`);
      return;
    }

    try {
      if (!emailJob.temporaryPassword) {
        throw new Error('Temporary password is empty or already purged');
      }

      const rawPassword = decryptTemporaryPassword(emailJob.temporaryPassword);

      await this.emailService.sendCredentialEmail(
        emailJob.email,
        emailJob.name,
        emailJob.uid,
        rawPassword,
        portalUrl || 'http://localhost:3000/student-login',
      );

      emailJob.status = 'sent';
      emailJob.sentAt = new Date();
      emailJob.error = '';
      emailJob.temporaryPassword = '';
      await this.emailJobRepo.save(emailJob);

      this.logger.log(
        `[BullMQ] Credential email successfully dispatched for ${emailJob.uid} (${emailJob.email})`,
      );
      return { success: true, emailJobId: emailJob.id };
    } catch (error: any) {
      this.logger.error(
        `[BullMQ] Failed to send credential email for ${emailJob.uid}: ${error.message}`,
      );

      emailJob.retryCount = (emailJob.retryCount || 0) + 1;
      emailJob.error = error.message;
      const terminal = job.attemptsMade + 1 >= (job.opts.attempts || 1);
      emailJob.status = terminal ? 'failed' : 'retrying';
      if (terminal) emailJob.temporaryPassword = '';
      await this.emailJobRepo.save(emailJob);

      throw error;
    }
  }
}
