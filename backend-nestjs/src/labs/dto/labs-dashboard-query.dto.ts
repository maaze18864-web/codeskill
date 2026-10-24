import { IsOptional, IsUUID } from 'class-validator';

export class LabsDashboardQueryDto {
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsUUID()
  labId?: string;
}
