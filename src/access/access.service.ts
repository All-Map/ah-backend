import { Injectable } from '@nestjs/common';
import { Access } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { PreviewUsageService } from 'src/preview/preview-usage.service';

@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private previewUsageService: PreviewUsageService,
  ) {}

  async createAccessRecord(data: {
    userId: string;
    expiresAt: Date;
    source: string;
    paystackReference?: string;
  }): Promise<Access> {
    if (data.paystackReference) {
      const existing = await this.prisma.access.findFirst({
        where: { paystackReference: data.paystackReference },
      });

      if (existing) {
        return this.prisma.access.update({
          where: { id: existing.id },
          data: {
            userId: data.userId,
            expiresAt: data.expiresAt,
            source: data.source,
          },
        });
      }
    }

    return this.prisma.access.create({
      data: {
        userId: data.userId,
        expiresAt: data.expiresAt,
        source: data.source,
        paystackReference: data.paystackReference,
      },
    });
  }

  async getUserActiveAccess(userId: string): Promise<Access | null> {
    const now = new Date();
    return this.prisma.access.findFirst({
      where: {
        userId,
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'desc' },
    });
  }

  async checkAccess(userId: string): Promise<{ active: boolean; expiry?: Date; previewUsed?: boolean }> {
    const now = new Date();

    const access = await this.prisma.access.findFirst({
      where: { userId },
      orderBy: { expiresAt: 'desc' },
    });

    if (access) {
      const expiresAt = new Date(access.expiresAt);
      const isActive = expiresAt > now;

      if (isActive) {
        return {
          active: true,
          expiry: expiresAt,
          previewUsed: false,
        };
      }
    }

    const previewUsed = await this.previewUsageService.hasUserUsedPreview(userId);

    return {
      active: false,
      previewUsed,
    };
  }

  async hasAccess(userId: string): Promise<boolean> {
    const { active } = await this.checkAccess(userId);
    return active;
  }

  async grantAccess(userId: string, days: number = 30, paystackReference?: string): Promise<Access> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    return this.createAccessRecord({
      userId,
      expiresAt,
      source: 'paystack',
      paystackReference,
    });
  }

  async getAccessByPaystackReference(paystackReference: string): Promise<Access | null> {
    return this.prisma.access.findUnique({
      where: { paystackReference },
    });
  }
}
