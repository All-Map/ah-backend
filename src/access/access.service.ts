import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Access } from 'src/entities/access.entity';
import { PreviewUsageService } from 'src/preview/preview-usage.service';

@Injectable()
export class AccessService {
  constructor(
    @InjectRepository(Access)
    private accessRepository: Repository<Access>,
    private previewUsageService: PreviewUsageService, // Inject the preview service
  ) {}

  async createAccessRecord(data: {
    userId: string;
    expiresAt: Date;
    source: string;
    paystackReference?: string;
  }) {
    // Check if record with this reference already exists
    if (data.paystackReference) {
      const existing = await this.accessRepository.findOne({
        where: { paystackReference: data.paystackReference }
      });
      
      if (existing) {
        // Update existing record instead of creating new one
        existing.userId = data.userId;
        existing.expiresAt = data.expiresAt;
        existing.source = data.source;
        return this.accessRepository.save(existing);
      }
    }
    
    const accessRecord = this.accessRepository.create(data);
    return this.accessRepository.save(accessRecord);
  }

  async getUserActiveAccess(userId: string): Promise<Access | null> {
    const now = new Date();
    
    return this.accessRepository.findOne({
      where: {
        userId,
        expiresAt: new Date(now),
      } as any,
    });
  }

  async checkAccess(userId: string): Promise<{ active: boolean; expiry?: Date; previewUsed?: boolean }> {
    console.log(`Checking access for user: ${userId}`);
    
    const now = new Date();
    console.log(`Current time: ${now}`);
    
    // Try to find any access record for this user
    const access = await this.accessRepository.findOne({
      where: { userId },
      order: { expiresAt: 'DESC' } // Get the most recent
    });
    
    console.log(`Found access record:`, access);
    
    if (access) {
      const expiresAt = new Date(access.expiresAt);
      const isActive = expiresAt > now;
      
      console.log(`Access expires at: ${expiresAt}`);
      console.log(`Is active: ${isActive}`);
      
      if (isActive) {
        return { 
          active: true, 
          expiry: expiresAt,
          previewUsed: false 
        };
      }
    }
    
    // Check if preview was used
    const previewUsed = await this.previewUsageService.hasUserUsedPreview(userId);
    console.log(`No active access found for user ${userId}, preview used: ${previewUsed}`);
    
    return { 
      active: false,
      previewUsed 
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
    return this.accessRepository.findOne({
      where: { paystackReference }
    });
  }
}