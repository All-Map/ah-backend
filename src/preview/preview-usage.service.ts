import { Injectable } from '@nestjs/common';
import { PreviewUsage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PreviewUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async hasUserUsedPreview(userId: string): Promise<boolean> {
    const usage = await this.prisma.previewUsage.findFirst({
      where: { userId },
      orderBy: { usedAt: 'desc' },
    });
    return !!usage;
  }

  async markPreviewAsUsed(data: {
    userId: string;
    source?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PreviewUsage> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentUsage = await this.prisma.previewUsage.findFirst({
      where: {
        userId: data.userId,
        usedAt: { gt: twentyFourHoursAgo },
      },
    });

    if (recentUsage) {
      return recentUsage;
    }

    return this.prisma.previewUsage.create({
      data: {
        userId: data.userId,
        source: data.source ?? 'manual_unlock',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata as object | undefined,
      },
    });
  }

  async getPreviewUsageHistory(userId: string): Promise<PreviewUsage[]> {
    return this.prisma.previewUsage.findMany({
      where: { userId },
      orderBy: { usedAt: 'desc' },
    });
  }

  async getLastPreviewUsage(userId: string): Promise<PreviewUsage | null> {
    return this.prisma.previewUsage.findFirst({
      where: { userId },
      orderBy: { usedAt: 'desc' },
    });
  }

  async canUserAccessPreview(userId: string): Promise<{
    canAccess: boolean;
    reason?: string;
    lastUsage?: Date;
  }> {
    const used = await this.hasUserUsedPreview(userId);

    if (used) {
      const lastUsage = await this.getLastPreviewUsage(userId);

      return {
        canAccess: false,
        reason: 'preview_already_used',
        lastUsage: lastUsage?.usedAt,
      };
    }

    return { canAccess: true };
  }

  async getPreviewUsageStats(): Promise<{
    totalUses: number;
    bySource: Record<string, number>;
    byDay: Record<string, number>;
    uniqueUsers: number;
  }> {
    const allUsage = await this.prisma.previewUsage.findMany();

    const stats = {
      totalUses: allUsage.length,
      bySource: {} as Record<string, number>,
      byDay: {} as Record<string, number>,
      uniqueUsers: new Set<string>(),
    };

    allUsage.forEach((usage) => {
      const source = usage.source || 'unknown';
      stats.bySource[source] = (stats.bySource[source] || 0) + 1;

      const day = usage.usedAt.toISOString().split('T')[0];
      stats.byDay[day] = (stats.byDay[day] || 0) + 1;

      stats.uniqueUsers.add(usage.userId);
    });

    return {
      ...stats,
      uniqueUsers: stats.uniqueUsers.size,
    };
  }

  async resetPreviewUsage(userId: string): Promise<void> {
    await this.prisma.previewUsage.deleteMany({ where: { userId } });
  }
}
