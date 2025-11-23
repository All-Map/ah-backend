import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Deposit, DepositStatus, DepositType } from '../entities/deposit.entity';
import { User } from '../entities/user.entity';
import { CreateDepositDto, VerifyDepositDto, DepositFilterDto, ApplyDepositToBookingDto } from './dto/deposit.dto';
import { PaystackService, PaystackVerificationResponse } from '../paystack/paystack.service';
import { Booking, PaymentStatus } from '../entities/booking.entity';
import { Payment, PaymentMethod, PaymentType } from '../entities/payment.entity';

@Injectable()
export class DepositsService {
  constructor(
    @InjectRepository(Deposit)
    private readonly depositRepository: Repository<Deposit>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly dataSource: DataSource,
    private readonly paystackService: PaystackService,
  ) {}

  async createDeposit(createDepositDto: CreateDepositDto, userId: string): Promise<Deposit> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check for existing pending deposit with same reference
    const existingDeposit = await this.depositRepository.findOne({
      where: {
        paymentReference: createDepositDto.paymentReference,
        status: DepositStatus.PENDING,
      },
    });

    if (existingDeposit) {
      throw new ConflictException('A deposit with this payment reference is already being processed');
    }

    const deposit = this.depositRepository.create({
      ...createDepositDto,
      userId,
      status: DepositStatus.PENDING,
    });

    return await this.depositRepository.save(deposit);
  }

  async verifyDeposit(verifyDepositDto: VerifyDepositDto): Promise<{ deposit: Deposit; verified: boolean }> {
    const { reference, expectedAmount } = verifyDepositDto;

    // Find the deposit
    const deposit = await this.depositRepository.findOne({
      where: { paymentReference: reference },
      relations: ['user'],
    });

    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    if (deposit.status === DepositStatus.COMPLETED) {
      return { deposit, verified: true };
    }

    if (deposit.status === DepositStatus.FAILED) {
      throw new BadRequestException('This deposit has failed and cannot be verified');
    }

    // Verify with Paystack
    let verification: PaystackVerificationResponse;
    try {
      verification = await this.paystackService.verifyPayment(reference);
      this.paystackService.validatePayment(verification, expectedAmount);
    } catch (error) {
      // Mark as failed if verification fails
      deposit.status = DepositStatus.FAILED;
      deposit.notes = `Verification failed: ${error.message}`;
      await this.depositRepository.save(deposit);
      throw error;
    }

    // Update deposit with successful payment details
    return await this.dataSource.transaction(async manager => {
      deposit.status = DepositStatus.COMPLETED;
      deposit.amount = verification.data.amount / 100; // Update with actual amount paid
      deposit.paystackReference = verification.data.reference;
      deposit.transactionId = verification.data.id.toString();
      deposit.paymentDate = new Date(verification.data.paid_at);
      deposit.verifiedAt = new Date();
      deposit.paymentDetails = {
        channel: verification.data.channel,
        currency: verification.data.currency,
        customer: verification.data.customer,
        authorization: verification.data.authorization,
      };

      const updatedDeposit = await manager.save(Deposit, deposit);

      return { deposit: updatedDeposit, verified: true };
    });
  }

  // In deposits.service.ts - add this method
async canPayBookingFeeFromDeposit(userId: string): Promise<{ 
  canPay: boolean; 
  availableBalance: number;
  requiredAmount: number;
  difference?: number;
}> {
  const balance = await this.getUserDepositBalance(userId);
  const requiredAmount = 70; // GHS 70 booking fee
  
  const canPay = balance.availableBalance >= requiredAmount;
  const result: any = {
    canPay,
    availableBalance: balance.availableBalance,
    requiredAmount
  };
  
  if (!canPay) {
    result.difference = requiredAmount - balance.availableBalance;
  }
  
  return result;
}

  async getUserDeposits(userId: string, filterDto: DepositFilterDto = {}): Promise<{ deposits: Deposit[]; total: number }> {
    const { page = 1, limit = 10, status, depositType, startDate, endDate } = filterDto;

    const query = this.depositRepository
      .createQueryBuilder('deposit')
      .where('deposit.userId = :userId', { userId })
      .orderBy('deposit.createdAt', 'DESC');

    if (status) {
      query.andWhere('deposit.status = :status', { status });
    }

    if (depositType) {
      query.andWhere('deposit.depositType = :depositType', { depositType });
    }

    if (startDate && endDate) {
      query.andWhere('deposit.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000), // Include end date
      });
    }

    const [deposits, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

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
    const deposits = await this.depositRepository
      .createQueryBuilder('deposit')
      .select('deposit.status', 'status')
      .addSelect('SUM(deposit.amount)', 'total')
      .where('deposit.userId = :userId', { userId })
      .groupBy('deposit.status')
      .getRawMany();

    let totalBalance = 0;
    let availableBalance = 0;
    let pendingDeposits = 0;
    const breakdown = {
      completed: 0,
      pending: 0,
      failed: 0,
    };

    deposits.forEach(deposit => {
      const amount = parseFloat(deposit.total) || 0;
      
      switch (deposit.status) {
        case DepositStatus.COMPLETED:
          totalBalance += amount;
          availableBalance += amount;
          breakdown.completed = amount;
          break;
        case DepositStatus.PENDING:
          pendingDeposits += amount;
          breakdown.pending = amount;
          break;
        case DepositStatus.FAILED:
          breakdown.failed = amount;
          break;
      }
    });

    return {
      totalBalance,
      availableBalance,
      pendingDeposits,
      depositBreakdown: breakdown,
    };
  }

  async applyDepositToBooking(
    applyDto: ApplyDepositToBookingDto,
    userId: string
  ): Promise<{ deposit: Deposit; booking: Booking; appliedAmount: number }> {
    const { bookingId, amount } = applyDto;

    return await this.dataSource.transaction(async manager => {
      // Get user balance
      const balance = await this.getUserDepositBalance(userId);
      if (balance.availableBalance < amount) {
        throw new BadRequestException('Insufficient deposit balance');
      }

      // Get booking
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId, studentId: userId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status === 'cancelled' || booking.status === 'checked_out') {
        throw new BadRequestException('Cannot apply deposit to cancelled or checked out booking');
      }

      // Calculate how much can be applied
      const remainingBalance = parseFloat(booking.amountDue.toString());
      const appliedAmount = Math.min(amount, remainingBalance);

      if (appliedAmount <= 0) {
        throw new BadRequestException('No amount due for this booking');
      }

      // Create a new deposit record for the applied amount
      const deposit = manager.create(Deposit, {
        userId,
        amount: -appliedAmount, // Negative amount for withdrawal
        status: DepositStatus.COMPLETED,
        depositType: DepositType.ROOM_BALANCE,
        paymentReference: `booking_${bookingId}_${Date.now()}`,
        notes: `Applied to booking ${bookingId}`,
        paymentDate: new Date(),
        verifiedAt: new Date(),
      });

      const savedDeposit = await manager.save(Deposit, deposit);

      // Update booking payment
      const currentAmountPaid = parseFloat(booking.amountPaid.toString()) || 0;
      booking.amountPaid = currentAmountPaid + appliedAmount;
      booking.amountDue = Math.max(0, parseFloat(booking.totalAmount.toString()) - booking.amountPaid);

      if (booking.amountDue <= 0) {
        booking.paymentStatus = PaymentStatus.PAID;
      } else if (booking.amountPaid > 0) {
        booking.paymentStatus = PaymentStatus.PARTIAL;
      }

      const updatedBooking = await manager.save(Booking, booking);

      // Create payment record
      const payment = manager.create(Payment, {
        bookingId,
        amount: appliedAmount,
        paymentMethod: PaymentMethod.ACCOUNT_CREDIT,
        paymentType: PaymentType.BOOKING_PAYMENT,
        transactionRef: deposit.paymentReference,
        notes: `Paid from deposit balance`,
        status: 'completed',
        paymentDate: new Date(),
      });

      await manager.save(Payment, payment);

      return {
        deposit: savedDeposit,
        booking: updatedBooking,
        appliedAmount,
      };
    });
  }

  async getDepositById(id: string, userId?: string): Promise<Deposit> {
    const where: any = { id };
    if (userId) {
      where.userId = userId;
    }

    const deposit = await this.depositRepository.findOne({
      where,
      relations: ['user'],
    });

    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    return deposit;
  }

  async refundDeposit(depositId: string, reason?: string): Promise<Deposit> {
    const deposit = await this.getDepositById(depositId);

    if (deposit.status !== DepositStatus.COMPLETED) {
      throw new BadRequestException('Only completed deposits can be refunded');
    }

    if (!deposit.canRefund()) {
      throw new BadRequestException('This deposit cannot be refunded (expired or outside refund period)');
    }

    deposit.status = DepositStatus.REFUNDED;
    deposit.notes = reason ? `Refunded: ${reason}` : 'Deposit refunded';

    // Note: In a real implementation, you would integrate with Paystack refund API here
    // await this.paystackService.refundPayment(deposit.paystackReference);

    return await this.depositRepository.save(deposit);
  }

  async cleanupExpiredDeposits(): Promise<{ cleaned: number }> {
    const expiredDeposits = await this.depositRepository
      .createQueryBuilder('deposit')
      .where('deposit.status = :status', { status: DepositStatus.PENDING })
      .andWhere('deposit.expires_at < :now', { now: new Date() })
      .getMany();

    for (const deposit of expiredDeposits) {
      deposit.status = DepositStatus.FAILED;
      deposit.notes = 'Deposit expired - payment not completed';
    }

    await this.depositRepository.save(expiredDeposits);

    return { cleaned: expiredDeposits.length };
  }
}