import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { LabsService } from './labs.service';
import { ProjectsService } from '../projects/projects.service';
import { User } from '../database/entities/user.entity';
import { fullstackExercise, dbmsExercise } from '../seeds/lab-project-examples';
import { validateLabProjectTemplate } from '../projects/lab-project-template';

const student = { id: 'student', role: 'student' } as User;
const template = fullstackExercise('Task board');
function setup() {
  const empty = {} as never;
  const enrollments = {
    find: jest.fn().mockResolvedValue([{ lab_section_id: 'section' }]),
  };
  const assignments = { findOne: jest.fn().mockResolvedValue({}) };
  const labs = {
    findOne: jest.fn().mockResolvedValue({ id: 'lab', status: 'published' }),
  };
  const link = {
    id: 'exercise',
    kind: 'project',
    projectTemplate: template,
    sortOrder: 0,
    maxScore: 10,
    lab_experiment_id: 'experiment',
    experiment: { lab_id: 'lab' },
  };
  const experiments = {
    findOne: jest.fn().mockResolvedValue({
      id: 'experiment',
      lab_id: 'lab',
      isPublished: true,
      lab: { title: 'Fullstack' },
      problems: [link],
    }),
  };
  const links = { findOne: jest.fn().mockResolvedValue(link) };
  const insert = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };
  const progress = {
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn().mockReturnValue(insert),
  };
  const projects = {
    openLabProject: jest
      .fn()
      .mockResolvedValue({ project: { id: 'private-project' } }),
  };
  const service = new LabsService(
    empty,
    empty,
    enrollments as never,
    labs as never,
    assignments as never,
    empty,
    experiments as never,
    links as never,
    progress as never,
    empty,
    empty,
    projects as never,
    { find: jest.fn().mockResolvedValue([]) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return {
    service,
    enrollments,
    assignments,
    labs,
    experiments,
    links,
    insert,
    projects,
  };
}
describe('Lab project exercises', () => {
  it('blocks an unenrolled student before opening any project', async () => {
    const { service, enrollments, projects } = setup();
    enrollments.find.mockResolvedValue([]);
    await expect(
      service.openProjectProblem(student, 'lab', 'experiment', 'exercise'),
    ).rejects.toThrow(ForbiddenException);
    expect(projects.openLabProject).not.toHaveBeenCalled();
  });
  it('blocks draft labs and unpublished experiments for students', async () => {
    const { service, labs, experiments, projects } = setup();
    labs.findOne.mockResolvedValue({ id: 'lab', status: 'draft' });
    await expect(
      service.openProjectProblem(student, 'lab', 'experiment', 'exercise'),
    ).rejects.toThrow(NotFoundException);
    labs.findOne.mockResolvedValue({ id: 'lab', status: 'published' });
    experiments.findOne.mockResolvedValue({
      id: 'experiment',
      isPublished: false,
    });
    await expect(
      service.openProjectProblem(student, 'lab', 'experiment', 'exercise'),
    ).rejects.toThrow(NotFoundException);
    expect(projects.openLabProject).not.toHaveBeenCalled();
  });
  it('returns only project guidance in the experiment and opens a caller-owned draft', async () => {
    const { service, projects } = setup();
    const workspace = await service.getExperimentWorkspace(
      student,
      'lab',
      'experiment',
    );
    expect(workspace.problems[0]).toMatchObject({
      kind: 'project',
      title: 'Task board',
      project: { fileCount: template.files.length },
    });
    expect(JSON.stringify(workspace)).not.toContain('app.listen');
    expect(
      await service.openProjectProblem(
        student,
        'lab',
        'experiment',
        'exercise',
      ),
    ).toEqual({ project: { id: 'private-project' } });
    expect(projects.openLabProject).toHaveBeenCalledWith(
      'student',
      expect.objectContaining({ labId: 'lab', problemId: 'exercise' }),
      template,
    );
    await expect(
      service.openProjectProblem(
        student,
        'lab',
        'experiment',
        'other-exercise',
      ),
    ).rejects.toThrow(NotFoundException);
  });
  it('rejects fabricated coding verdicts for a project exercise', async () => {
    const { service } = setup();
    await expect(
      service.recordProgress(student, 'lab', {
        experimentProblemId: 'exercise',
        status: 'solved',
        score: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });
  it('resumes edited work without writing the newer instructor starter over it', async () => {
    const edited = {
      id: 'private',
      files: [{ path: 'README.md', content: 'Student work' }],
    };
    const repository = {
      findOne: jest.fn().mockResolvedValue(edited),
      createQueryBuilder: jest.fn(),
    };
    const service = new ProjectsService(repository as never, {} as never);
    const result = await service.openLabProject(
      'student',
      {
        labId: 'lab',
        experimentId: 'experiment',
        problemId: 'exercise',
        title: template.name,
        instructions: template.instructions,
      },
      template,
    );
    expect(result.project).toBe(edited);
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { ownerId: 'student', labProblemId: 'exercise' },
    });
  });
  it('validates starter paths, supported stacks, and separate SQL/fullstack examples', () => {
    expect(() =>
      validateLabProjectTemplate({
        ...template,
        files: [{ path: '../secret', content: '' }],
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateLabProjectTemplate({ ...template, backendStack: 'unknown' }),
    ).toThrow(BadRequestException);
    for (const example of [
      template,
      fullstackExercise('Feedback', true),
      dbmsExercise(),
      dbmsExercise(true),
    ]) {
      expect(validateLabProjectTemplate(example).files.length).toBeGreaterThan(
        1,
      );
      expect(example.files.some((file) => file.content.includes('TODO'))).toBe(
        true,
      );
    }
  });
});
