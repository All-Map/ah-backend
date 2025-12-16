import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { PreviewUsage } from '../entities/preview-usage.entity';

@Injectable()
export class PreviewUsageService {
  constructor(
    @InjectRepository(PreviewUsage)
    private readonly previewUsageRepository: Repository<PreviewUsage>,
  ) {}

  async hasUserUsedPreview(userId: string): Promise<boolean> {
    const usage = await this.previewUsageRepository.findOne({
      where: { userId },
      order: { usedAt: 'DESC' },
    });
    return !!usage;
  }

  async markPreviewAsUsed(data: {
    userId: string;
    source?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<PreviewUsage> {
    // Check if already used recently (within last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentUsage = await this.previewUsageRepository.findOne({
      where: {
        userId: data.userId,
        usedAt: MoreThan(twentyFourHoursAgo),
      },
    });

    if (recentUsage) {
      return recentUsage; // Already used preview recently
    }

    const previewUsage = this.previewUsageRepository.create({
      userId: data.userId,
      source: data.source || 'manual_unlock',
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata,
    });

    return this.previewUsageRepository.save(previewUsage);
  }

  async getPreviewUsageHistory(userId: string): Promise<PreviewUsage[]> {
    return this.previewUsageRepository.find({
      where: { userId },
      order: { usedAt: 'DESC' },
    });
  }

  // Add this method to get the last preview usage
  async getLastPreviewUsage(userId: string): Promise<PreviewUsage | null> {
    return this.previewUsageRepository.findOne({
      where: { userId },
      order: { usedAt: 'DESC' },
    });
  }

  async canUserAccessPreview(userId: string): Promise<{
    canAccess: boolean;
    reason?: string;
    lastUsage?: Date;
  }> {
    const usage = await this.hasUserUsedPreview(userId);
    
    if (usage) {
      const lastUsage = await this.getLastPreviewUsage(userId);
      
      return {
        canAccess: false,
        reason: 'preview_already_used',
        lastUsage: lastUsage?.usedAt,
      };
    }

    return { canAccess: true };
  }

  // Optional: Get preview usage statistics
  async getPreviewUsageStats(): Promise<{
    totalUses: number;
    bySource: Record<string, number>;
    byDay: Record<string, number>;
    uniqueUsers: number;
  }> {
    const allUsage = await this.previewUsageRepository.find();
    
    const stats = {
      totalUses: allUsage.length,
      bySource: {} as Record<string, number>,
      byDay: {} as Record<string, number>,
      uniqueUsers: new Set<string>(),
    };

    allUsage.forEach(usage => {
      // Count by source
      const source = usage.source || 'unknown';
      stats.bySource[source] = (stats.bySource[source] || 0) + 1;
      
      // Count by day
      const day = usage.usedAt.toISOString().split('T')[0];
      stats.byDay[day] = (stats.byDay[day] || 0) + 1;
      
      // Count unique users
      stats.uniqueUsers.add(usage.userId);
    });

    return {
      ...stats,
      uniqueUsers: stats.uniqueUsers.size,
    };
  }

  // Optional: Reset preview usage for testing/admin purposes
  async resetPreviewUsage(userId: string): Promise<void> {
    await this.previewUsageRepository.delete({ userId });
  }
}