import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';
import { BugActivity } from '../database/entities/bug-activity.entity';
import { BugComment } from '../database/entities/bug-comment.entity';
import { BugImage } from '../database/entities/bug-image.entity';
import {
  BugReport,
} from '../database/entities/bug-report.entity';
import { CreateBugCommentDto } from './dto/create-bug-comment.dto';
import { CreateBugDto } from './dto/create-bug.dto';
import { UpdateBugDto } from './dto/update-bug.dto';
import { ADMIN_ROLES } from '../common/guards/admin.guard';

const MAX_IMAGES_PER_BUG = 20;
const imageTypes = {
  'image/png': { extension: '.png', matches: (b: Buffer) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/jpeg': { extension: '.jpg', matches: (b: Buffer) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': { extension: '.webp', matches: (b: Buffer) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
} as const;

type StoredImage = { path: string; url: string; mimeType: string };

@Injectable()
export class BugsService {
  constructor(
    @InjectRepository(BugReport)
    private readonly bugRepository: Repository<BugReport>,
    @InjectRepository(BugImage)
    private readonly imageRepository: Repository<BugImage>,
    @InjectRepository(BugComment)
    private readonly commentRepository: Repository<BugComment>,
  ) {}

  async list(search: string, sort: 'newest' | 'oldest' | 'priority') {
    const query = this.bugRepository.createQueryBuilder('bug');
    const normalizedSearch = search.trim();
    if (normalizedSearch) {
      query.where(
        '(LOWER(bug.title) LIKE LOWER(:search) OR LOWER(bug.creatorName) LIKE LOWER(:search))',
        { search: `%${normalizedSearch}%` },
      );
    }

    if (sort === 'oldest') {
      query.orderBy('bug.createdAt', 'ASC');
    } else if (sort === 'priority') {
      query
        .orderBy(
          `CASE bug.priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END`,
          'DESC',
        )
        .addOrderBy('bug.createdAt', 'DESC');
    } else {
      query.orderBy('bug.createdAt', 'DESC');
    }

    const bugs = await query.getMany();
    const ids = bugs.map((bug) => bug.id);
    const [commentCounts, imageCounts] = ids.length
      ? await Promise.all([
          this.bugRepository.manager.query(
            'SELECT "bugId", COUNT(*)::int AS count FROM bug_comments WHERE "bugId" = ANY($1::uuid[]) GROUP BY "bugId"',
            [ids],
          ),
          this.bugRepository.manager.query(
            'SELECT "bugId", COUNT(*)::int AS count FROM bug_images WHERE "bugId" = ANY($1::uuid[]) GROUP BY "bugId"',
            [ids],
          ),
        ])
      : [[], []];
    const commentsById = new Map<string, number>(
      commentCounts.map((row: { bugId: string; count: number }) => [row.bugId, Number(row.count)]),
    );
    const imagesById = new Map<string, number>(
      imageCounts.map((row: { bugId: string; count: number }) => [row.bugId, Number(row.count)]),
    );
    bugs.forEach((bug) => {
      bug.commentCount = commentsById.get(bug.id) || 0;
      bug.imageCount = imagesById.get(bug.id) || 0;
    });
    const counts = bugs.reduce(
      (result: { total: number; new: number; in_process: number; fixed: number }, bug: BugReport) => {
        result.total += 1;
        result[bug.status] += 1;
        return result;
      },
      { total: 0, new: 0, in_process: 0, fixed: 0 },
    );
    return { items: bugs.map((bug) => this.toCard(bug)), counts };
  }

  async getOne(id: string, user: any) {
    const bug = await this.bugRepository.findOne({
      where: { id },
      relations: { images: true, comments: true, activities: true },
      order: {
        images: { createdAt: 'ASC' },
        comments: { createdAt: 'ASC' },
        activities: { createdAt: 'ASC' },
      },
    });
    if (!bug) throw new NotFoundException('Bug report not found.');
    return {
      ...this.toCard(bug),
      images: (bug.images || []).map((image) => ({ id: image.id, url: image.url, mimeType: image.mimeType, createdAt: image.createdAt })),
      comments: (bug.comments || []).map((comment) => ({
        id: comment.id,
        authorName: comment.authorName,
        text: comment.body,
        createdAt: comment.createdAt,
        editedAt: comment.editedAt,
        canEdit: this.canEditComment(comment, user),
      })),
      activities: (bug.activities || []).map((activity) => ({ id: activity.id, type: activity.type, actorName: activity.actorName, message: activity.message, createdAt: activity.createdAt })),
      isAssignee: Boolean(user?.id && bug.assigneeUserId && user.id === bug.assigneeUserId),
      isCreator: Boolean(user?.id && bug.creatorUserId && user.id === bug.creatorUserId),
      canEditBug: this.canEditBug(bug, user),
    };
  }

  async create(dto: CreateBugDto, files: Express.Multer.File[], user: any) {
    const storedImages = await this.storeImages(files);
    try {
      const created = await this.bugRepository.manager.transaction(async (manager) => {
        const bugs = manager.getRepository(BugReport);
        const bug = await bugs.save(
          bugs.create({
            creatorName: dto.creatorName,
            title: dto.title,
            description: dto.description,
            priority: dto.priority || 'medium',
            status: 'new',
            creatorUserId: user?.id || null,
            assigneeName: null,
            assigneeUserId: null,
            fixedAt: null,
          }),
        );
        await manager.getRepository(BugActivity).save({
          bugId: bug.id,
          actorName: dto.creatorName,
          actorUserId: user?.id || null,
          type: 'reported',
          message: `${dto.creatorName} reported this bug`,
        });
        if (storedImages.length) {
          await manager.getRepository(BugImage).save(
            storedImages.map((image) => ({
              bugId: bug.id,
              url: image.url,
              mimeType: image.mimeType,
              uploadedByUserId: user?.id || null,
            })),
          );
        }
        return bugs.findOne({
          where: { id: bug.id },
          relations: { images: true, comments: true, activities: true },
        });
      });
      return this.getOne(created!.id, user);
    } catch (error) {
      await this.removeStoredImages(storedImages);
      throw error;
    }
  }

  async assign(id: string, assigneeName: string, user: any) {
    const result = await this.bugRepository.manager.transaction(async (manager) => {
      const bugs = manager.getRepository(BugReport);
      const bug = await bugs.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!bug) throw new NotFoundException('Bug report not found.');
      if (bug.status !== 'new' || bug.assigneeName) {
        throw new ConflictException(`This bug is already being worked on${bug.assigneeName ? ` by ${bug.assigneeName}` : ''}.`);
      }
      bug.status = 'in_process';
      bug.assigneeName = assigneeName;
      bug.assigneeUserId = user?.id || null;
      await bugs.save(bug);
      await manager.getRepository(BugActivity).save({
        bugId: bug.id,
        actorName: assigneeName,
        actorUserId: user?.id || null,
        type: 'assigned',
        message: `${assigneeName} started working on this bug`,
      });
      return bug.id;
    });
    return this.getOne(result, user);
  }

  async updateStatus(id: string, status: 'fixed' | 'new', user: any) {
    await this.bugRepository.manager.transaction(async (manager) => {
      const bugs = manager.getRepository(BugReport);
      const bug = await bugs.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!bug) throw new NotFoundException('Bug report not found.');
      if (status === 'fixed') {
        if (!user?.id || bug.assigneeUserId !== user.id) {
          throw new ForbiddenException('Only the person assigned to this bug can mark it fixed.');
        }
        if (bug.status !== 'in_process') throw new ConflictException('Only an in-process bug can be marked fixed.');
        bug.status = 'fixed';
        bug.fixedAt = new Date();
      } else {
        if (bug.status !== 'fixed') throw new ConflictException('Only a fixed bug can be reopened.');
        bug.status = 'new';
        bug.assigneeName = null;
        bug.assigneeUserId = null;
        bug.fixedAt = null;
      }
      await bugs.save(bug);
      await manager.getRepository(BugActivity).save({
        bugId: bug.id,
        actorName: user.name || bug.assigneeName || 'Admin',
        actorUserId: user.id,
        type: status === 'fixed' ? 'fixed' : 'reopened',
        message: status === 'fixed' ? 'Marked this bug as fixed' : 'Reopened this bug',
      });
    });
    return this.getOne(id, user);
  }

  async addImages(id: string, files: Express.Multer.File[], user: any) {
    if (!files?.length) throw new BadRequestException('Select at least one image to upload.');
    const bug = await this.bugRepository.findOne({ where: { id }, relations: { images: true } });
    if (!bug) throw new NotFoundException('Bug report not found.');
    if ((bug.images?.length || 0) + files.length > MAX_IMAGES_PER_BUG) {
      throw new BadRequestException(`A bug can have at most ${MAX_IMAGES_PER_BUG} images.`);
    }
    const storedImages = await this.storeImages(files);
    try {
      await this.imageRepository.save(
        storedImages.map((image) => ({
          bugId: bug.id,
          url: image.url,
          mimeType: image.mimeType,
          uploadedByUserId: user?.id || null,
        })),
      );
    } catch (error) {
      await this.removeStoredImages(storedImages);
      throw error;
    }
    return this.getOne(id, user);
  }

  async addComment(id: string, dto: CreateBugCommentDto, user: any) {
    const bug = await this.bugRepository.findOne({ where: { id }, select: { id: true } });
    if (!bug) throw new NotFoundException('Bug report not found.');
    await this.commentRepository.save({
      bugId: bug.id,
      authorName: dto.commenterName,
      body: dto.text,
      authorUserId: user?.id || null,
    });
    return this.getOne(id, user);
  }

  async updateBug(id: string, dto: UpdateBugDto, user: any) {
    if (dto.title === undefined && dto.description === undefined) {
      throw new BadRequestException('Provide a title or description to update.');
    }
    await this.bugRepository.manager.transaction(async (manager) => {
      const bugs = manager.getRepository(BugReport);
      const bug = await bugs.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!bug) throw new NotFoundException('Bug report not found.');
      if (!this.canEditBug(bug, user)) {
        throw new ForbiddenException('Only the bug creator, assignee, or an admin can edit this report.');
      }
      if (dto.title !== undefined) bug.title = dto.title;
      if (dto.description !== undefined) bug.description = dto.description;
      bug.editedAt = new Date();
      await bugs.save(bug);
      await manager.getRepository(BugActivity).save({
        bugId: bug.id,
        actorName: String(user?.name || 'Admin').slice(0, 80),
        actorUserId: user?.id || null,
        type: 'edited',
        message: `${String(user?.name || 'Admin').slice(0, 80)} edited the bug details`,
      });
    });
    return this.getOne(id, user);
  }

  async updateComment(id: string, commentId: string, text: string, user: any) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, bugId: id },
    });
    if (!comment) throw new NotFoundException('Bug comment not found.');
    if (!this.canEditComment(comment, user)) {
      throw new ForbiddenException('Only the person who wrote this comment can edit it.');
    }
    comment.body = text;
    comment.editedAt = new Date();
    await this.commentRepository.save(comment);
    return this.getOne(id, user);
  }

  private canEditBug(bug: BugReport, user: any): boolean {
    return Boolean(
      user?.isAdmin ||
      ADMIN_ROLES.includes(user?.role) ||
      (user?.id && bug.creatorUserId === user.id) ||
      (user?.id && bug.assigneeUserId === user.id),
    );
  }

  private canEditComment(comment: BugComment, user: any): boolean {
    const currentName = typeof user?.name === 'string' ? user.name.trim().toLocaleLowerCase() : '';
    return Boolean(
      (user?.id && comment.authorUserId === user.id) ||
      (currentName && comment.authorName.trim().toLocaleLowerCase() === currentName),
    );
  }

  private toCard(bug: BugReport) {
    return {
      id: bug.id,
      creatorName: bug.creatorName,
      title: bug.title,
      description: bug.description,
      status: bug.status,
      priority: bug.priority,
      assigneeName: bug.assigneeName,
      fixedAt: bug.fixedAt,
      createdAt: bug.createdAt,
      updatedAt: bug.updatedAt,
      editedAt: bug.editedAt,
      commentCount: bug.commentCount ?? bug.comments?.length ?? 0,
      imageCount: bug.imageCount ?? bug.images?.length ?? 0,
    };
  }

  private async storeImages(files: Express.Multer.File[]): Promise<StoredImage[]> {
    if (!files?.length) return [];
    const directory = join(process.cwd(), 'uploads', 'bugs');
    await mkdir(directory, { recursive: true });
    const stored: StoredImage[] = [];
    try {
      for (const file of files) {
        const spec = imageTypes[file.mimetype as keyof typeof imageTypes];
        if (!spec || !spec.matches(file.buffer)) {
          throw new BadRequestException('An uploaded image has invalid contents. Use PNG, JPG, or WebP files.');
        }
        if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Each image must be 5 MB or smaller.');
        const filename = `${randomUUID()}${spec.extension}`;
        const path = join(directory, filename);
        await writeFile(path, file.buffer, { flag: 'wx' });
        stored.push({ path, url: `/uploads/bugs/${filename}`, mimeType: file.mimetype });
      }
      return stored;
    } catch (error) {
      await this.removeStoredImages(stored);
      throw error;
    }
  }

  private async removeStoredImages(images: StoredImage[]) {
    await Promise.all(images.map((image) => unlink(image.path).catch(() => undefined)));
  }
}
