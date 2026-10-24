import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import {
  QuestionsController,
  QuestionBanksController,
} from './questions.controller';
import { QuestionsService } from './questions.service';
import { SubmissionShardingModule } from '../database/sharding/sharding.module';

@Module({
  imports: [DatabaseModule, RedisModule, SubmissionShardingModule],
  controllers: [QuestionsController, QuestionBanksController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
