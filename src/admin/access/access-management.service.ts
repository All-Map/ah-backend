// src/admin/access/access-management.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan, Like, IsNull, Not } from 'typeorm';
import { Access } from '../../entities/access.entity';
import { User } from '../../entities/user.entity';
import { PreviewUsage } from '../../entities/preview-usage.entity';
import { PreviewUsageService } from '../../preview/preview-usage.service';

export interface AccessRecord {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  expiresAt: Date;
  createdAt: Date;
  source: string;
  paystackReference?: string;
  status: 'active' | 'expired' | 'upcoming';
  daysRemaining: number;
}

export interface AccessStats {
  totalAccess: number;
  activeAccess: number;
  expiredAccess: number;
  upcomingExpiry: number;
  bySource: Record<string, number>;
  totalRevenue: number;
  estimatedMonthlyRecurringRevenue: number;
  usersWithAccess: number;
  usersWithoutAccess: number;
  conversionRate: number;
}

export interface RevenueStats {
  total: number;
  thisMonth: number;
  lastMonth: number;
  growth: number;
  bySource: Record<string, number>;
  byMonth: Record<string, number>;
  estimatedMonthlyRecurring: number;
}

export interface PreviewUsageRecord {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  usedAt: Date;
  source: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AccessManagementService {
  constructor(
    @InjectRepository(Access)
    private readonly accessRepository: Repository<Access>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PreviewUsage)
    private readonly previewUsageRepository: Repository<PreviewUsage>,
    private readonly previewUsageService: PreviewUsageService,
  ) {}

  async getAccessRecords(filter: {
    page?: number;
    limit?: number;
    search?: string;
    source?: string;
    status?: 'active' | 'expired' | 'upcoming';
  }): Promise<{
    records: AccessRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.accessRepository
      .createQueryBuilder('access')
      .leftJoinAndSelect('access.user', 'user')
      .select([
        'access.id',
        'access.userId',
        'access.expiresAt',
        'access.createdAt',
        'access.source',
        'access.paystackReference',
        'user.id',
        'user.name',
        'user.email',
        'user.role',
      ]);

    // Apply filters
    if (filter.source) {
      queryBuilder.andWhere('access.source = :source', { source: filter.source });
    }

    if (filter.search) {
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR access.paystackReference ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    const now = new Date();

    if (filter.status === 'active') {
      queryBuilder.andWhere('access.expiresAt > :now', { now });
    } else if (filter.status === 'expired') {
      queryBuilder.andWhere('access.expiresAt <= :now', { now });
    } else if (filter.status === 'upcoming') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      queryBuilder.andWhere('access.expiresAt > :now', { now });
      queryBuilder.andWhere('access.expiresAt <= :thirtyDaysFromNow', { thirtyDaysFromNow });
    }

    // Apply pagination
    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('access.expiresAt', 'DESC');

    const [records, total] = await queryBuilder.getManyAndCount();

    // Transform records with additional calculated fields
    const transformedRecords = records.map(record => {
      const expiresAt = new Date(record.expiresAt);
      const isExpired = expiresAt <= now;
      const isUpcoming = !isExpired && expiresAt <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      let status: 'active' | 'expired' | 'upcoming' = 'active';
      if (isExpired) status = 'expired';
      else if (isUpcoming) status = 'upcoming';

      const daysRemaining = isExpired 
        ? 0 
        : Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...record,
        status,
        daysRemaining,
      };
    });

    return {
      records: transformedRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAccessStats(): Promise<AccessStats> {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalAccess,
      activeAccess,
      expiredAccess,
      upcomingExpiry,
      bySource,
      allUsers,
      usersWithAccess,
    ] = await Promise.all([
      this.accessRepository.count(),
      this.accessRepository.count({ where: { expiresAt: MoreThan(now) } }),
      this.accessRepository.count({ where: { expiresAt: LessThan(now) } }),
      this.accessRepository.count({
        where: {
          expiresAt: Between(now, thirtyDaysFromNow),
        },
      }),
      this.accessRepository
        .createQueryBuilder('access')
        .select('access.source, COUNT(*) as count')
        .groupBy('access.source')
        .getRawMany(),
      this.userRepository.count(),
      this.accessRepository
        .createQueryBuilder('access')
        .select('COUNT(DISTINCT access.userId) as count')
        .where('access.expiresAt > :now', { now })
        .getRawOne(),
    ]);

    const sourceStats = bySource.reduce((acc, row) => {
      acc[row.access_source] = parseInt(row.count);
      return acc;
    }, {} as Record<string, number>);

    // Calculate estimated revenue (assuming $30 per access)
    const activeAccessCount = activeAccess || 0;
    const estimatedMonthlyRecurringRevenue = activeAccessCount * 30;

    // Calculate conversion rate
    const usersWithAccessCount = parseInt(usersWithAccess?.count) || 0;
    const conversionRate = allUsers > 0 ? (usersWithAccessCount / allUsers) * 100 : 0;

    return {
      totalAccess,
      activeAccess,
      expiredAccess,
      upcomingExpiry,
      bySource: sourceStats,
      totalRevenue: activeAccessCount * 30, // Assuming $30 per active access
      estimatedMonthlyRecurringRevenue,
      usersWithAccess: usersWithAccessCount,
      usersWithoutAccess: allUsers - usersWithAccessCount,
      conversionRate: Math.round(conversionRate * 10) / 10,
    };
  }

  async getPreviewUsage(page: number = 1, limit: number = 20): Promise<{
    records: PreviewUsageRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.previewUsageRepository
      .createQueryBuilder('preview')
      .leftJoinAndSelect('preview.user', 'user')
      .select([
        'preview.id',
        'preview.userId',
        'preview.usedAt',
        'preview.source',
        'preview.ipAddress',
        'preview.userAgent',
        'user.id',
        'user.name',
        'user.email',
      ])
      .orderBy('preview.usedAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [records, total] = await queryBuilder.getManyAndCount();

    return {
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPreviewUsageStats() {
    return this.previewUsageService.getPreviewUsageStats();
  }

  async getUserAccessHistory(userId: string): Promise<{
    accessHistory: AccessRecord[];
    previewHistory: PreviewUsageRecord[];
    currentAccess?: AccessRecord;
    hasActiveAccess: boolean;
  }> {
    const [accessHistory, previewHistory] = await Promise.all([
      this.accessRepository.find({
        where: { userId },
        relations: ['user'],
        order: { createdAt: 'DESC' },
      }),
      this.previewUsageRepository.find({
        where: { userId },
        relations: ['user'],
        order: { usedAt: 'DESC' },
      }),
    ]);

    const now = new Date();
    const currentAccess = accessHistory.find(access => 
      new Date(access.expiresAt) > now
    );

    const transformedAccessHistory = accessHistory.map(record => {
      const expiresAt = new Date(record.expiresAt);
      const isExpired = expiresAt <= now;
      const daysRemaining = isExpired 
        ? 0 
        : Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const status: 'active' | 'expired' = isExpired ? 'expired' : 'active';

      return {
        ...record,
        status,
        daysRemaining,
      };
    });

    return {
      accessHistory: transformedAccessHistory,
      previewHistory,
      currentAccess: currentAccess ? {
        ...currentAccess,
        status: 'active' as const,
        daysRemaining: Math.ceil((new Date(currentAccess.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      } : undefined,
      hasActiveAccess: !!currentAccess,
    };
  }

  async getRevenueStats(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<RevenueStats> {
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    let previousEndDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 1);
        previousEndDate = new Date(startDate);
        break;
      
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 7);
        previousEndDate = new Date(startDate);
        break;
      
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
    }

    // Get active access records created in the period
    const currentAccess = await this.accessRepository.find({
      where: {
        createdAt: Between(startDate, now),
        source: 'paystack', // Only count paid access for revenue
      },
    });

    const previousAccess = await this.accessRepository.find({
      where: {
        createdAt: Between(previousStartDate, previousEndDate),
        source: 'paystack',
      },
    });

    // Calculate revenue (assuming $30 per access)
    const currentRevenue = currentAccess.length * 30;
    const previousRevenue = previousAccess.length * 30;
    const growth = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : currentRevenue > 0 ? 100 : 0;

    // Get revenue by source
    const revenueBySource = await this.accessRepository
      .createQueryBuilder('access')
      .select('access.source, COUNT(*) as count')
      .where('access.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate: now,
      })
      .andWhere('access.source IN (:...sources)', {
        sources: ['paystack', 'manual_grant', 'free_trial'],
      })
      .groupBy('access.source')
      .getRawMany();

    const bySource = revenueBySource.reduce((acc, row) => {
      acc[row.access_source] = parseInt(row.count) * 30; // $30 per access
      return acc;
    }, {} as Record<string, number>);

    // Get monthly revenue for last 6 months
    const monthlyRevenue: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthAccess = await this.accessRepository.count({
        where: {
          createdAt: Between(monthStart, monthEnd),
          source: 'paystack',
        },
      });

      const monthKey = monthStart.toISOString().substring(0, 7);
      monthlyRevenue[monthKey] = monthAccess * 30;
    }

    // Estimated monthly recurring revenue (active paystack subscriptions)
    const activePaystackAccess = await this.accessRepository.count({
      where: {
        expiresAt: MoreThan(now),
        source: 'paystack',
      },
    });

    const estimatedMonthlyRecurring = activePaystackAccess * 30;

    return {
      total: currentRevenue,
      thisMonth: currentRevenue,
      lastMonth: previousRevenue,
      growth: Math.round(growth * 10) / 10,
      bySource,
      byMonth: monthlyRevenue,
      estimatedMonthlyRecurring,
    };
  }

  async grantManualAccess(userId: string, days: number = 30, source: string = 'manual_grant'): Promise<AccessRecord> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const accessRecord = this.accessRepository.create({
      userId,
      expiresAt,
      source,
      createdAt: new Date(),
    });

    const savedRecord = await this.accessRepository.save(accessRecord);

    return {
      ...savedRecord,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      status: 'active',
      daysRemaining: days,
    };
  }

  async extendAccess(id: string, days: number = 30): Promise<AccessRecord> {
    const access = await this.accessRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!access) {
      throw new NotFoundException('Access record not found');
    }

    const newExpiry = new Date(access.expiresAt);
    newExpiry.setDate(newExpiry.getDate() + days);

    access.expiresAt = newExpiry;
    const updatedAccess = await this.accessRepository.save(access);

    const now = new Date();
    const daysRemaining = Math.ceil((newExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      ...updatedAccess,
      status: newExpiry > now ? 'active' : 'expired',
      daysRemaining,
    };
  }

  async revokeAccess(id: string): Promise<{ message: string }> {
    const access = await this.accessRepository.findOne({ where: { id } });

    if (!access) {
      throw new NotFoundException('Access record not found');
    }

    // Set expiry to now
    access.expiresAt = new Date();
    await this.accessRepository.save(access);

    return { message: 'Access revoked successfully' };
  }

  async exportAccessRecords(
    search?: string,
    source?: string,
    status?: 'active' | 'expired' | 'upcoming',
  ): Promise<string> {
    const { records } = await this.getAccessRecords({
      limit: 1000,
      search,
      source,
      status,
    });

    const headers = [
      'User ID',
      'Name',
      'Email',
      'Role',
      'Access Type',
      'Reference',
      'Purchase Date',
      'Expiry Date',
      'Status',
      'Days Remaining',
      'Source',
    ];

    const rows = records.map(record => [
      record.user.id,
      record.user.name || '',
      record.user.email,
      record.user.role,
      record.paystackReference ? 'Paid' : 'Manual',
      record.paystackReference || '',
      record.createdAt.toISOString(),
      record.expiresAt.toISOString(),
      record.status,
      record.daysRemaining.toString(),
      record.source,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }
}