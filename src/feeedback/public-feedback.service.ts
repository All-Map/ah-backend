import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { PublicFeedback, PublicFeedbackStats } from '../entities/public-feedback.entity';
import { CreatePublicFeedbackDto, UpdatePublicFeedbackStatusDto, PublicFeedbackQueryDto } from './dto/create-public-feedback.dto';
import { SupabaseService } from 'src/supabase/supabase.service';

@Injectable()
export class PublicFeedbackService {
  constructor(
    @InjectRepository(PublicFeedback)
    private readonly feedbackRepository: Repository<PublicFeedback>,
    private readonly supabaseService: SupabaseService
  ) {}

  async create(feedbackDto: CreatePublicFeedbackDto): Promise<PublicFeedback> {
    const feedback = this.feedbackRepository.create(feedbackDto);
    return await this.feedbackRepository.save(feedback);
  }

  async findAll(query: PublicFeedbackQueryDto): Promise<{
    data: PublicFeedback[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 20, status, category, search, sortBy = 'created_at', sortOrder = 'DESC' } = query;
    
    const skip = (page - 1) * limit;
    
    const queryBuilder = this.feedbackRepository.createQueryBuilder('feedback');

    // Apply filters
    if (status) {
      queryBuilder.andWhere('feedback.status = :status', { status });
    }

    if (category) {
      queryBuilder.andWhere('feedback.category = :category', { category });
    }

    if (search) {
      queryBuilder.andWhere(
        '(feedback.subject LIKE :search OR feedback.message LIKE :search OR feedback.name LIKE :search OR feedback.email LIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination and sorting
    const data = await queryBuilder
      .orderBy(`feedback.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit)
      .getMany();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<PublicFeedback | null> {
    return await this.feedbackRepository.findOne({
      where: { id },
    });
  }

  async updateStatus(id: string, updateDto: UpdatePublicFeedbackStatusDto): Promise<PublicFeedback> {
    const feedback = await this.findOne(id);
    if (!feedback) {
      throw new Error('Feedback not found');
    }

    feedback.status = updateDto.status;
    if (updateDto.adminNotes !== undefined) {
      feedback.adminNotes = updateDto.adminNotes;
    }

    return await this.feedbackRepository.save(feedback);
  }

  async getStats(): Promise<PublicFeedbackStats> {
    // Using TypeORM query builder for stats
    const total = await this.feedbackRepository.count();
    const pending = await this.feedbackRepository.count({ where: { status: 'pending' } });
    const reviewed = await this.feedbackRepository.count({ where: { status: 'reviewed' } });
    const resolved = await this.feedbackRepository.count({ where: { status: 'resolved' } });
    const archived = await this.feedbackRepository.count({ where: { status: 'archived' } });
    const responded = await this.feedbackRepository.count({ where: { responded: true } });

    // Today's feedback
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await this.feedbackRepository.count({
      where: { createdAt: MoreThanOrEqual(today) }
    });

    // This week's feedback
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const thisWeekCount = await this.feedbackRepository.count({
      where: { createdAt: MoreThanOrEqual(weekStart) }
    });

    // This month's feedback
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonthCount = await this.feedbackRepository.count({
      where: { createdAt: MoreThanOrEqual(monthStart) }
    });

    // Category counts
    const categoryResults = await this.feedbackRepository
      .createQueryBuilder('feedback')
      .select('feedback.category, COUNT(feedback.id) as count')
      .groupBy('feedback.category')
      .getRawMany();

    const byCategory = {};
    categoryResults.forEach(row => {
      byCategory[row.category] = parseInt(row.count);
    });

    // Average response time (for responded feedback)
    const avgResponseQuery = await this.feedbackRepository
      .createQueryBuilder('feedback')
      .select('AVG(EXTRACT(EPOCH FROM (feedback.respondedAt - feedback.createdAt)) / 3600)', 'avgHours')
      .where('feedback.respondedAt IS NOT NULL')
      .getRawOne();

    const avgResponseTime = avgResponseQuery?.avgHours || 0;

    return {
      total,
      pending,
      reviewed,
      resolved,
      archived,
      byCategory,
      today: todayCount,
      thisWeek: thisWeekCount,
      thisMonth: thisMonthCount,
      responded,
      avgResponseTime: parseFloat(avgResponseTime.toFixed(2)),
    };
  }

  async findRecent(limit: number = 10): Promise<PublicFeedback[]> {
    return await this.feedbackRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findByEmail(email: string): Promise<PublicFeedback[]> {
    return await this.feedbackRepository.find({
      where: { email },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsSpam(id: string): Promise<PublicFeedback> {
    const feedback = await this.findOne(id);
    if (!feedback) {
      throw new Error('Feedback not found');
    }

    feedback.status = 'archived';
    feedback.adminNotes = (feedback.adminNotes || '') + '\nMarked as spam';
    
    return await this.feedbackRepository.save(feedback);
  }
}