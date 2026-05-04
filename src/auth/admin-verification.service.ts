import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminVerification } from '@prisma/client';
import { JwtUser } from './types/jwt-user';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AdminVerificationService {
  constructor(private readonly prisma: PrismaService, private readonly mailService: MailService) {}

  async createVerificationRequest(
    user: JwtUser, 
    data: any, 
    idDocuments: string[], 
    hostelProofDocuments: string[]
  ): Promise<AdminVerification> {
    const verificationData = {
      firstName: data.firstName,
      lastName: data.lastName,
      mobileNumber: data.mobileNumber,
      alternatePhone: data.alternatePhone,
      idType: data.idType,
      otherIdType: data.otherIdType,
      idNumber: data.idNumber,
      idDocuments: idDocuments,
      termsAccepted: data.termsAccepted === 'true' || data.termsAccepted === true,
      hostelProofType: data.hostelProofType,
      hostelProofDocuments: hostelProofDocuments,
      status: 'pending' as any,
      userId: user.id,
    };

    return await this.prisma.adminVerification.create({
      data: verificationData
    });
  }

  async getVerifications(status?: string): Promise<any[]> {
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    return await this.prisma.adminVerification.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            schoolId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async getPendingVerifications(): Promise<any[]> {
    return await this.prisma.adminVerification.findMany({
      where: { status: 'pending' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            schoolId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async updateVerificationStatus(
    id: string, 
    status: 'approved' | 'rejected', 
    reviewedBy: JwtUser,
    rejectionReason?: string
  ): Promise<AdminVerification> {
    const updateData: any = {
      status,
      reviewedBy: reviewedBy.id, // This matches the Prisma 'reviewedBy' field which is a UUID
      reviewedAt: new Date()
    };

    if (status === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const verification = await this.prisma.adminVerification.update({
      where: { id },
      data: updateData,
    });

    if (status === 'approved') {
      await this.prisma.user.update({
        where: { id: verification.userId },
        data: { role: 'hostel_admin' }
      });

      const user = await this.prisma.user.findUnique({
        where: { id: verification.userId },
        select: { email: true }
      });

      if (user && user.email) {
        await this.mailService.sendVerificationApproval(user.email);
      }
    } else if (status === 'rejected') {
      const user = await this.prisma.user.findUnique({
        where: { id: verification.userId },
        select: { email: true }
      });
      
      if (user && user.email) {
        await this.mailService.sendVerificationRejection(
          user.email, 
          rejectionReason ?? 'No reason provided'
        );
      }
    }

    return verification;
  }

  async getUserVerificationStatus(userId: string): Promise<AdminVerification | null> {
    return await this.prisma.adminVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }
}