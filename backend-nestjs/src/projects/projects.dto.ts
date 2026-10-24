import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  MinLength,
  Matches,
  ValidateNested,
} from 'class-validator';

export class CreateProjectDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsIn(['frontend', 'backend', 'fullstack']) mode: string;
  @IsOptional() @IsString() @MaxLength(30) frontendStack?: string;
  @IsOptional() @IsString() @MaxLength(30) backendStack?: string;
}
export class ProjectFileDto {
  @IsString() @MinLength(1) @MaxLength(160) path: string;
  @IsString() @MaxLength(200000) content: string;
}
export class SaveProjectDto {
  @IsInt() @Min(1) revision: number;
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
}
export class ProjectRequestDto {
  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
  method: string;
  @IsString() @MinLength(1) @MaxLength(2000) path: string;
  @IsOptional() @IsString() @MaxLength(8000) headers?: string;
  @IsOptional() @IsString() @MaxLength(100000) body?: string;
}
export class ProjectCommandDto {
  @IsString() @MinLength(1) @MaxLength(2000) command: string;
}
export class ProjectTerminalSizeDto {
  @IsInt() @Min(20) @Max(400) cols: number;
  @IsInt() @Min(4) @Max(160) rows: number;
}
export class ProjectTerminalInputDto {
  @IsString() @MinLength(1) @MaxLength(8192) data: string;
}
export class ProjectTerminalReadDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  after = 0;
}
export class ProjectFilesReadDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  since?: string;
}
