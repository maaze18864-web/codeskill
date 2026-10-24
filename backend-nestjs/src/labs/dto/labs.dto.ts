import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  MinLength,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateProjectDto, ProjectFileDto } from '../../projects/projects.dto';
import { IsObject } from 'class-validator';
import type { SqlProblem } from '../../sql/sql-problem';

export class LabMarksDto {
  @IsNumber()
  @Min(0)
  @Max(10000)
  maxScore: number;
}
export class SaveLabSqlProblemDto extends LabMarksDto {
  @IsObject()
  problem: SqlProblem;
}
export class ExecuteLabSqlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  code: string;
  @IsIn(['run', 'submit'])
  mode: 'run' | 'submit';
}

export class SaveLabProjectProblemDto extends CreateProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  instructions: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProjectFileDto)
  files: ProjectFileDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  directories?: string[];
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  maxScore?: number;
  @IsOptional()
  @IsIn(['Easy', 'Medium', 'Hard'])
  difficulty?: string;
}

export class CreateLabSectionDto {
  @ApiProperty({ example: '24-BDVT-701' })
  @IsString()
  @MaxLength(100)
  code: string;

  @ApiProperty({ example: 'Big Data Visualization Techniques' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  semester?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  academicYear?: string;

  @ApiPropertyOptional({ example: ['A', 'B'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subgroupCodes?: string[];
}

export class UpdateLabSectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  semester?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  academicYear?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateLabSubgroupDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiPropertyOptional({ example: 'Subgroup A' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}

export class EnrollStudentsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  studentIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subgroupId?: string;
}

export class CreateLabDto {
  @ApiProperty({ example: 'C Programming Lab' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'C' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ enum: ['draft', 'published', 'archived'] })
  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived';
}

export class UpdateLabDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ enum: ['draft', 'published', 'archived'] })
  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived';
}

export class AssignLabToSectionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  sectionIds: string[];
}

export class AssignTeacherDto {
  @ApiProperty()
  @IsUUID()
  sectionId: string;

  @ApiProperty()
  @IsUUID()
  teacherId: string;

  @ApiPropertyOptional({ enum: ['owner', 'instructor', 'ta'] })
  @IsOptional()
  @IsIn(['owner', 'instructor', 'ta'])
  role?: 'owner' | 'instructor' | 'ta';
}

export class CreateLabExperimentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateLabExperimentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class AttachLabProblemDto {
  @ApiProperty()
  @IsUUID()
  problemMetadataId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class RecordLabProgressDto {
  @ApiProperty()
  @IsUUID()
  experimentProblemId: string;

  @ApiPropertyOptional({
    enum: ['not_started', 'in_progress', 'solved', 'failed'],
  })
  @IsOptional()
  @IsIn(['not_started', 'in_progress', 'solved', 'failed'])
  status?: 'not_started' | 'in_progress' | 'solved' | 'failed';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  submissionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  timeSpentSeconds?: number;
}
