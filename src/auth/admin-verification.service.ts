import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminVerification, AgentPayoutMethod, Prisma } from '@prisma/client';
import { JwtUser } from './types/jwt-user';
import { MailService } from 'src/mail/mail.service';

interface PayoutDestination {
  // momo
  provider?: 'mtn' | 'vodafone' | 'airteltigo' | string;
  phone?: string;
  // bank
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  // both
  accountName?: string;
}

@Injectable()
export class AdminVerificationService {
  constructor(private readonly prisma: PrismaService, private readonly mailService: MailService) {}

  /**
   * Validate and normalise the agent's payout destination.
   * Throws BadRequestException with a clear message if required fields are missing.
   */
  private parsePayoutDetails(
    method: AgentPayoutMethod,
    raw: any,
  ): PayoutDestination {
    let parsed: PayoutDestination = raw ?? {};
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new BadRequestException('payoutDetails must be valid JSON');
      }
    }

    if (method === 'momo') {
      if (!parsed.provider) throw new BadRequestException('Mobile money provider is required');
      if (!parsed.phone) throw new BadRequestException('Mobile money phone number is required');
      if (!parsed.accountName) throw new BadRequestException('Account holder name is required');
      return {
        provider: parsed.provider,
        phone: parsed.phone,
        accountName: parsed.accountName,
      };
    }

    if (method === 'bank') {
      if (!parsed.bankName) throw new BadRequestException('Bank name is required');
      if (!parsed.accountNumber) throw new BadRequestException('Bank account number is required');
      if (!parsed.accountName) throw new BadRequestException('Account holder name is required');
      return {
        bankName: parsed.bankName,
        bankCode: parsed.bankCode,
        accountNumber: parsed.accountNumber,
        accountName: parsed.accountName,
      };
    }

    throw new BadRequestException('payoutMethod must be either "momo" or "bank"');
  }

  async createVerificationRequest(
    user: JwtUser,
    data: any,
    idDocuments: string[],
    hostelProofDocuments: string[]
  ): Promise<AdminVerification> {
    if (!data.payoutMethod) {
      throw new BadRequestException('Payout method is required for verification');
    }

    const payoutDetails = this.parsePayoutDetails(
      data.payoutMethod as AgentPayoutMethod,
      data.payoutDetails,
    );

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
      payoutMethod: data.payoutMethod as AgentPayoutMethod,
      payoutDetails: payoutDetails as unknown as Prisma.InputJsonValue,
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
      // Promote to hostel_admin AND mirror the verified payout destination onto
      // the User record so commissions/payouts have a single source of truth.
      await this.prisma.user.update({
        where: { id: verification.userId },
        data: {
          role: 'hostel_admin',
          ...(verification.payoutMethod
            ? {
                payoutMethod: verification.payoutMethod,
                payoutDetails: verification.payoutDetails as Prisma.InputJsonValue,
              }
            : {}),
        },
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