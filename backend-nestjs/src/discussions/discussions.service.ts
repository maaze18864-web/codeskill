import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discussion } from '../database/entities/discussion.entity';
import { DiscussionReply } from '../database/entities/discussion-reply.entity';

@Injectable()
export class DiscussionsService {
  constructor(
    @InjectRepository(Discussion)
    private readonly discussionRepo: Repository<Discussion>,
    @InjectRepository(DiscussionReply)
    private readonly replyRepo: Repository<DiscussionReply>,
  ) {}

  // ── Threads ──────────────────────────────────────────────────────────────

  async getThreads(problemId: string, query: any) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

    const qb = this.discussionRepo
      .createQueryBuilder('thread')
      .leftJoinAndSelect('thread.author', 'author')
      .where('thread.problemId = :problemId', { problemId });

    if (query.tag && query.tag !== 'all') {
      qb.andWhere(':tag = ANY(thread.tags)', { tag: query.tag });
    }

    if (query.sort === 'popular') {
      qb.orderBy('thread.upvotes', 'DESC');
    } else {
      qb.orderBy('thread.createdAt', 'DESC');
    }

    qb.skip((page - 1) * limit).take(limit);

    const [threads, total] = await qb.getManyAndCount();

    return {
      data: threads.map((t) => ({ ...t, _id: t.id })),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async getThread(threadId: string) {
    const thread = await this.discussionRepo.findOne({
      where: [{ id: threadId }, { mongoId: threadId }],
      relations: { author: true },
    });

    if (!thread) throw new NotFoundException('Thread not found');
    return { ...thread, _id: thread.id };
  }

  async createThread(
    userId: string,
    data: { problemId: string; title: string; body: string; tags?: string[] },
  ) {
    if (!data.title?.trim() || !data.body?.trim()) {
      throw new BadRequestException('Title and body are required');
    }

    const thread = this.discussionRepo.create({
      problemId: data.problemId,
      author: { id: userId } as any,
      title: data.title.trim(),
      body: data.body.trim(),
      tags: data.tags || ['general'],
      upvotes: 0,
      downvotes: 0,
      replyCount: 0,
    });
    await this.discussionRepo.save(thread);

    return this.getThread(thread.id);
  }

  async deleteThread(userId: string, threadId: string) {
    const thread = await this.discussionRepo.findOne({
      where: [{ id: threadId }, { mongoId: threadId }],
      relations: { author: true },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.author?.id !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    await this.replyRepo.delete({ discussion: { id: thread.id } as any });
    await this.discussionRepo.delete(thread.id);

    return { deleted: true };
  }

  async voteThread(userId: string, threadId: string, direction: 'up' | 'down') {
    return this.discussionRepo.manager.transaction(async (manager) => {
      const thread = await manager.findOne(Discussion, {
        where: [{ id: threadId }, { mongoId: threadId }],
        lock: { mode: 'pessimistic_write' },
      });
      if (!thread) throw new NotFoundException('Thread not found');

      const upvotedBy = Array.isArray(thread.upvotedBy) ? [...thread.upvotedBy] : [];
      const downvotedBy = Array.isArray(thread.downvotedBy) ? [...thread.downvotedBy] : [];

      const alreadyUpvoted = upvotedBy.includes(userId);
      const alreadyDownvoted = downvotedBy.includes(userId);

      if (direction === 'up') {
        if (alreadyUpvoted) {
          thread.upvotedBy = upvotedBy.filter((id) => id !== userId);
          thread.upvotes = Math.max(0, (thread.upvotes || 0) - 1);
        } else {
          if (alreadyDownvoted) {
            thread.downvotedBy = downvotedBy.filter((id) => id !== userId);
            thread.downvotes = Math.max(0, (thread.downvotes || 0) - 1);
          }
          thread.upvotedBy = [...upvotedBy, userId];
          thread.upvotes = (thread.upvotes || 0) + 1;
        }
      } else {
        if (alreadyDownvoted) {
          thread.downvotedBy = downvotedBy.filter((id) => id !== userId);
          thread.downvotes = Math.max(0, (thread.downvotes || 0) - 1);
        } else {
          if (alreadyUpvoted) {
            thread.upvotedBy = upvotedBy.filter((id) => id !== userId);
            thread.upvotes = Math.max(0, (thread.upvotes || 0) - 1);
          }
          thread.downvotedBy = [...downvotedBy, userId];
          thread.downvotes = (thread.downvotes || 0) + 1;
        }
      }

      await manager.save(thread);
      return { upvotes: thread.upvotes, downvotes: thread.downvotes };
    });
  }

  // ── Replies ──────────────────────────────────────────────────────────────

  async getReplies(threadId: string) {
    const replies = await this.replyRepo.find({
      where: { discussion: { id: threadId } as any },
      relations: { author: true },
      order: { createdAt: 'ASC' },
    });

    return replies.map((r) => ({ ...r, _id: r.id }));
  }

  async createReply(
    userId: string,
    threadId: string,
    data: { body: string; parentReply?: string },
  ) {
    const thread = await this.discussionRepo.findOne({
      where: [{ id: threadId }, { mongoId: threadId }],
    });
    if (!thread) throw new NotFoundException('Thread not found');

    if (!data.body?.trim()) {
      throw new BadRequestException('Reply body is required');
    }

    const reply = this.replyRepo.create({
      discussion: { id: thread.id } as any,
      author: { id: userId } as any,
      body: data.body.trim(),
      parentReply: data.parentReply ? ({ id: data.parentReply } as any) : null,
    });
    await this.replyRepo.save(reply);

    await this.discussionRepo.increment({ id: thread.id }, 'replyCount', 1);

    const saved = await this.replyRepo.findOne({
      where: { id: reply.id },
      relations: { author: true },
    });
    return saved ? { ...saved, _id: saved.id } : reply;
  }

  async deleteReply(userId: string, replyId: string) {
    const reply = await this.replyRepo.findOne({
      where: { id: replyId },
      relations: { author: true, discussion: true },
    });
    if (!reply) throw new NotFoundException('Reply not found');
    if (reply.author?.id !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    if (reply.discussion) {
      await this.discussionRepo.decrement({ id: reply.discussion.id }, 'replyCount', 1);
    }

    await this.replyRepo.delete(replyId);
    return { deleted: true };
  }

  async voteReply(userId: string, replyId: string, direction: 'up' | 'down') {
    return this.replyRepo.manager.transaction(async (manager) => {
      const reply = await manager.findOne(DiscussionReply, {
        where: [{ id: replyId }],
        lock: { mode: 'pessimistic_write' },
      });
      if (!reply) throw new NotFoundException('Reply not found');

      const upvotedBy = Array.isArray(reply.upvotedBy) ? [...reply.upvotedBy] : [];
      const downvotedBy = Array.isArray(reply.downvotedBy) ? [...reply.downvotedBy] : [];

      const alreadyUpvoted = upvotedBy.includes(userId);
      const alreadyDownvoted = downvotedBy.includes(userId);

      if (direction === 'up') {
        if (alreadyUpvoted) {
          reply.upvotedBy = upvotedBy.filter((id) => id !== userId);
          reply.upvotes = Math.max(0, (reply.upvotes || 0) - 1);
        } else {
          if (alreadyDownvoted) {
            reply.downvotedBy = downvotedBy.filter((id) => id !== userId);
            reply.downvotes = Math.max(0, (reply.downvotes || 0) - 1);
          }
          reply.upvotedBy = [...upvotedBy, userId];
          reply.upvotes = (reply.upvotes || 0) + 1;
        }
      } else {
        if (alreadyDownvoted) {
          reply.downvotedBy = downvotedBy.filter((id) => id !== userId);
          reply.downvotes = Math.max(0, (reply.downvotes || 0) - 1);
        } else {
          if (alreadyUpvoted) {
            reply.upvotedBy = upvotedBy.filter((id) => id !== userId);
            reply.upvotes = Math.max(0, (reply.upvotes || 0) - 1);
          }
          reply.downvotedBy = [...downvotedBy, userId];
          reply.downvotes = (reply.downvotes || 0) + 1;
        }
      }

      await manager.save(reply);
      return { upvotes: reply.upvotes, downvotes: reply.downvotes };
    });
  }
}
