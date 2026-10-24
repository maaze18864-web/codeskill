import type { ProjectFile } from '../database/entities/project-workspace.entity';
import type { CreateProjectDto } from './projects.dto';
import {
  createProjectTemplate,
  validateProjectDirectories,
  validateProjectFiles,
} from './project-catalog';
import { BadRequestException } from '@nestjs/common';

export interface LabProjectTemplate extends CreateProjectDto {
  instructions: string;
  files: ProjectFile[];
  directories?: string[];
}
export interface LabProjectAssignment {
  labId: string;
  experimentId: string;
  problemId: string;
  title: string;
  instructions: string;
}
export function validateLabProjectTemplate(
  input: LabProjectTemplate,
): LabProjectTemplate {
  if (!input.instructions?.trim() || input.instructions.length > 12000)
    throw new BadRequestException(
      'Provide project instructions (up to 12,000 characters).',
    );
  const template = createProjectTemplate(input);
  const files = validateProjectFiles(input.files);
  return {
    name: template.name,
    mode: template.mode,
    frontendStack: template.frontendStack || undefined,
    backendStack: template.backendStack || undefined,
    instructions: input.instructions.trim(),
    files,
    directories: validateProjectDirectories(input.directories || [], files),
  };
}
