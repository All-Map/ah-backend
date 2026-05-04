import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Feedback as FeedbackModel,
  FeedbackStatus,
  FeedbackCategory,
  PublicFeedback as PublicFeedbackModel,
  PublicFeedbackStatus,
  PublicFeedbackCategory,
  PublicFeedbackStats,
} from './feedback.types';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  // ================ AUTHENTICATED USER FEEDBACK METHODS ================

  async getAllFeedback(
    page: number = 1,
    limit: number = 20,
    status?: FeedbackStatus,
    category?: FeedbackCategory | string,
    search?: string
  ): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const where: any = {};
      
      if (status) {
        where.status = status;
      }

      if (category && category !== 'all') {
        where.category = category as any;
      }

      if (search) {
        where.OR = [
          { subject: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        this.prisma.feedback.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.feedback.count({ where }),
      ]);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Feedback service error:', error);
      throw error;
    }
  }

  async updateFeedbackStatus(
    feedbackId: string,
    status: FeedbackStatus,
    adminNotes?: string
  ): Promise<any> {
    try {
      return await this.prisma.feedback.update({
        where: { id: feedbackId },
        data: {
          status: status as any,
          adminNotes,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Update service error:', error);
      throw error;
    }
  }

  async getFeedbackStats(): Promise<{
    total: number;
    pending: number;
    reviewed: number;
    resolved: number;
    byCategory: Record<string, number>;
  }> {
    try {
      const [allFeedback, categoryGroups] = await Promise.all([
        this.prisma.feedback.findMany({
          select: { status: true },
        }),
        this.prisma.feedback.groupBy({
          by: ['category'],
          _count: {
            _all: true,
          },
        }),
      ]);

      const total = allFeedback.length;
      const pending = allFeedback.filter((f) => f.status === 'pending').length;
      const reviewed = allFeedback.filter((f) => f.status === 'reviewed').length;
      const resolved = allFeedback.filter((f) => f.status === 'resolved').length;

      const byCategory = categoryGroups.reduce((acc, group) => {
        acc[group.category] = group._count._all;
        return acc;
      }, {} as Record<string, number>);

      return {
        total,
        pending,
        reviewed,
        resolved,
        byCategory,
      };
    } catch (error) {
      console.error('Get stats error:', error);
      throw error;
    }
  }

  // ================ PUBLIC FEEDBACK METHODS ================

  async submitPublicFeedback(
    name: string,
    email: string,
    subject: string,
    message: string,
    category: PublicFeedbackCategory = PublicFeedbackCategory.GENERAL,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    try {
      // Check if this email belongs to an existing user
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, role: true }
      });

      const feedbackData: any = {
        name,
        email,
        subject,
        message,
        category: category as any,
        status: PublicFeedbackStatus.PENDING as any,
        ipAddress,
        userAgent,
        userId: existingUser?.id,
      };

      const data = await this.prisma.publicFeedback.create({
        data: feedbackData
      });

      const publicFeedback = new PublicFeedbackModel();
      Object.assign(publicFeedback, data);
      
      if (existingUser) {
        (publicFeedback as any).isExistingUser = true;
        (publicFeedback as any).userInfo = existingUser;
      }

      return publicFeedback;
    } catch (error) {
      console.error('Submit public feedback service error:', error);
      throw error;
    }
  }

  async getAllPublicFeedback(
    page: number = 1,
    limit: number = 20,
    status?: PublicFeedbackStatus | string,
    category?: PublicFeedbackCategory | string,
    search?: string,
    includeUserInfo: boolean = false
  ): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const where: any = {};
      
      if (status && status !== 'all') {
        where.status = status as any;
      }

      if (category && category !== 'all') {
        where.category = category as any;
      }

      if (search) {
        where.OR = [
          { subject: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        this.prisma.publicFeedback.findMany({
          where,
          include: {
            user: includeUserInfo ? { 
              select: { id: true, name: true, role: true } 
            } : false,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.publicFeedback.count({ where }),
      ]);

      const feedbacks = data.map(item => {
        const feedback = new PublicFeedbackModel();
        Object.assign(feedback, item);
        if (item.user) {
          (feedback as any).isExistingUser = true;
          (feedback as any).userInfo = item.user;
        }
        return feedback;
      });

      return {
        data: feedbacks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Public feedback service error:', error);
      throw error;
    }
  }

  async getPublicFeedbackById(id: string): Promise<any> {
    try {
      const data = await this.prisma.publicFeedback.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, name: true, role: true }
          }
        }
      });

      if (!data) {
        throw new NotFoundException('Public feedback not found');
      }

      const feedback = new PublicFeedbackModel();
      Object.assign(feedback, data);

      if (data.user) {
        (feedback as any).isExistingUser = true;
        (feedback as any).userInfo = data.user;
      }

      return feedback;
    } catch (error) {
      console.error('Get public feedback by id service error:', error);
      throw error;
    }
  }

  async updatePublicFeedbackStatus(
    feedbackId: string,
    status: PublicFeedbackStatus,
    adminNotes?: string
  ): Promise<any> {
    try {
      const updateData: any = {
        status: status as any,
        updatedAt: new Date(),
      };

      if (adminNotes !== undefined) {
        updateData.adminNotes = adminNotes;
      }

      // If status is resolved or reviewed, mark as responded
      if (status === PublicFeedbackStatus.RESOLVED || status === PublicFeedbackStatus.REVIEWED) {
        updateData.responded = true;
        updateData.respondedAt = new Date();
      }

      const data = await this.prisma.publicFeedback.update({
        where: { id: feedbackId },
        data: updateData,
      });

      const feedback = new PublicFeedbackModel();
      Object.assign(feedback, data);
      return feedback;
    } catch (error) {
      console.error('Update public feedback service error:', error);
      throw error;
    }
  }

  async getPublicFeedbackStats(): Promise<PublicFeedbackStats> {
    try {
      const allFeedback = await this.prisma.publicFeedback.findMany();

      const total = allFeedback.length;
      const pending = allFeedback.filter(f => f.status === 'pending').length;
      const reviewed = allFeedback.filter(f => f.status === 'reviewed').length;
      const resolved = allFeedback.filter(f => f.status === 'resolved').length;
      const archived = allFeedback.filter(f => f.status === 'archived').length;
      const responded = allFeedback.filter(f => f.responded).length;

      // Group by category manually for now
      const byCategory: Record<string, number> = {};
      allFeedback.forEach(item => {
        byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      });

      // Time periods
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = allFeedback.filter(f => new Date(f.createdAt) >= today).length;

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const thisWeekCount = allFeedback.filter(f => new Date(f.createdAt) >= weekStart).length;

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const thisMonthCount = allFeedback.filter(f => new Date(f.createdAt) >= monthStart).length;

      // Avg response time
      let totalResponseTime = 0;
      let responseCount = 0;
      allFeedback.forEach(feedback => {
        if (feedback.respondedAt && feedback.createdAt) {
          const responseTimeHours = (new Date(feedback.respondedAt).getTime() - new Date(feedback.createdAt).getTime()) / (1000 * 60 * 60);
          totalResponseTime += responseTimeHours;
          responseCount++;
        }
      });
      const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

      return {
        total,
        pending,
        reviewed,
        resolved,
        archived,
        byCategory,
        responded,
        today: todayCount,
        thisWeek: thisWeekCount,
        thisMonth: thisMonthCount,
        avgResponseTime: parseFloat(avgResponseTime.toFixed(2)),
      };
    } catch (error) {
      console.error('Get public feedback stats error:', error);
      throw error;
    }
  }

  async getPublicFeedbackByEmail(email: string): Promise<any[]> {
    try {
      const data = await this.prisma.publicFeedback.findMany({
        where: { email },
        orderBy: { createdAt: 'desc' }
      });

      return data.map(item => {
        const feedback = new PublicFeedbackModel();
        Object.assign(feedback, item);
        return feedback;
      });
    } catch (error) {
      console.error('Get public feedback by email service error:', error);
      throw error;
    }
  }

  async markPublicFeedbackAsSpam(id: string, reason?: string): Promise<any> {
    try {
      const data = await this.prisma.publicFeedback.update({
        where: { id },
        data: {
          status: PublicFeedbackStatus.ARCHIVED as any,
          adminNotes: `Marked as spam${reason ? `: ${reason}` : ''}`,
          updatedAt: new Date(),
        }
      });

      const feedback = new PublicFeedbackModel();
      Object.assign(feedback, data);
      return feedback;
    } catch (error) {
      console.error('Mark as spam service error:', error);
      throw error;
    }
  }

  async addAdminNoteToPublicFeedback(
    feedbackId: string,
    note: string,
    adminId: string
  ): Promise<any> {
    const current = await this.prisma.publicFeedback.findUnique({
      where: { id: feedbackId },
      select: { adminNotes: true }
    });

    const currentNotes = current?.adminNotes || '';
    const timestamp = new Date().toISOString();
    const newNote = `[${timestamp}] Admin ${adminId}: ${note}`;
    const updatedNotes = currentNotes ? `${currentNotes}\n${newNote}` : newNote;

    const data = await this.prisma.publicFeedback.update({
      where: { id: feedbackId },
      data: {
        adminNotes: updatedNotes,
        updatedAt: new Date()
      }
    });

    const feedback = new PublicFeedbackModel();
    Object.assign(feedback, data);
    return feedback;
  }

  // ================ COMBINED STATISTICS ================

  async getCombinedFeedbackStats(): Promise<any> {
    const [authStats, publicStats] = await Promise.all([
      this.getFeedbackStats(),
      this.getPublicFeedbackStats()
    ]);

    return {
      authenticated: authStats,
      public: publicStats,
      overall: {
        total: authStats.total + publicStats.total,
        pending: authStats.pending + publicStats.pending,
        avgResponseTime: publicStats.avgResponseTime ?? 0,
      },
    };
  }
}