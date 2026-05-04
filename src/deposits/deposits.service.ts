import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  Deposit,
  DepositStatus,
  DepositType,
  PaymentMethodEnum,
  PaymentTypeEnum,
  PaymentStatusEnum,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepositDto, VerifyDepositDto, DepositFilterDto, ApplyDepositToBookingDto } from './dto/deposit.dto';
import { PaystackService, PaystackVerificationResponse } from '../paystack/paystack.service';

function canRefundDeposit(deposit: Deposit): boolean {
  if (deposit.status !== DepositStatus.completed || !deposit.paymentDate) {
    return false;
  }
  const expired = deposit.expiresAt ? new Date() > deposit.expiresAt : false;
  if (expired) return false;
  return new Date().getTime() - deposit.paymentDate.getTime() <= 30 * 24 * 60 * 60 * 1000;
}

@Injectable()
export class DepositsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystackService: PaystackService,
  ) {}

  async createDeposit(createDepositDto: CreateDepositDto, userId: string): Promise<Deposit> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingDeposit = await this.prisma.deposit.findFirst({
      where: {
        paymentReference: createDepositDto.paymentReference,
        status: DepositStatus.pending,
      },
    });

    if (existingDeposit) {
      throw new ConflictException('A deposit with this payment reference is already being processed');
    }

    return this.prisma.deposit.create({
      data: {
        userId,
        status: DepositStatus.pending,
        amount: new Prisma.Decimal(createDepositDto.amount),
        depositType: createDepositDto.depositType ?? DepositType.account_credit,
        paymentReference: createDepositDto.paymentReference,
        notes: createDepositDto.notes,
      },
    });
  }

  async verifyDeposit(verifyDepositDto: VerifyDepositDto): Promise<{ deposit: Deposit; verified: boolean }> {
    const { reference, expectedAmount } = verifyDepositDto;

    const deposit = await this.prisma.deposit.findFirst({
      where: { paymentReference: reference },
      include: { user: true },
    });

    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    if (deposit.status === DepositStatus.completed) {
      return { deposit, verified: true };
    }

    if (deposit.status === DepositStatus.failed) {
      throw new BadRequestException('This deposit has failed and cannot be verified');
    }

    let verification: PaystackVerificationResponse;
    try {
      verification = await this.paystackService.verifyPayment(reference);
      this.paystackService.validatePayment(verification, expectedAmount);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          status: DepositStatus.failed,
          notes: `Verification failed: ${message}`,
        },
      });
      throw error;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          status: DepositStatus.completed,
          amount: new Prisma.Decimal(verification.data.amount / 100),
          paystackReference: verification.data.reference,
          transactionId: verification.data.id.toString(),
          paymentDate: new Date(verification.data.paid_at),
          verifiedAt: new Date(),
          paymentDetails: {
            channel: verification.data.channel,
            currency: verification.data.currency,
            customer: verification.data.customer,
            authorization: verification.data.authorization,
          } as Prisma.InputJsonValue,
        },
      });

      return { deposit: updated, verified: true };
    });
  }

  async canPayBookingFeeFromDeposit(userId: string): Promise<{
    canPay: boolean;
    availableBalance: number;
    requiredAmount: number;
    difference?: number;
  }> {
    const balance = await this.getUserDepositBalance(userId);
    const requiredAmount = 70;

    const canPay = balance.availableBalance >= requiredAmount;
    const result: {
      canPay: boolean;
      availableBalance: number;
      requiredAmount: number;
      difference?: number;
    } = {
      canPay,
      availableBalance: balance.availableBalance,
      requiredAmount,
    };

    if (!canPay) {
      result.difference = requiredAmount - balance.availableBalance;
    }

    return result;
  }

  async getUserDeposits(
    userId: string,
    filterDto: DepositFilterDto = {},
  ): Promise<{ deposits: Deposit[]; total: number }> {
    const { page = 1, limit = 10, status, depositType, startDate, endDate } = filterDto;

    const where: Prisma.DepositWhereInput = { userId };
    if (status) where.status = status;
    if (depositType) where.depositType = depositType;
    if (startDate && endDate) {
      where.createdAt = {
        gte: startDate,
        lte: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000),
      };
    }

    const [deposits, total] = await Promise.all([
      this.prisma.deposit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.deposit.count({ where }),
    ]);

    return { deposits, total };
  }

  async getUserDepositBalance(userId: string): Promise<{
    totalBalance: number;
    availableBalance: number;
    pendingDeposits: number;
    depositBreakdown: {
      completed: number;
      pending: number;
      failed: number;
    };
  }> {
    const grouped = await this.prisma.deposit.groupBy({
      by: ['status'],
      where: { userId },
      _sum: { amount: true },
    });

    let totalBalance = 0;
    let availableBalance = 0;
    let pendingDeposits = 0;
    const breakdown = {
      completed: 0,
      pending: 0,
      failed: 0,
    };

    for (const row of grouped) {
      const amount = Number(row._sum.amount ?? 0);
      switch (row.status) {
        case DepositStatus.completed:
          totalBalance += amount;
          availableBalance += amount;
          breakdown.completed = amount;
          break;
        case DepositStatus.pending:
          pendingDeposits += amount;
          breakdown.pending = amount;
          break;
        case DepositStatus.failed:
          breakdown.failed = amount;
          break;
        default:
          break;
      }
    }

    return {
      totalBalance,
      availableBalance,
      pendingDeposits,
      depositBreakdown: breakdown,
    };
  }

  async applyDepositToBooking(
    applyDto: ApplyDepositToBookingDto,
    userId: string,
  ): Promise<{ deposit: Deposit; booking: Prisma.BookingGetPayload<object>; appliedAmount: number }> {
    const { bookingId, amount } = applyDto;

    return this.prisma.$transaction(async (tx) => {
      const balance = await this.computeDepositBalanceTx(tx, userId);
      if (balance.availableBalance < amount) {
        throw new BadRequestException('Insufficient deposit balance');
      }

      const booking = await tx.booking.findFirst({
        where: { id: bookingId, studentId: userId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status === 'cancelled' || booking.status === 'checked_out') {
        throw new BadRequestException('Cannot apply deposit to cancelled or checked out booking');
      }

      const remainingBalance = Number(booking.amountDue);
      const appliedAmount = Math.min(amount, remainingBalance);

      if (appliedAmount <= 0) {
        throw new BadRequestException('No amount due for this booking');
      }

      const paymentReference = `booking_${bookingId}_${Date.now()}`;

      const savedDeposit = await tx.deposit.create({
        data: {
          userId,
          amount: new Prisma.Decimal(-appliedAmount),
          status: DepositStatus.completed,
          depositType: DepositType.room_balance,
          paymentReference,
          notes: `Applied to booking ${bookingId}`,
          paymentDate: new Date(),
          verifiedAt: new Date(),
        },
      });

      const currentAmountPaid = Number(booking.amountPaid) || 0;
      const newAmountPaid = currentAmountPaid + appliedAmount;
      const totalAmt = Number(booking.totalAmount);
      let paymentStatus: PaymentStatusEnum = booking.paymentStatus;
      const newAmountDue = Math.max(0, totalAmt - newAmountPaid);

      if (newAmountDue <= 0) {
        paymentStatus = PaymentStatusEnum.paid;
      } else if (newAmountPaid > 0) {
        paymentStatus = PaymentStatusEnum.partial;
      }

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          amountPaid: new Prisma.Decimal(newAmountPaid),
          amountDue: new Prisma.Decimal(newAmountDue),
          paymentStatus,
        },
      });

      await tx.payment.create({
        data: {
          bookingId,
          amount: new Prisma.Decimal(appliedAmount),
          paymentMethod: PaymentMethodEnum.account_credit,
          paymentType: PaymentTypeEnum.booking_payment,
          transactionRef: paymentReference,
          notes: 'Paid from deposit balance',
        },
      });

      return {
        deposit: savedDeposit,
        booking: updatedBooking,
        appliedAmount,
      };
    });
  }

  private async computeDepositBalanceTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<{ availableBalance: number }> {
    const grouped = await tx.deposit.groupBy({
      by: ['status'],
      where: { userId },
      _sum: { amount: true },
    });

    let availableBalance = 0;
    for (const row of grouped) {
      if (row.status === DepositStatus.completed) {
        availableBalance += Number(row._sum.amount ?? 0);
      }
    }
    return { availableBalance };
  }

  async getDepositById(id: string, userId?: string): Promise<Deposit> {
    const where: Prisma.DepositWhereInput = { id };
    if (userId) where.userId = userId;

    const deposit = await this.prisma.deposit.findFirst({
      where,
    });

    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    return deposit;
  }

  async refundDeposit(depositId: string, reason?: string): Promise<Deposit> {
    const deposit = await this.getDepositById(depositId);

    if (deposit.status !== DepositStatus.completed) {
      throw new BadRequestException('Only completed deposits can be refunded');
    }

    if (!canRefundDeposit(deposit)) {
      throw new BadRequestException('This deposit cannot be refunded (expired or outside refund period)');
    }

    return this.prisma.deposit.update({
      where: { id: depositId },
      data: {
        status: DepositStatus.refunded,
        notes: reason ? `Refunded: ${reason}` : 'Deposit refunded',
      },
    });
  }

  async cleanupExpiredDeposits(): Promise<{ cleaned: number }> {
    const now = new Date();
    const result = await this.prisma.deposit.updateMany({
      where: {
        status: DepositStatus.pending,
        expiresAt: { lt: now },
      },
      data: {
        status: DepositStatus.failed,
        notes: 'Deposit expired - payment not completed',
      },
    });

    return { cleaned: result.count };
  }
}
