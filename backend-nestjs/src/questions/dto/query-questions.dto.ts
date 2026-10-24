import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryQuestionsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Text search within question, topic, or subtopic',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by topic' })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({ description: 'Filter by subtopic' })
  @IsOptional()
  @IsString()
  subtopic?: string;

  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'] })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({
    description: 'Question type (unified or legacy value)',
  })
  @IsOptional()
  @IsString()
  questionType?: string;

  @ApiPropertyOptional({
    enum: ['pending', 'approved', 'rejected', 'archived'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter AI generated questions ("true" or "false")',
  })
  @IsOptional()
  @IsString()
  aiGenerated?: string;

  @ApiPropertyOptional({ description: 'Filter questions by bulk-upload batch UUID' })
  @IsOptional()
  @IsString()
  batchId?: string;
}
