import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PreviewUsageService } from '../../preview/preview-usage.service';
import { Prisma } from '@prisma/client';

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
  paystackReference?: string | null;
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
  source: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AccessManagementService {
  constructor(
    private readonly prisma: PrismaService,
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
    const now = new Date();

    const where: Prisma.AccessWhereInput = {};

    if (filter.source) {
      where.source = filter.source;
    }

    if (filter.status === 'active') {
      where.expiresAt = { gt: now };
    } else if (filter.status === 'expired') {
      where.expiresAt = { lte: now };
    } else if (filter.status === 'upcoming') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      where.expiresAt = { gt: now, lte: thirtyDaysFromNow };
    }

    if (filter.search) {
      where.OR = [
        { user: { name: { contains: filter.search, mode: 'insensitive' } } },
        { user: { email: { contains: filter.search, mode: 'insensitive' } } },
        { paystackReference: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const [accessRows, total] = await Promise.all([
      this.prisma.access.findMany({
        where,
        include: { user: true },
        orderBy: { expiresAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.access.count({ where }),
    ]);

    const transformedRecords: AccessRecord[] = accessRows.map((record) => {
      const expiresAt = new Date(record.expiresAt);
      const isExpired = expiresAt <= now;
      const isUpcoming =
        !isExpired && expiresAt <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      let status: 'active' | 'expired' | 'upcoming' = 'active';
      if (isExpired) status = 'expired';
      else if (isUpcoming) status = 'upcoming';

      const daysRemaining = isExpired
        ? 0
        : Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: record.id,
        userId: record.userId,
        user: {
          id: record.user.id,
          name: record.user.name ?? '',
          email: record.user.email,
          role: record.user.role,
        },
        expiresAt: record.expiresAt,
        createdAt: record.createdAt,
        source: record.source,
        paystackReference: record.paystackReference,
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

    const [totalAccess, activeAccess, expiredAccess, upcomingExpiry, bySourceRows, allUsers] =
      await Promise.all([
        this.prisma.access.count(),
        this.prisma.access.count({ where: { expiresAt: { gt: now } } }),
        this.prisma.access.count({ where: { expiresAt: { lte: now } } }),
        this.prisma.access.count({
          where: { expiresAt: { gt: now, lte: thirtyDaysFromNow } },
        }),
        this.prisma.access.groupBy({
          by: ['source'],
          _count: true,
        }),
        this.prisma.user.count(),
      ]);

    const distinctActiveUsers = await this.prisma.access.findMany({
      where: { expiresAt: { gt: now } },
      distinct: ['userId'],
      select: { userId: true },
    });

    const sourceStats = bySourceRows.reduce(
      (acc, row) => {
        acc[row.source] = row._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    const usersWithAccessCount = distinctActiveUsers.length;
    const estimatedMonthlyRecurringRevenue = activeAccess * 30;
    const conversionRate = allUsers > 0 ? (usersWithAccessCount / allUsers) * 100 : 0;

    return {
      totalAccess,
      activeAccess,
      expiredAccess,
      upcomingExpiry,
      bySource: sourceStats,
      totalRevenue: activeAccess * 30,
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

    const [rows, total] = await Promise.all([
      this.prisma.previewUsage.findMany({
        include: { user: true },
        orderBy: { usedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.previewUsage.count(),
    ]);

    const records: PreviewUsageRecord[] = rows.map((preview) => ({
      id: preview.id,
      userId: preview.userId,
      user: {
        id: preview.user.id,
        name: preview.user.name ?? '',
        email: preview.user.email,
      },
      usedAt: preview.usedAt,
      source: preview.source,
      ipAddress: preview.ipAddress,
      userAgent: preview.userAgent,
    }));

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
    const [accessHistoryRows, previewHistoryRows] = await Promise.all([
      this.prisma.access.findMany({
        where: { userId },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.previewUsage.findMany({
        where: { userId },
        include: { user: true },
        orderBy: { usedAt: 'desc' },
      }),
    ]);

    const now = new Date();

    const accessHistory: AccessRecord[] = accessHistoryRows.map((record) => {
      const expiresAt = new Date(record.expiresAt);
      const isExpired = expiresAt <= now;
      const daysRemaining = isExpired
        ? 0
        : Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: record.id,
        userId: record.userId,
        user: {
          id: record.user.id,
          name: record.user.name ?? '',
          email: record.user.email,
          role: record.user.role,
        },
        expiresAt: record.expiresAt,
        createdAt: record.createdAt,
        source: record.source,
        paystackReference: record.paystackReference,
        status: isExpired ? 'expired' : 'active',
        daysRemaining,
      };
    });

    const previewHistory: PreviewUsageRecord[] = previewHistoryRows.map((preview) => ({
      id: preview.id,
      userId: preview.userId,
      user: {
        id: preview.user.id,
        name: preview.user.name ?? '',
        email: preview.user.email,
      },
      usedAt: preview.usedAt,
      source: preview.source,
      ipAddress: preview.ipAddress,
      userAgent: preview.userAgent,
    }));

    const currentAccess = accessHistory.find((a) => a.status === 'active');

    return {
      accessHistory,
      previewHistory,
      currentAccess: currentAccess
        ? {
            ...currentAccess,
            status: 'active' as const,
            daysRemaining: currentAccess.daysRemaining,
          }
        : undefined,
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

    const [currentAccess, previousAccess, revenueBySource] = await Promise.all([
      this.prisma.access.findMany({
        where: {
          createdAt: { gte: startDate, lte: now },
          source: 'paystack',
        },
      }),
      this.prisma.access.findMany({
        where: {
          createdAt: { gte: previousStartDate, lte: previousEndDate },
          source: 'paystack',
        },
      }),
      this.prisma.access.groupBy({
        by: ['source'],
        where: {
          createdAt: { gte: startDate, lte: now },
          source: { in: ['paystack', 'manual_grant', 'free_trial'] },
        },
        _count: true,
      }),
    ]);

    const currentRevenue = currentAccess.length * 30;
    const previousRevenue = previousAccess.length * 30;
    const growth =
      previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : currentRevenue > 0
          ? 100
          : 0;

    const bySource = revenueBySource.reduce(
      (acc, row) => {
        acc[row.source] = row._count * 30;
        return acc;
      },
      {} as Record<string, number>,
    );

    const monthlyRevenue: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthAccess = await this.prisma.access.count({
        where: {
          createdAt: { gte: monthStart, lte: monthEnd },
          source: 'paystack',
        },
      });

      const monthKey = monthStart.toISOString().substring(0, 7);
      monthlyRevenue[monthKey] = monthAccess * 30;
    }

    const activePaystackAccess = await this.prisma.access.count({
      where: {
        expiresAt: { gt: now },
        source: 'paystack',
      },
    });

    return {
      total: currentRevenue,
      thisMonth: currentRevenue,
      lastMonth: previousRevenue,
      growth: Math.round(growth * 10) / 10,
      bySource,
      byMonth: monthlyRevenue,
      estimatedMonthlyRecurring: activePaystackAccess * 30,
    };
  }

  async grantManualAccess(
    userId: string,
    days: number = 30,
    source: string = 'manual_grant',
  ): Promise<AccessRecord> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const savedRecord = await this.prisma.access.create({
      data: {
        userId,
        expiresAt,
        source,
      },
    });

    return {
      id: savedRecord.id,
      userId: savedRecord.userId,
      user: {
        id: user.id,
        name: user.name ?? '',
        email: user.email,
        role: user.role,
      },
      expiresAt: savedRecord.expiresAt,
      createdAt: savedRecord.createdAt,
      source: savedRecord.source,
      paystackReference: savedRecord.paystackReference,
      status: 'active',
      daysRemaining: days,
    };
  }

  async extendAccess(id: string, days: number = 30): Promise<AccessRecord> {
    const access = await this.prisma.access.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!access) {
      throw new NotFoundException('Access record not found');
    }

    const newExpiry = new Date(access.expiresAt);
    newExpiry.setDate(newExpiry.getDate() + days);

    const updatedAccess = await this.prisma.access.update({
      where: { id },
      data: { expiresAt: newExpiry },
    });

    const now = new Date();
    const daysRemaining = Math.ceil((newExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: updatedAccess.id,
      userId: updatedAccess.userId,
      user: {
        id: access.user.id,
        name: access.user.name ?? '',
        email: access.user.email,
        role: access.user.role,
      },
      expiresAt: updatedAccess.expiresAt,
      createdAt: updatedAccess.createdAt,
      source: updatedAccess.source,
      paystackReference: updatedAccess.paystackReference,
      status: newExpiry > now ? 'active' : 'expired',
      daysRemaining,
    };
  }

  async revokeAccess(id: string): Promise<{ message: string }> {
    const access = await this.prisma.access.findUnique({ where: { id } });

    if (!access) {
      throw new NotFoundException('Access record not found');
    }

    await this.prisma.access.update({
      where: { id },
      data: { expiresAt: new Date() },
    });

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

    const rows = records.map((record) => [
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

    return [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join(
      '\n',
    );
  }
}
