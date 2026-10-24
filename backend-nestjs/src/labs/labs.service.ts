import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LabSection } from '../database/entities/lab-section.entity';
import { LabSubgroup } from '../database/entities/lab-subgroup.entity';
import { LabSectionEnrollment } from '../database/entities/lab-section-enrollment.entity';
import { Lab } from '../database/entities/lab.entity';
import { LabSectionAssignment } from '../database/entities/lab-section-assignment.entity';
import { LabTeacherAssignment } from '../database/entities/lab-teacher-assignment.entity';
import { LabExperiment } from '../database/entities/lab-experiment.entity';
import { LabExperimentProblem } from '../database/entities/lab-experiment-problem.entity';
import { LabProblemProgress } from '../database/entities/lab-problem-progress.entity';
import { ProblemMetadata } from '../database/entities/problem-metadata.entity';
import { User } from '../database/entities/user.entity';
import { ProjectsService } from '../projects/projects.service';
import { validateLabProjectTemplate } from '../projects/lab-project-template';
import { SqlEngineService } from '../sql/sql-engine.service';
import { validateSqlProblem, publicSqlProblem } from '../sql/sql-problem';
import { Assessment } from '../database/entities/assessment.entity';
import { AssessmentAttempt } from '../database/entities/assessment-attempt.entity';
import { Question } from '../database/entities/question.entity';
import { SubmissionStore } from '../database/sharding/submission-store';
import { SaveLabSqlProblemDto } from './dto/labs.dto';
import {
  LABS_DASHBOARD_SQL,
  DashboardSnapshot,
  summarizeLabsDashboard,
} from './labs-dashboard';
import {
  ADMIN_OR_TEACHER_ROLES,
  ADMIN_ROLES,
} from '../common/guards/admin.guard';
import {
  AssignLabToSectionsDto,
  AssignTeacherDto,
  AttachLabProblemDto,
  CreateLabDto,
  CreateLabExperimentDto,
  CreateLabSectionDto,
  CreateLabSubgroupDto,
  EnrollStudentsDto,
  RecordLabProgressDto,
  UpdateLabDto,
  UpdateLabExperimentDto,
  UpdateLabSectionDto,
  SaveLabProjectProblemDto,
} from './dto/labs.dto';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

function isAdminUser(user: { isAdmin?: boolean; role?: string }): boolean {
  return Boolean(
    user?.isAdmin || (user?.role && ADMIN_ROLES.includes(user.role)),
  );
}

function isTeacherUser(user: { isAdmin?: boolean; role?: string }): boolean {
  return Boolean(
    user?.isAdmin || (user?.role && ADMIN_OR_TEACHER_ROLES.includes(user.role)),
  );
}

@Injectable()
export class LabsService {
  constructor(
    @InjectRepository(LabSection)
    private readonly sectionsRepo: Repository<LabSection>,
    @InjectRepository(LabSubgroup)
    private readonly subgroupsRepo: Repository<LabSubgroup>,
    @InjectRepository(LabSectionEnrollment)
    private readonly enrollmentsRepo: Repository<LabSectionEnrollment>,
    @InjectRepository(Lab)
    private readonly labsRepo: Repository<Lab>,
    @InjectRepository(LabSectionAssignment)
    private readonly sectionAssignmentsRepo: Repository<LabSectionAssignment>,
    @InjectRepository(LabTeacherAssignment)
    private readonly teacherAssignmentsRepo: Repository<LabTeacherAssignment>,
    @InjectRepository(LabExperiment)
    private readonly experimentsRepo: Repository<LabExperiment>,
    @InjectRepository(LabExperimentProblem)
    private readonly experimentProblemsRepo: Repository<LabExperimentProblem>,
    @InjectRepository(LabProblemProgress)
    private readonly progressRepo: Repository<LabProblemProgress>,
    @InjectRepository(ProblemMetadata)
    private readonly problemsRepo: Repository<ProblemMetadata>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly projectsService: ProjectsService,
    @InjectRepository(Assessment)
    private readonly assessmentsRepo: Repository<Assessment>,
    @InjectRepository(AssessmentAttempt)
    private readonly attemptsRepo: Repository<AssessmentAttempt>,
    @InjectRepository(Question)
    private readonly questionsRepo: Repository<Question>,
    private readonly sqlEngine: SqlEngineService,
    private readonly submissions: SubmissionStore,
  ) {}

  // ─── Admin dashboard ───────────────────────────────────────────────

  async getAdminDashboard(sectionId?: string, labId?: string) {
    const [sections, enrollments, labs, experiments, teachers, analytics] =
      await Promise.all([
        this.sectionsRepo.count(),
        this.enrollmentsRepo.count({ where: { status: 'active' } }),
        this.labsRepo.count(),
        this.experimentsRepo.count(),
        this.teacherAssignmentsRepo.count(),
        this.getDashboardSnapshot(null, sectionId, labId),
      ]);
    return {
      sections,
      enrollments,
      labs,
      experiments,
      teacherAssignments: teachers,
      solvedProblems: analytics.summary.solved,
      completionRate: analytics.summary.completionPercent,
      analytics,
    };
  }

  async getTeacherDashboard(user: User, sectionId?: string, labId?: string) {
    if (!isTeacherUser(user))
      throw new ForbiddenException('Teaching access required');
    return this.getDashboardSnapshot(
      isAdminUser(user) ? null : user.id,
      sectionId,
      labId,
    );
  }

  private async getDashboardSnapshot(
    teacherId: string | null,
    sectionId?: string,
    labId?: string,
  ) {
    const [snapshot]: DashboardSnapshot[] = await this.sectionsRepo.query(
      LABS_DASHBOARD_SQL,
      [teacherId, sectionId || null, labId || null],
    );
    return summarizeLabsDashboard(snapshot);
  }

  // ─── Sections ──────────────────────────────────────────────────────

  async createSection(dto: CreateLabSectionDto, admin: User) {
    const existing = await this.sectionsRepo.findOne({
      where: { code: dto.code.trim() },
    });
    if (existing) {
      throw new BadRequestException(`Section code ${dto.code} already exists`);
    }

    const section = this.sectionsRepo.create({
      code: dto.code.trim(),
      name: dto.name.trim(),
      department: dto.department,
      semester: dto.semester,
      academicYear: dto.academicYear,
      created_by_id: admin.id,
      isActive: true,
    });
    const saved = await this.sectionsRepo.save(section);

    const codes = dto.subgroupCodes?.length ? dto.subgroupCodes : ['A'];
    const subgroups = codes.map((code) =>
      this.subgroupsRepo.create({
        lab_section_id: saved.id,
        code: code.trim().toUpperCase(),
        name: `Subgroup ${code.trim().toUpperCase()}`,
      }),
    );
    await this.subgroupsRepo.save(subgroups);

    return this.getSectionById(saved.id);
  }

  async listSections() {
    const sections = await this.sectionsRepo.find({
      relations: { subgroups: true },
      order: { code: 'ASC' },
    });
    const counts = await this.enrollmentsRepo
      .createQueryBuilder('enrollment')
      .select('enrollment.lab_section_id', 'sectionId')
      .addSelect('COUNT(*)', 'count')
      .where('enrollment.status = :status', { status: 'active' })
      .groupBy('enrollment.lab_section_id')
      .getRawMany<{ sectionId: string; count: string }>();
    const totals = new Map(
      counts.map((row) => [row.sectionId, Number(row.count)]),
    );
    return sections.map((section) => ({
      ...section,
      enrollmentCount: totals.get(section.id) || 0,
    }));
  }

  async getSectionById(id: string) {
    const section = await this.sectionsRepo.findOne({
      where: { id },
      relations: { subgroups: true },
    });
    if (!section) throw new NotFoundException('Section not found');

    const enrollmentCount = await this.enrollmentsRepo.count({
      where: { lab_section_id: id, status: 'active' },
    });
    const labAssignments = await this.sectionAssignmentsRepo.find({
      where: { lab_section_id: id },
      relations: { lab: true },
    });
    const teacherAssignments = await this.teacherAssignmentsRepo.find({
      where: { lab_section_id: id },
      relations: { teacher: true, lab: true },
    });

    return {
      ...section,
      enrollmentCount,
      labs: labAssignments.map((a) => a.lab),
      teachers: teacherAssignments.map((a) => ({
        id: a.id,
        role: a.role,
        lab: a.lab,
        teacher: a.teacher
          ? {
              id: a.teacher.id,
              name: a.teacher.name,
              email: a.teacher.email,
              role: a.teacher.role,
            }
          : null,
      })),
    };
  }

  async updateSection(id: string, dto: UpdateLabSectionDto) {
    const section = await this.sectionsRepo.findOne({ where: { id } });
    if (!section) throw new NotFoundException('Section not found');
    if (dto.code && dto.code.trim() !== section.code) {
      const clash = await this.sectionsRepo.findOne({
        where: { code: dto.code.trim() },
      });
      if (clash) throw new BadRequestException('Section code already exists');
      section.code = dto.code.trim();
    }
    if (dto.name !== undefined) section.name = dto.name.trim();
    if (dto.department !== undefined) section.department = dto.department;
    if (dto.semester !== undefined) section.semester = dto.semester;
    if (dto.academicYear !== undefined) section.academicYear = dto.academicYear;
    if (dto.isActive !== undefined) section.isActive = dto.isActive;
    await this.sectionsRepo.save(section);
    return this.getSectionById(id);
  }

  async deleteSection(id: string) {
    const section = await this.sectionsRepo.findOne({ where: { id } });
    if (!section) throw new NotFoundException('Section not found');
    await this.sectionsRepo.remove(section);
    return { success: true };
  }

  async addSubgroup(sectionId: string, dto: CreateLabSubgroupDto) {
    await this.getSectionById(sectionId);
    const code = dto.code.trim().toUpperCase();
    const existing = await this.subgroupsRepo.findOne({
      where: { lab_section_id: sectionId, code },
    });
    if (existing)
      throw new BadRequestException(`Subgroup ${code} already exists`);
    const subgroup = this.subgroupsRepo.create({
      lab_section_id: sectionId,
      code,
      name: dto.name?.trim() || `Subgroup ${code}`,
    });
    return this.subgroupsRepo.save(subgroup);
  }

  async deleteSubgroup(sectionId: string, subgroupId: string) {
    const subgroup = await this.subgroupsRepo.findOne({
      where: { id: subgroupId, lab_section_id: sectionId },
    });
    if (!subgroup) throw new NotFoundException('Subgroup not found');
    await this.subgroupsRepo.remove(subgroup);
    return { success: true };
  }

  async enrollStudents(sectionId: string, dto: EnrollStudentsDto) {
    await this.getSectionById(sectionId);
    if (dto.subgroupId) {
      const subgroup = await this.subgroupsRepo.findOne({
        where: { id: dto.subgroupId, lab_section_id: sectionId },
      });
      if (!subgroup)
        throw new BadRequestException('Subgroup not in this section');
    }

    const students = await this.usersRepo.find({
      where: { id: In(dto.studentIds) },
    });
    if (students.length === 0) {
      throw new BadRequestException('No matching students found');
    }

    const results: LabSectionEnrollment[] = [];
    for (const student of students) {
      let enrollment = await this.enrollmentsRepo.findOne({
        where: { lab_section_id: sectionId, student_id: student.id },
      });
      if (enrollment) {
        enrollment.lab_subgroup_id = dto.subgroupId;
        enrollment.status = 'active';
      } else {
        enrollment = this.enrollmentsRepo.create({
          lab_section_id: sectionId,
          student_id: student.id,
          lab_subgroup_id: dto.subgroupId,
          status: 'active',
        });
      }
      results.push(await this.enrollmentsRepo.save(enrollment));
    }
    return { enrolled: results.length, enrollments: results };
  }

  async listEnrollments(sectionId: string) {
    await this.getSectionById(sectionId);
    return this.enrollmentsRepo.find({
      where: { lab_section_id: sectionId },
      relations: { student: true, subgroup: true },
      order: { enrolledAt: 'DESC' },
    });
  }

  async removeEnrollment(sectionId: string, enrollmentId: string) {
    const enrollment = await this.enrollmentsRepo.findOne({
      where: { id: enrollmentId, lab_section_id: sectionId },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    await this.enrollmentsRepo.remove(enrollment);
    return { success: true };
  }

  // ─── Labs catalog ──────────────────────────────────────────────────

  async createLab(dto: CreateLabDto, admin: User) {
    const baseSlug = slugify(dto.slug || dto.title);
    let slug = baseSlug || `lab-${Date.now()}`;
    let n = 1;
    while (await this.labsRepo.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${n++}`;
    }
    const lab = this.labsRepo.create({
      title: dto.title.trim(),
      slug,
      description: dto.description,
      subject: dto.subject,
      status: dto.status || 'draft',
      created_by_id: admin.id,
    });
    return this.labsRepo.save(lab);
  }

  async listLabs() {
    const labs = await this.labsRepo.find({ order: { title: 'ASC' } });
    const counts = await this.experimentsRepo
      .createQueryBuilder('e')
      .select('e.lab_id', 'labId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('e.lab_id')
      .getRawMany<{ labId: string; count: string }>();
    const countMap = new Map(counts.map((c) => [c.labId, Number(c.count)]));
    return labs.map((lab) => ({
      ...lab,
      experimentCount: countMap.get(lab.id) || 0,
    }));
  }

  async getLabById(id: string) {
    const lab = await this.labsRepo.findOne({ where: { id } });
    if (!lab) throw new NotFoundException('Lab not found');

    const experiments = await this.experimentsRepo.find({
      where: { lab_id: id },
      relations: { problems: { problemMetadata: true } },
      order: { sortOrder: 'ASC' },
    });
    const sectionAssignments = await this.sectionAssignmentsRepo.find({
      where: { lab_id: id },
      relations: { section: { subgroups: true } },
    });
    const teacherAssignments = await this.teacherAssignmentsRepo.find({
      where: { lab_id: id },
      relations: { teacher: true, section: true },
    });

    return {
      ...lab,
      experiments: await Promise.all(
        experiments.map(async (experiment) => ({
          ...experiment,
          assessments: await this.experimentAssessments(experiment.id),
        })),
      ),
      sections: sectionAssignments.map((a) => a.section),
      teachers: teacherAssignments.map((a) => ({
        id: a.id,
        role: a.role,
        section: a.section,
        teacher: a.teacher
          ? {
              id: a.teacher.id,
              name: a.teacher.name,
              email: a.teacher.email,
              role: a.teacher.role,
            }
          : null,
      })),
    };
  }

  async updateLab(id: string, dto: UpdateLabDto) {
    const lab = await this.labsRepo.findOne({ where: { id } });
    if (!lab) throw new NotFoundException('Lab not found');
    if (dto.title !== undefined) lab.title = dto.title.trim();
    if (dto.description !== undefined) lab.description = dto.description;
    if (dto.subject !== undefined) lab.subject = dto.subject;
    if (dto.status !== undefined) lab.status = dto.status;
    if (dto.slug !== undefined) {
      const slug = slugify(dto.slug);
      const clash = await this.labsRepo.findOne({ where: { slug } });
      if (clash && clash.id !== id) {
        throw new BadRequestException('Slug already in use');
      }
      lab.slug = slug;
    }
    await this.labsRepo.save(lab);
    return this.getLabById(id);
  }

  async deleteLab(id: string) {
    const lab = await this.labsRepo.findOne({ where: { id } });
    if (!lab) throw new NotFoundException('Lab not found');
    await this.labsRepo.remove(lab);
    return { success: true };
  }

  async assignLabToSections(labId: string, dto: AssignLabToSectionsDto) {
    await this.getLabById(labId);
    const sections = await this.sectionsRepo.find({
      where: { id: In(dto.sectionIds) },
    });
    if (sections.length !== dto.sectionIds.length) {
      throw new BadRequestException('One or more sections not found');
    }
    const created: LabSectionAssignment[] = [];
    for (const section of sections) {
      let assignment = await this.sectionAssignmentsRepo.findOne({
        where: { lab_id: labId, lab_section_id: section.id },
      });
      if (!assignment) {
        assignment = this.sectionAssignmentsRepo.create({
          lab_id: labId,
          lab_section_id: section.id,
        });
        created.push(await this.sectionAssignmentsRepo.save(assignment));
      }
    }
    return { assigned: created.length, lab: await this.getLabById(labId) };
  }

  async unassignLabFromSection(labId: string, sectionId: string) {
    const assignment = await this.sectionAssignmentsRepo.findOne({
      where: { lab_id: labId, lab_section_id: sectionId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.sectionAssignmentsRepo.remove(assignment);
    await this.teacherAssignmentsRepo.delete({
      lab_id: labId,
      lab_section_id: sectionId,
    });
    return { success: true };
  }

  async assignTeacher(labId: string, dto: AssignTeacherDto) {
    await this.getLabById(labId);
    const sectionLink = await this.sectionAssignmentsRepo.findOne({
      where: { lab_id: labId, lab_section_id: dto.sectionId },
    });
    if (!sectionLink) {
      throw new BadRequestException('Assign the lab to the section first');
    }
    const teacher = await this.usersRepo.findOne({
      where: { id: dto.teacherId },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    if (!isTeacherUser(teacher) && teacher.role !== 'teacher') {
      // Allow assignment if role is teacher-like or admin; otherwise warn via role check
      const allowed =
        isAdminUser(teacher) ||
        ['teacher', 'faculty', 'instructor'].includes(teacher.role);
      if (!allowed) {
        throw new BadRequestException(
          'User must have teacher, faculty, or instructor role',
        );
      }
    }

    let assignment = await this.teacherAssignmentsRepo.findOne({
      where: {
        lab_id: labId,
        lab_section_id: dto.sectionId,
        teacher_id: dto.teacherId,
      },
    });
    if (assignment) {
      assignment.role = dto.role || assignment.role;
    } else {
      assignment = this.teacherAssignmentsRepo.create({
        lab_id: labId,
        lab_section_id: dto.sectionId,
        teacher_id: dto.teacherId,
        role: dto.role || 'instructor',
      });
    }
    await this.teacherAssignmentsRepo.save(assignment);
    return this.getLabById(labId);
  }

  async removeTeacherAssignment(labId: string, assignmentId: string) {
    const assignment = await this.teacherAssignmentsRepo.findOne({
      where: { id: assignmentId, lab_id: labId },
    });
    if (!assignment)
      throw new NotFoundException('Teacher assignment not found');
    await this.teacherAssignmentsRepo.remove(assignment);
    return { success: true };
  }

  async listTeachers() {
    return this.usersRepo.find({
      where: [{ role: 'teacher' }, { role: 'faculty' }, { role: 'instructor' }],
      select: { id: true, name: true, email: true, role: true, isActive: true },
      order: { name: 'ASC' },
    });
  }

  // ─── Experiments & problems ────────────────────────────────────────

  async createExperiment(labId: string, dto: CreateLabExperimentDto) {
    await this.getLabById(labId);
    const maxOrder = await this.experimentsRepo
      .createQueryBuilder('e')
      .select('MAX(e.sortOrder)', 'max')
      .where('e.lab_id = :labId', { labId })
      .getRawOne<{ max: number | null }>();
    const experiment = this.experimentsRepo.create({
      lab_id: labId,
      title: dto.title.trim(),
      description: dto.description,
      sortOrder: dto.sortOrder ?? (maxOrder?.max ?? -1) + 1,
      isPublished: dto.isPublished ?? true,
    });
    return this.experimentsRepo.save(experiment);
  }

  async updateExperiment(
    labId: string,
    experimentId: string,
    dto: UpdateLabExperimentDto,
  ) {
    const experiment = await this.experimentsRepo.findOne({
      where: { id: experimentId, lab_id: labId },
    });
    if (!experiment) throw new NotFoundException('Experiment not found');
    if (dto.title !== undefined) experiment.title = dto.title.trim();
    if (dto.description !== undefined) experiment.description = dto.description;
    if (dto.sortOrder !== undefined) experiment.sortOrder = dto.sortOrder;
    if (dto.isPublished !== undefined) experiment.isPublished = dto.isPublished;
    return this.experimentsRepo.save(experiment);
  }

  async deleteExperiment(labId: string, experimentId: string) {
    const experiment = await this.experimentsRepo.findOne({
      where: { id: experimentId, lab_id: labId },
    });
    if (!experiment) throw new NotFoundException('Experiment not found');
    await this.experimentsRepo.remove(experiment);
    return { success: true };
  }

  async attachProblem(
    labId: string,
    experimentId: string,
    dto: AttachLabProblemDto,
  ) {
    const experiment = await this.experimentsRepo.findOne({
      where: { id: experimentId, lab_id: labId },
    });
    if (!experiment) throw new NotFoundException('Experiment not found');

    const problem = await this.problemsRepo.findOne({
      where: { id: dto.problemMetadataId },
    });
    if (!problem) throw new NotFoundException('Practice problem not found');

    const existing = await this.experimentProblemsRepo.findOne({
      where: {
        lab_experiment_id: experimentId,
        problem_metadata_id: dto.problemMetadataId,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Problem already attached to this experiment',
      );
    }

    const maxOrder = await this.experimentProblemsRepo
      .createQueryBuilder('p')
      .select('MAX(p.sortOrder)', 'max')
      .where('p.lab_experiment_id = :experimentId', { experimentId })
      .getRawOne<{ max: number | null }>();

    const link = this.experimentProblemsRepo.create({
      lab_experiment_id: experimentId,
      problem_metadata_id: dto.problemMetadataId,
      sortOrder: dto.sortOrder ?? (maxOrder?.max ?? -1) + 1,
      maxScore: dto.maxScore ?? 5,
      difficulty: dto.difficulty || problem.difficulty,
      isRequired: dto.isRequired ?? true,
    });
    return this.experimentProblemsRepo.save(link);
  }

  async detachProblem(
    labId: string,
    experimentId: string,
    problemLinkId: string,
  ) {
    const experiment = await this.experimentsRepo.findOne({
      where: { id: experimentId, lab_id: labId },
    });
    if (!experiment) throw new NotFoundException('Experiment not found');
    const link = await this.experimentProblemsRepo.findOne({
      where: { id: problemLinkId, lab_experiment_id: experimentId },
    });
    if (!link) throw new NotFoundException('Experiment problem not found');
    await this.experimentProblemsRepo.remove(link);
    return { success: true };
  }

  async saveProjectProblem(
    labId: string,
    experimentId: string,
    dto: SaveLabProjectProblemDto,
    problemId?: string,
  ) {
    const experiment = await this.experimentsRepo.findOne({
      where: { id: experimentId, lab_id: labId },
    });
    if (!experiment) throw new NotFoundException('Experiment not found');
    const projectTemplate = validateLabProjectTemplate(dto);
    let link: LabExperimentProblem | null;
    if (problemId) {
      link = await this.experimentProblemsRepo.findOne({
        where: {
          id: problemId,
          lab_experiment_id: experimentId,
          kind: 'project',
        },
      });
      if (!link) throw new NotFoundException('Project exercise not found');
    } else {
      const count = await this.experimentProblemsRepo.countBy({
        lab_experiment_id: experimentId,
      });
      link = this.experimentProblemsRepo.create({
        lab_experiment_id: experimentId,
        problem_metadata_id: null,
        kind: 'project',
        sortOrder: count,
        isRequired: true,
      });
    }
    link.projectTemplate = projectTemplate;
    link.maxScore = dto.maxScore ?? 10;
    link.difficulty = dto.difficulty || 'Medium';
    return this.experimentProblemsRepo.save(link);
  }

  async openProjectProblem(
    user: User,
    labId: string,
    experimentId: string,
    problemId: string,
  ) {
    // Reuse the workspace's enrollment, publication and teacher-assignment checks.
    const workspace = await this.getExperimentWorkspace(
      user,
      labId,
      experimentId,
    );
    if (
      !workspace.problems.some(
        (problem) => problem.id === problemId && problem.kind === 'project',
      )
    )
      throw new NotFoundException('Project exercise not found');
    const link = await this.experimentProblemsRepo.findOne({
      where: {
        id: problemId,
        lab_experiment_id: experimentId,
        kind: 'project',
      },
    });
    if (!link?.projectTemplate)
      throw new NotFoundException('Project starter not found');
    const result = await this.projectsService.openLabProject(
      user.id,
      {
        labId,
        experimentId,
        problemId,
        title: link.projectTemplate.name,
        instructions: link.projectTemplate.instructions,
      },
      link.projectTemplate,
    );
    await this.progressRepo
      .createQueryBuilder()
      .insert()
      .into(LabProblemProgress)
      .values({
        lab_id: labId,
        lab_experiment_problem_id: problemId,
        student_id: user.id,
        status: 'in_progress',
        attemptsCount: 0,
        timeSpentSeconds: 0,
        lastActivityAt: new Date(),
      })
      .orIgnore()
      .execute();
    return result;
  }

  // ─── Access helpers ────────────────────────────────────────────────

  async saveSqlProblem(
    labId: string,
    experimentId: string,
    dto: SaveLabSqlProblemDto,
    id?: string,
  ) {
    const experiment = await this.experimentsRepo.findOne({
      where: { id: experimentId, lab_id: labId },
    });
    if (!experiment) throw new NotFoundException('Experiment not found');
    const problem = validateSqlProblem(dto.problem);
    return this.experimentProblemsRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(LabExperimentProblem);
      const link = id
        ? await repo.findOne({
            where: { id, lab_experiment_id: experimentId, kind: 'sql' },
          })
        : repo.create({
            lab_experiment_id: experimentId,
            kind: 'sql',
            problem_metadata_id: null,
            sortOrder: await repo.countBy({ lab_experiment_id: experimentId }),
            isRequired: true,
          });
      if (!link) throw new NotFoundException('SQL practice question not found');
      const questions = manager.getRepository(Question);
      // Version the bank question so existing assessments retain their original datasets.
      const question = await questions.save(
        questions.create({
          question: problem.title,
          title: problem.title,
          description: problem.description,
          problemStatement: problem.description,
          topic: 'DBMS',
          subtopic: 'SQL lab',
          questionType: 'coding',
          language: 'sql',
          supportedLanguages: ['sql'],
          starterCode: [{ language: 'sql', code: problem.starterCode }],
          marks: dto.maxScore,
          negativeMarks: 0,
          status: 'approved',
          tags: ['lab-sql'],
          metadata: { sqlProblem: problem },
        }),
      );
      if (id && link.maxScore !== dto.maxScore)
        await manager.query(
          'UPDATE lab_problem_progress SET score=CASE WHEN $2::float > 0 THEN LEAST($3::float,COALESCE(score,0)/$2::float*$3::float) ELSE 0 END WHERE lab_experiment_problem_id=$1',
          [link.id, link.maxScore, dto.maxScore],
        );
      Object.assign(link, {
        sqlProblem: problem,
        sqlQuestionId: question.id,
        maxScore: dto.maxScore,
        difficulty: 'Medium',
      });
      return repo.save(link);
    });
  }

  async setPracticeMarks(
    labId: string,
    experimentId: string,
    id: string,
    maxScore: number,
  ) {
    if (
      !(await this.experimentsRepo.findOne({
        where: { id: experimentId, lab_id: labId },
      }))
    )
      throw new NotFoundException('Experiment not found');
    return this.experimentProblemsRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(LabExperimentProblem);
      const link = await repo.findOne({
        where: { id, lab_experiment_id: experimentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!link)
        throw new NotFoundException('Practice question not found');
      await manager.query(
        'UPDATE lab_problem_progress SET score=CASE WHEN $2::float > 0 THEN ROUND((COALESCE(score,0)/$2::float*$3::float)::numeric,2) ELSE 0 END WHERE lab_experiment_problem_id=$1',
        [id, link.maxScore, maxScore],
      );
      link.maxScore = maxScore;
      return repo.save(link);
    });
  }

  async setAssessmentMarks(
    labId: string,
    experimentId: string,
    id: string,
    maxScore: number,
  ) {
    if (
      !(await this.experimentsRepo.findOne({
        where: { id: experimentId, lab_id: labId },
      }))
    )
      throw new NotFoundException('Experiment not found');
    const assessment = await this.assessmentsRepo.findOne({
      where: { id, labExperimentId: experimentId },
    });
    if (!assessment)
      throw new NotFoundException('Experiment assessment not found');
    assessment.labMaxScore = maxScore;
    await this.assessmentsRepo.save(assessment);
    return { maxScore };
  }

  async executeSql(
    user: User,
    labId: string,
    experimentId: string,
    problemId: string,
    code: string,
    submit: boolean,
  ) {
    const workspace = await this.getExperimentWorkspace(
      user,
      labId,
      experimentId,
    );
    if (
      !workspace.problems.some(
        (problem) => problem.id === problemId && problem.kind === 'sql',
      )
    )
      throw new NotFoundException('SQL question not found');
    const link = await this.experimentProblemsRepo.findOne({
      where: { id: problemId, lab_experiment_id: experimentId, kind: 'sql' },
    });
    if (!link?.sqlProblem)
      throw new NotFoundException('SQL question not found');
    const feedback = await this.sqlEngine.evaluate(
      link.sqlProblem,
      code,
      submit,
      `interactive:${user.id}`,
    );
    if (!submit) return feedback;
    const score =
      Math.round(
        ((link.maxScore * feedback.passedCount) / feedback.totalCount) * 100,
      ) / 100;
    const solved = feedback.passedCount === feedback.totalCount;
    const [progress] = await this.progressRepo.query(
      `INSERT INTO lab_problem_progress(lab_id,lab_experiment_problem_id,student_id,status,score,"attemptsCount","lastActivityAt","firstSolvedAt","lastCode") VALUES($1,$2,$3,$4,$5,1,now(),CASE WHEN $6::boolean THEN now() END,$7)
      ON CONFLICT(lab_experiment_problem_id,student_id) DO UPDATE SET status=CASE WHEN lab_problem_progress.status='solved' OR $6::boolean THEN 'solved' ELSE 'in_progress' END,score=GREATEST(COALESCE(lab_problem_progress.score,0),$5),"attemptsCount"=lab_problem_progress."attemptsCount"+1,"lastCode"=$7,"lastActivityAt"=now(),"firstSolvedAt"=COALESCE(lab_problem_progress."firstSolvedAt",CASE WHEN $6::boolean THEN now() END) RETURNING *`,
      [
        labId,
        problemId,
        user.id,
        solved ? 'solved' : 'in_progress',
        score,
        solved,
        code,
      ],
    );
    return {
      ...feedback,
      awardedScore: score,
      maxScore: link.maxScore,
      progress,
    };
  }

  private async experimentAssessments(experimentId: string, user?: User) {
    const assessments = await this.assessmentsRepo.find({
      where: {
        labExperimentId: experimentId,
        ...(user && !isAdminUser(user)
          ? { status: In(['published', 'ongoing']) }
          : {}),
      },
      order: { createdAt: 'ASC' },
    });
    const attempts =
      user && assessments.length
        ? await this.attemptsRepo.find({
            where: {
              studentId: user.id,
              assessmentId: In(assessments.map((row) => row.id)),
              status: In(['submitted', 'auto_submitted']),
            },
          })
        : [];
    return assessments.map((assessment) => {
      const ratios = attempts
        .filter((attempt) => attempt.assessmentId === assessment.id)
        .map((attempt) =>
          Math.max(
            0,
            Math.min(
              1,
              attempt.score / (attempt.maxScore || assessment.totalMarks || 1),
            ),
          ),
        );
      const maxScore = assessment.labMaxScore ?? assessment.totalMarks;
      return {
        id: assessment.id,
        title: assessment.title,
        status: assessment.status,
        durationMinutes: assessment.durationMinutes,
        questionCount: assessment.questions.length,
        totalMarks: assessment.totalMarks,
        maxScore,
        earnedScore: ratios.length
          ? Math.round(Math.max(...ratios) * maxScore * 100) / 100
          : null,
      };
    });
  }

  private async assertStudentLabAccess(userId: string, labId: string) {
    const enrollments = await this.enrollmentsRepo.find({
      where: { student_id: userId, status: 'active' },
    });
    if (enrollments.length === 0) {
      throw new ForbiddenException('Not enrolled in any lab section');
    }
    const sectionIds = enrollments.map((e) => e.lab_section_id);
    const assignment = await this.sectionAssignmentsRepo.findOne({
      where: { lab_id: labId, lab_section_id: In(sectionIds) },
    });
    if (!assignment) {
      throw new ForbiddenException('Lab is not available for your section');
    }
    const lab = await this.labsRepo.findOne({ where: { id: labId } });
    if (!lab || lab.status !== 'published') {
      throw new NotFoundException('Lab not found');
    }
    return { lab, enrollments, assignment };
  }

  private async assertTeacherLabAccess(
    user: User,
    labId: string,
    sectionId?: string,
  ) {
    if (isAdminUser(user)) {
      const lab = await this.labsRepo.findOne({ where: { id: labId } });
      if (!lab) throw new NotFoundException('Lab not found');
      return { lab, assignment: null as LabTeacherAssignment | null };
    }
    const where: Record<string, string> = {
      lab_id: labId,
      teacher_id: user.id,
    };
    if (sectionId) where.lab_section_id = sectionId;
    const assignment = await this.teacherAssignmentsRepo.findOne({ where });
    if (!assignment) {
      throw new ForbiddenException('Not assigned to this lab');
    }
    const lab = await this.labsRepo.findOne({ where: { id: labId } });
    if (!lab) throw new NotFoundException('Lab not found');
    return { lab, assignment };
  }

  // ─── Student APIs ──────────────────────────────────────────────────

  async getMyLabs(user: User) {
    const enrollments = await this.enrollmentsRepo.find({
      where: { student_id: user.id, status: 'active' },
      relations: { section: true, subgroup: true },
    });
    if (enrollments.length === 0) return [];

    const sectionIds = enrollments.map((e) => e.lab_section_id);
    const assignments = await this.sectionAssignmentsRepo.find({
      where: { lab_section_id: In(sectionIds) },
      relations: { lab: true, section: true },
    });

    const published = assignments.filter(
      (a) => a.lab && a.lab.status === 'published',
    );

    const result = [];
    for (const a of published) {
      const enrollment = enrollments.find(
        (e) => e.lab_section_id === a.lab_section_id,
      );
      const experiments = await this.experimentsRepo.find({
        where: { lab_id: a.lab_id, isPublished: true },
        relations: { problems: true },
      });
      const progressRows = await this.progressRepo.find({
        where: { lab_id: a.lab_id, student_id: user.id },
      });
      const problemIds = new Set(
        experiments.flatMap((experiment) =>
          (experiment.problems || []).map((problem) => problem.id),
        ),
      );
      const solvedIds = new Set(
        progressRows
          .filter(
            (row) =>
              row.status === 'solved' &&
              problemIds.has(row.lab_experiment_problem_id),
          )
          .map((row) => row.lab_experiment_problem_id),
      );
      const completedExperiments = experiments.filter(
        (experiment) =>
          experiment.problems?.length &&
          experiment.problems.every((problem) => solvedIds.has(problem.id)),
      ).length;
      result.push({
        lab: a.lab,
        section: a.section,
        subgroup: enrollment?.subgroup || null,
        sectionLabel: enrollment?.subgroup
          ? `${a.section.code} [${enrollment.subgroup.code}]`
          : a.section.code,
        experimentCount: experiments.length,
        totalProblems: problemIds.size,
        completedExperiments,
        solvedCount: solvedIds.size,
      });
    }
    return result;
  }

  async getLabExperimentsForUser(user: User, labId: string) {
    if (isAdminUser(user) || isTeacherUser(user)) {
      // Teachers/admins may open; teachers need assignment check unless admin
      if (!isAdminUser(user)) {
        await this.assertTeacherLabAccess(user, labId);
      }
    } else {
      await this.assertStudentLabAccess(user.id, labId);
    }

    const lab = await this.labsRepo.findOne({ where: { id: labId } });
    if (!lab) throw new NotFoundException('Lab not found');

    const experiments = await this.experimentsRepo.find({
      where: { lab_id: labId, isPublished: true },
      relations: { problems: true },
      order: { sortOrder: 'ASC' },
    });

    const progress = await this.progressRepo.find({
      where: { lab_id: labId, student_id: user.id },
    });
    const progressByProblem = new Map(
      progress.map((p) => [p.lab_experiment_problem_id, p]),
    );

    return {
      lab,
      experiments: experiments.map((exp) => {
        const problemIds = (exp.problems || []).map((p) => p.id);
        const solved = problemIds.filter(
          (id) => progressByProblem.get(id)?.status === 'solved',
        ).length;
        return {
          id: exp.id,
          title: exp.title,
          description: exp.description || 'Labs',
          sortOrder: exp.sortOrder,
          problemCount: problemIds.length,
          solvedCount: solved,
        };
      }),
    };
  }

  async getExperimentWorkspace(
    user: User,
    labId: string,
    experimentId: string,
  ) {
    if (isAdminUser(user)) {
      // full access
    } else if (isTeacherUser(user)) {
      await this.assertTeacherLabAccess(user, labId);
    } else {
      await this.assertStudentLabAccess(user.id, labId);
    }

    const experiment = await this.experimentsRepo.findOne({
      where: { id: experimentId, lab_id: labId },
      relations: { problems: { problemMetadata: true }, lab: true },
    });
    if (!experiment || (!experiment.isPublished && !isAdminUser(user))) {
      throw new NotFoundException('Experiment not found');
    }

    const progress = await this.progressRepo.find({
      where: { lab_id: labId, student_id: user.id },
    });
    const progressMap = new Map(
      progress.map((p) => [p.lab_experiment_problem_id, p]),
    );

    const problems = [];
    for (const link of experiment.problems || []) {
      if (link.kind === 'sql' && link.sqlProblem) {
        problems.push({
          id: link.id,
          kind: 'sql' as const,
          title: link.sqlProblem.title,
          sortOrder: link.sortOrder,
          maxScore: link.maxScore,
          difficulty: link.difficulty || 'Medium',
          problemMetadataId: null,
          sql: publicSqlProblem(link.sqlProblem),
          statement: { description: link.sqlProblem.description },
          config: {
            supportedLanguages: ['sql'],
            defaultLanguage: 'sql',
            starterCode: { sql: link.sqlProblem.starterCode },
          },
          progress: progressMap.get(link.id) || null,
        });
        continue;
      }
      if (link.kind === 'project') {
        problems.push({
          id: link.id,
          kind: 'project' as const,
          title: link.projectTemplate?.name || 'Project exercise',
          sortOrder: link.sortOrder,
          maxScore: link.maxScore,
          difficulty: link.difficulty,
          project: link.projectTemplate
            ? {
                instructions: link.projectTemplate.instructions,
                frontendStack: link.projectTemplate.frontendStack,
                backendStack: link.projectTemplate.backendStack,
                fileCount: link.projectTemplate.files.length,
              }
            : null,
          config: null,
          statement: null,
          problemMetadataId: null,
          progress: progressMap.get(link.id) || null,
        });
        continue;
      }
      if (!link.problem_metadata_id)
        throw new NotFoundException('Practice problem not found');
      const meta = await this.problemsRepo.findOne({
        where: { id: link.problem_metadata_id },
        relations: { statement: true, config: true },
      });
      problems.push({
        id: link.id,
        kind: 'coding' as const,
        sortOrder: link.sortOrder,
        maxScore: link.maxScore,
        difficulty: link.difficulty || meta?.difficulty || 'Medium',
        isRequired: link.isRequired,
        problemMetadataId: link.problem_metadata_id,
        title: meta?.title || 'Problem',
        slug: meta?.slug,
        statement: meta?.statement || null,
        config: meta?.config
          ? {
              supportedLanguages: meta.config.supportedLanguages,
              defaultLanguage: meta.config.defaultLanguage,
              starterCode: meta.config.starterCode,
              timeLimit: meta.config.timeLimit,
              memoryLimit: meta.config.memoryLimit,
              executionMode: meta.config.executionMode,
              functionSignature: meta.config.functionSignature,
              exactOutput: meta.config.exactOutput,
            }
          : null,
        progress: progressMap.get(link.id) || null,
      });
    }

    return {
      lab: experiment.lab,
      experiment: {
        id: experiment.id,
        title: experiment.title,
        description: experiment.description,
      },
      problems: problems.sort((a, b) => a.sortOrder - b.sortOrder),
      assessments: await this.experimentAssessments(experimentId, user),
    };
  }

  async recordProgress(user: User, labId: string, dto: RecordLabProgressDto) {
    if (isAdminUser(user)) {
      // allow
    } else if (isTeacherUser(user)) {
      await this.assertTeacherLabAccess(user, labId);
    } else {
      await this.assertStudentLabAccess(user.id, labId);
    }

    const link = await this.experimentProblemsRepo.findOne({
      where: { id: dto.experimentProblemId },
      relations: { experiment: true },
    });
    if (!link || link.experiment.lab_id !== labId) {
      throw new NotFoundException('Experiment problem not found');
    }
    if (link.kind === 'project' || link.kind === 'sql')
      throw new BadRequestException(
        'Project exercises use their own saved workspace; coding verdicts do not grade projects.',
      );

    let progress = await this.progressRepo.findOne({
      where: {
        lab_experiment_problem_id: dto.experimentProblemId,
        student_id: user.id,
      },
    });

    const now = new Date();
    if (!progress) {
      progress = this.progressRepo.create({
        lab_id: labId,
        lab_experiment_problem_id: dto.experimentProblemId,
        student_id: user.id,
        status: 'not_started',
        attemptsCount: 0,
        timeSpentSeconds: 0,
      });
    }

    if (dto.submissionId) {
      const submission = await this.submissions.findOne({
        where: { id: dto.submissionId, userId: user.id },
      });
      if (
        !submission ||
        submission.problemId !== link.problem_metadata_id ||
        submission.problemSource !== 'metadata'
      )
        throw new BadRequestException(
          'Submission does not belong to this student and practice question',
        );
      const status = submission.status.toLowerCase().replace(/[\s_-]/g, '');
      if (
        ['pending', 'queued', 'running', 'processing', 'judging'].includes(
          status,
        )
      )
        throw new BadRequestException(
          'Wait for the verified submission result',
        );
      const accepted = status === 'accepted';
      const total = submission.totalTests ?? submission.totalTestCases ?? 0;
      const passed = submission.testsPassed ?? submission.testCasesPassed ?? 0;
      const score = accepted
        ? link.maxScore
        : total > 0
          ? Math.round(
              Math.max(0, Math.min(1, passed / total)) * link.maxScore * 100,
            ) / 100
          : 0;
      if (progress.best_submission_id !== submission.id)
        progress.attemptsCount += 1;
      progress.best_submission_id = submission.id;
      progress.score = Math.max(progress.score || 0, score);
      if (accepted) {
        progress.status = 'solved';
        progress.firstSolvedAt ||= now;
      } else if (progress.status !== 'solved') progress.status = 'failed';
    } else if (progress.status !== 'solved') progress.status = 'in_progress';
    if (dto.timeSpentSeconds !== undefined) {
      progress.timeSpentSeconds += dto.timeSpentSeconds;
    }
    progress.lastActivityAt = now;
    return this.progressRepo.save(progress);
  }

  async getMyProgress(user: User) {
    const labs = await this.getMyLabs(user);
    const detailed = [];
    for (const item of labs) {
      const progress = await this.progressRepo.find({
        where: { lab_id: item.lab.id, student_id: user.id },
        relations: { experimentProblem: true },
      });
      detailed.push({
        ...item,
        progress,
        totalAttempts: progress.reduce((s, p) => s + p.attemptsCount, 0),
        timeSpentSeconds: progress.reduce((s, p) => s + p.timeSpentSeconds, 0),
      });
    }
    return detailed;
  }

  // ─── Teacher APIs ──────────────────────────────────────────────────

  async getTeacherLabs(user: User) {
    if (isAdminUser(user)) {
      const assignments = await this.sectionAssignmentsRepo.find({
        relations: { lab: true, section: true },
        order: { createdAt: 'DESC' },
      });
      return assignments.map((a) => ({
        id: a.id,
        lab: a.lab,
        section: a.section,
        sectionLabel: a.section?.code,
        role: 'admin',
      }));
    }

    const assignments = await this.teacherAssignmentsRepo.find({
      where: { teacher_id: user.id },
      relations: { lab: true, section: true },
      order: { createdAt: 'DESC' },
    });
    return assignments.map((a) => ({
      id: a.id,
      lab: a.lab,
      section: a.section,
      sectionLabel: a.section?.code,
      role: a.role,
    }));
  }

  async getTeacherMetrics(user: User, labId: string, sectionId?: string) {
    let resolvedSectionId = sectionId;
    if (isAdminUser(user)) {
      if (!resolvedSectionId) {
        const first = await this.sectionAssignmentsRepo.findOne({
          where: { lab_id: labId },
        });
        resolvedSectionId = first?.lab_section_id;
      }
    } else {
      const { assignment } = await this.assertTeacherLabAccess(
        user,
        labId,
        sectionId,
      );
      resolvedSectionId = sectionId || assignment?.lab_section_id;
    }

    if (!resolvedSectionId) {
      throw new BadRequestException('sectionId is required');
    }

    const lab = await this.labsRepo.findOne({ where: { id: labId } });
    if (!lab) throw new NotFoundException('Lab not found');

    const section = await this.sectionsRepo.findOne({
      where: { id: resolvedSectionId },
      relations: { subgroups: true },
    });
    if (!section) throw new NotFoundException('Section not found');

    const enrollments = (
      await this.enrollmentsRepo.find({
        where: { lab_section_id: resolvedSectionId, status: 'active' },
        relations: { student: true, subgroup: true },
      })
    ).filter(
      (enrollment) =>
        enrollment.student && enrollment.student.isActive !== false,
    );

    const experiments = await this.experimentsRepo.find({
      where: { lab_id: labId, isPublished: true },
      relations: { problems: true },
      order: { sortOrder: 'ASC' },
    });
    const allProblemLinks = experiments.flatMap((e) => e.problems || []);
    const totalProblems = allProblemLinks.length;

    const studentIds = enrollments.map((e) => e.student_id);
    const progressRows =
      studentIds.length === 0
        ? []
        : await this.progressRepo.find({
            where: { lab_id: labId, student_id: In(studentIds) },
          });

    const publishedProblemIds = new Set(allProblemLinks.map((link) => link.id));
    const byStudent = new Map<string, LabProblemProgress[]>();
    for (const row of progressRows) {
      if (!publishedProblemIds.has(row.lab_experiment_problem_id)) continue;
      const list = byStudent.get(row.student_id) || [];
      list.push(row);
      byStudent.set(row.student_id, list);
    }

    const students = enrollments.map((enrollment) => {
      const rows = byStudent.get(enrollment.student_id) || [];
      const solved = rows.filter((r) => r.status === 'solved').length;
      const attempts = rows.reduce((s, r) => s + r.attemptsCount, 0);
      const timeSpent = rows.reduce((s, r) => s + r.timeSpentSeconds, 0);
      const score = rows.reduce((s, r) => s + (r.score || 0), 0);
      return {
        student: enrollment.student
          ? {
              id: enrollment.student.id,
              name: enrollment.student.name,
              email: enrollment.student.email,
              uid: enrollment.student.uid,
            }
          : { id: enrollment.student_id },
        subgroup: enrollment.subgroup
          ? {
              id: enrollment.subgroup.id,
              code: enrollment.subgroup.code,
              name: enrollment.subgroup.name,
            }
          : null,
        sectionLabel: enrollment.subgroup
          ? `${section.code} [${enrollment.subgroup.code}]`
          : section.code,
        solvedCount: solved,
        totalProblems,
        completionPercent:
          totalProblems === 0 ? 0 : Math.round((solved / totalProblems) * 100),
        attempts,
        timeSpentSeconds: timeSpent,
        score,
      };
    });

    const classSolved = students.reduce((s, st) => s + st.solvedCount, 0);
    const classPossible = students.length * totalProblems;

    return {
      lab,
      section,
      experimentCount: experiments.length,
      totalProblems,
      enrolledCount: students.length,
      classCompletionPercent:
        classPossible === 0
          ? 0
          : Math.round((classSolved / classPossible) * 100),
      students: students.sort(
        (a, b) => b.completionPercent - a.completionPercent,
      ),
    };
  }
}
