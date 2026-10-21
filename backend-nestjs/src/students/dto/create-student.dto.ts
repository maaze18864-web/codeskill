import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeSectionIdentifier } from '../../common/constants/sections.constant';

export class StudentProfileDto {
  @ApiPropertyOptional({ example: 'Chandigarh University' })
  @IsOptional()
  @IsString()
  university?: string;

  @ApiPropertyOptional({ example: 'Computer Science and Engineering' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'B.Tech CSE' })
  @IsOptional()
  @IsString()
  course?: string;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  semester?: number;

  @ApiPropertyOptional({ example: 'A1' })
  @IsOptional()
  @Transform(({ value }) => (value ? normalizeSectionIdentifier(value) : value))
  @Matches(/^[A-Za-z0-9_\-]{1,16}$/, {
    message: 'Section must be a valid section identifier (e.g. A1, B4)',
  })
  @IsString()
  section?: string;

  @ApiPropertyOptional({ example: 'Group-1' })
  @IsOptional()
  @IsString()
  group?: string;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  year?: number;

  @ApiPropertyOptional({ example: '2022-2026' })
  @IsOptional()
  @IsString()
  batch?: string;
}

export class CreateStudentDto {
  @ApiProperty({ example: 'CU202600123' })
  @IsNotEmpty()
  @IsString()
  uid: string;

  @ApiProperty({ example: 'Rahul Sharma' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'rahul.cu2026@gmail.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'InitialTempPass123!' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  forcePasswordChange?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: StudentProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StudentProfileDto)
  studentProfile?: StudentProfileDto;
}
