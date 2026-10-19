import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import type { BugPriority } from '../../database/entities/bug-report.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateBugDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  @Matches(/\S/, { message: 'Creator name cannot be blank' })
  creatorName: string;

  @Transform(trim)
  @IsString()
  @Length(3, 180)
  @Matches(/\S/, { message: 'Title cannot be blank' })
  title: string;

  @Transform(trim)
  @IsString()
  @Length(8, 10000)
  @Matches(/\S/, { message: 'Description cannot be blank' })
  description: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority?: BugPriority;
}
