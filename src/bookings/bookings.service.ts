import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, BookingType, PaymentStatusEnum as PaymentStatus } from '@prisma/client';
import { PaymentMethodEnum as PaymentMethod, PaymentTypeEnum as PaymentType } from '@prisma/client';
import { Prisma, Booking, Room, User, RoomType, Payment, Deposit } from '@prisma/client';
import {
  CreateBookingDto,
  UpdateBookingDto,
  BookingFilterDto,
  ConfirmBookingDto,
  CancelBookingDto,
  CheckInDto,
  CheckOutDto,
  PaymentDto,
  ExtendBookingDto,
  BookingReportFilterDto,
  VerifyPaymentDto
} from './dto/booking.dto';
import { PaystackService } from 'src/paystack/paystack.service';
import { DepositsService } from 'src/deposits/deposits.service';
import { DepositStatus, DepositType } from '@prisma/client';
import { UserGender as Gender } from '@prisma/client';

@Injectable()
export class BookingsService {
  private readonly BOOKING_FEE = 70; 

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystackService: PaystackService,
    private readonly depositsService: DepositsService
  ) {}

  async verifyPayment(verifyPaymentDto: VerifyPaymentDto): Promise<any> {
    const { reference, expectedAmount } = verifyPaymentDto;

    try {
      const verification = await this.paystackService.verifyPayment(reference);
      
      // Validate the payment
      this.paystackService.validatePayment(verification, expectedAmount);

      return {
        verified: true,
        reference,
        amount: verification.data.amount / 100, // Convert from kobo to GHS
        paidAt: verification.data.paid_at,
        customer: verification.data.customer,
        authorization: verification.data.authorization
      };
    } catch (error) {
      console.error('Payment verification failed:', error);
      throw error;
    }
  }

   async createAdminBooking(createBookingDto: CreateBookingDto): Promise<Booking> {
const { 
  hostelId, roomId, studentId, checkInDate, checkOutDate, 
  bookingType, paymentReference, bookingFeeAmount, depositAmount = 0, // Add default value
  ...bookingData 
} = createBookingDto;

    console.log('📝 Creating admin booking for student:', studentId);

    // Verify payment first
    if (!paymentReference || bookingFeeAmount !== this.BOOKING_FEE) {
      throw new BadRequestException(`Booking fee of ${this.BOOKING_FEE} GHS required`);
    }

    const paymentVerification = await this.verifyPayment({
      reference: paymentReference,
      expectedAmount: this.BOOKING_FEE
    });

    if (!paymentVerification.verified) {
      throw new BadRequestException('Payment verification failed');
    }

    // Verify hostel and room exist
    const hostel = await this.prisma.hostel.findUnique({ where: { id: hostelId } });
    const room = await this.prisma.room.findUnique({ 
      where: { id: roomId },
      include: { roomType: true } 
    });

    if (!hostel) {
      throw new NotFoundException(`Hostel with ID ${hostelId} not found`);
    }

    if (!room || room.hostelId !== hostelId) {
      throw new NotFoundException(`Room with ID ${roomId} not found in this hostel`);
    }

    // Check if room is available
    if (room.status?.toUpperCase() !== 'AVAILABLE' || room.currentOccupancy >= room.maxOccupancy) {
      throw new ConflictException('Room is not available for booking');
    }

    // Try to find the user - but don't fail if not found
    const user = await this.prisma.user.findUnique({ where: { id: studentId } });
    
    // Only validate gender and single booking constraint if user exists
    if (user) {
      console.log('✅ User found in database, validating constraints...');
      await this.validateSingleBookingConstraint(studentId);
      await this.validateGenderCompatibility(user, room);
    } else {
      console.log('⚠️ User not found in database - creating booking without user validation');
      // For non-registered students, just log a warning
      console.log('📋 Booking for external/non-registered student:', {
        name: bookingData.studentName,
        email: bookingData.studentEmail,
        phone: bookingData.studentPhone
      });
    }

    // Validate dates
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      throw new BadRequestException('Check-in date cannot be in the past');
    }

    if (checkOut <= checkIn) {
      throw new BadRequestException('Check-out date must be after check-in date');
    }

    // Check for conflicting bookings
    const conflictingBookings = await this.prisma.booking.findMany({
      where: {
        roomId,
        status: { in: [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.checked_in] },
        checkInDate: { lte: checkOut },
        checkOutDate: { gte: checkIn }
      }
    });

    if (conflictingBookings.length > 0) {
      throw new ConflictException('Room is already booked for the selected dates');
    }

    // Calculate total amount
    const totalRoomAmount = await this.calculateBookingAmount(
      room.roomType, 
      bookingType, 
      checkIn, 
      checkOut
    );

    // Create booking in transaction
    return await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          hostelId,
          roomId,
          studentId, // Can be any string - doesn't need to be a valid user ID
          checkInDate: checkIn,
          checkOutDate: checkOut,
          bookingType,
          totalAmount: totalRoomAmount,
          amountPaid: this.BOOKING_FEE,
          amountDue: totalRoomAmount,
          paymentDueDate: new Date(checkIn.getTime() - 7 * 24 * 60 * 60 * 1000),
          status: BookingStatus.confirmed,
          paymentStatus: PaymentStatus.partial,
          confirmedAt: new Date(),
          bookingFee: this.BOOKING_FEE,
          bookingFeePaid: true,
          paymentReference: paymentReference,
          bookingFeePaidAt: new Date(paymentVerification.paidAt),
          studentName: bookingData.studentName || 'Admin Booking',
          studentEmail: bookingData.studentEmail || 'admin@booking.com',
          studentPhone: bookingData.studentPhone || '0000000000',
          emergencyContacts: bookingData.emergencyContacts ? (bookingData.emergencyContacts as any) : null as any,
          specialRequests: bookingData.specialRequests,
          notes: bookingData.notes,
          depositAmount: depositAmount,
          autoCancelAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default auto cancel deadline 7 days
        }
      });

      // Create payment record
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount: this.BOOKING_FEE,
          paymentMethod: PaymentMethod.card,
          paymentType: PaymentType.booking_payment,
          transactionRef: paymentReference,
          notes: 'Booking fee via Paystack',
          metadata: null as any,
          paymentDate: new Date(paymentVerification.paidAt)
        }
      });

      // Update room occupancy
      const newOccupancy = room.currentOccupancy + 1;
      const newStatus = newOccupancy >= room.maxOccupancy ? 'OCCUPIED' : room.status;
      await tx.room.update({
        where: { id: room.id },
        data: { currentOccupancy: newOccupancy, status: newStatus }
      });

      // Update room type availability
      if (room.roomType && room.roomType.availableRooms > 0) {
        await tx.roomType.update({
          where: { id: room.roomTypeId },
          data: { availableRooms: { decrement: 1 } }
        });
      }

      console.log('✅ Booking created successfully:', booking.id);

      return booking;
    });
  }

  async checkAvailability(
    hostelId: string,
    checkIn: string,
    checkOut: string,
    roomTypeId?: string
  ) {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Get all rooms for the hostel
    const rooms = await this.prisma.room.findMany({
      where: { 
        hostelId, 
        ...(roomTypeId && { roomTypeId }) 
      },
      include: { roomType: true }
    });

    // Get conflicting bookings
    const conflictingBookings = await this.prisma.booking.findMany({
      where: {
        hostelId,
        status: { in: [BookingStatus.confirmed, BookingStatus.checked_in] },
        OR: [
          {
            checkInDate: { lte: checkOutDate },
            checkOutDate: { gte: checkInDate }
          }
        ]
      }
    });

    const bookedRoomIds = new Set(conflictingBookings.map(b => b.roomId));

    const availableRooms = rooms.filter(room => 
      !bookedRoomIds.has(room.id) && this.isRoomAvailable(room)
    );

    return {
      checkInDate: checkIn,
      checkOutDate: checkOut,
      totalRooms: rooms.length,
      availableRooms: availableRooms.length,
      bookedRooms: bookedRoomIds.size,
      bookingFee: this.BOOKING_FEE,
      rooms: availableRooms.map(room => ({
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        maxOccupancy: room.maxOccupancy,
        currentOccupancy: room.currentOccupancy,
        roomType: {
          id: room.roomType.id,
          name: room.roomType.name,
          pricePerSemester: room.roomType.pricePerSemester,
          pricePerMonth: room.roomType.pricePerMonth,
          pricePerWeek: room.roomType.pricePerWeek,
          capacity: room.roomType.capacity,
          amenities: room.roomType.amenities
        }
      }))
    };
  }

  /**
   * Validates that a user can only have one active booking at a time
   * Only called if user exists in database
   */
  private async validateSingleBookingConstraint(studentId: string): Promise<void> {
    const existingBooking = await this.prisma.booking.findFirst({
      where: {
        studentId,
        status: { in: [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.checked_in] }
      },
      include: { hostel: true, room: true }
    });

    if (existingBooking) {
      const statusText = existingBooking.status.replace('_', ' ').toUpperCase();
      throw new ConflictException(
        `This student already has an active booking (${statusText}) at ${existingBooking.hostel?.name || 'Unknown Hostel'}, Room ${existingBooking.room?.roomNumber || 'N/A'}. Please complete or cancel the current booking before creating a new one.`
      );
    }
  }

  async processAutoCancellations(): Promise<{ cancelled: string[]; notified: string[] }> {
    const result = {
      cancelled: [] as string[],
      notified: [] as string[]
    };

    // Find bookings that are confirmed and past their auto-cancel deadline
    const overdueBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.confirmed,
        autoCancelAt: { lt: new Date() },
        autoCancelNotified: false
      }
    });

    for (const booking of overdueBookings) {
      try {
        // Since we removed TypeORM, we check payment manually
        const minPaymentMet = Number(booking.amountPaid) >= Number(booking.bookingFee);
        
        if (!minPaymentMet) {
          // Auto-cancel the booking
          await this.prisma.$transaction(async (tx) => {
            // Free up the room
            const room = await tx.room.findUnique({ where: { id: booking.roomId } });
            if (room) {
              const newOccupancy = Math.max(0, room.currentOccupancy - 1);
              const newStatus = newOccupancy === 0 ? 'AVAILABLE' : room.status;
              await tx.room.update({
                where: { id: room.id },
                data: { currentOccupancy: newOccupancy, status: newStatus }
              });

              // Update room type availability
              const roomType = await tx.roomType.findUnique({ where: { id: room.roomTypeId } });
              if (roomType) {
                await tx.roomType.update({
                  where: { id: roomType.id },
                  data: {
                    availableRooms: Math.min(roomType.totalRooms, roomType.availableRooms + 1)
                  }
                });
              }
            }

            // Update booking status
            await tx.booking.update({
              where: { id: booking.id },
              data: {
                status: BookingStatus.cancelled,
                cancelledAt: new Date(),
                cancellationReason: 'Automatically cancelled due to insufficient payment within 7 days',
                paymentStatus: PaymentStatus.cancelled,
                autoCancelNotified: true
              }
            });
          });

          result.cancelled.push(booking.id);
          console.log(`✅ Auto-cancelled booking ${booking.id} due to insufficient payment`);
        } else {
          // Mark as notified since requirement is met
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: { autoCancelNotified: true }
          });
        }
      } catch (error) {
        console.error(`❌ Failed to auto-cancel booking ${booking.id}:`, error);
      }
    }

    return result;
  }

async getBookingPaymentOptions(bookingId: string, userId: string) {
  const booking = await this.getBookingById(bookingId);
  const depositBalance = await this.depositsService.getUserDepositBalance(userId);
  
  return {
    booking,
    depositBalance: depositBalance.availableBalance,
    amountDue: parseFloat(booking.amountDue.toString()),
    canUseDeposit: depositBalance.availableBalance > 0 && parseFloat(booking.amountDue.toString()) > 0,
    paymentMethods: [
      'cash',
      'bank_transfer', 
      'mobile_money',
      'card',
      'account_credit'
    ]
  };
}

  /**
   * Validates gender compatibility - only called if user exists
   */
  private async validateGenderCompatibility(user: any, room: any): Promise<void> {
    if (!user.gender || user.gender === Gender.prefer_not_to_say) {
      return;
    }

    const roomType = await this.prisma.roomType.findUnique({
      where: { id: room.roomTypeId || room.roomType?.id }
    });

    if (!roomType) {
      throw new NotFoundException('Room type not found');
    }

    if (roomType.allowedGenders && roomType.allowedGenders.length > 0) {
      const userGender = user.gender.toLowerCase();
      const allowedGenders = roomType.allowedGenders.map(g => g.toLowerCase());

      if (!allowedGenders.includes(userGender) && !allowedGenders.includes('mixed')) {
        const allowedGendersText = allowedGenders.join(', ');
        throw new BadRequestException(
          `This room is restricted to ${allowedGendersText} students only. The student's gender (${user.gender}) is not compatible with this room type.`
        );
      }
    }

    await this.validateRoomGenderMix(user, room);
  }

  /**
   * Validates room gender mix - only called if user exists
   */
  private async validateRoomGenderMix(user: any, room: any): Promise<void> {
    const currentBookings = await this.prisma.booking.findMany({
      where: {
        roomId: room.id,
        status: { in: [BookingStatus.confirmed, BookingStatus.checked_in] }
      }
    });

    if (currentBookings.length === 0) {
      return;
    }

    const currentOccupantIds = currentBookings.map(b => b.studentId).filter(Boolean) as string[];
    const currentOccupants = await this.prisma.user.findMany({
      where: { id: { in: currentOccupantIds } }
    });

    const currentGenders = currentOccupants
      .map(occupant => occupant.gender?.toLowerCase())
      .filter(gender => gender && gender !== Gender.prefer_not_to_say.toLowerCase());

    const roomType = room.roomType || await this.prisma.roomType.findUnique({ where: { id: room.roomTypeId } });
    if (!roomType.allowedGenders || 
        roomType.allowedGenders.includes('mixed') || 
        currentGenders.length === 0) {
      return;
    }

    const userGender = user.gender?.toLowerCase();
    if (userGender && userGender !== Gender.prefer_not_to_say.toLowerCase()) {
      const existingGender = currentGenders[0];
      if (existingGender && userGender !== existingGender) {
        throw new BadRequestException(
          `This room currently has ${existingGender} occupants. Mixed gender occupancy is not allowed in this room type.`
        );
      }
    }
  }

  /**
   * Calculate booking amount based on room type and booking duration
   */
  private async calculateBookingAmount(
    roomType: any, 
    bookingType: BookingType, 
    checkIn: Date, 
    checkOut: Date
  ): Promise<number> {
    const duration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    
    switch (bookingType) {
      case BookingType.semester:
        return Number(roomType.pricePerSemester);
      case BookingType.monthly:
        const months = Math.ceil(duration / 30);
        return Number(roomType.pricePerMonth) * months;
      case BookingType.weekly:
        const weeks = Math.ceil(duration / 7);
        return roomType.pricePerWeek ? 
          Number(roomType.pricePerWeek) * weeks : 
          Number(roomType.pricePerMonth) * weeks / 4;
      default:
        throw new BadRequestException('Invalid booking type');
    }
  }

  async createBooking(createBookingDto: CreateBookingDto): Promise<any> {
    const { 
      hostelId, 
      roomId, 
      studentId, 
      checkInDate, 
      checkOutDate, 
      bookingType, 
      depositAmount = 0,
      paymentReference,
      bookingFeeAmount,
      ...bookingData 
    } = createBookingDto;

    // First, verify the payment with Paystack
    if (!paymentReference || bookingFeeAmount !== this.BOOKING_FEE) {
      throw new BadRequestException(`Booking fee of ${this.BOOKING_FEE} GHS must be paid before creating booking`);
    }

    // Verify payment with Paystack
    const paymentVerification = await this.verifyPayment({
      reference: paymentReference,
      expectedAmount: this.BOOKING_FEE
    });

    if (!paymentVerification.verified) {
      throw new BadRequestException('Payment verification failed. Please try again.');
    }

    // Get user information
    const user = await this.prisma.user.findUnique({ where: { id: studentId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${studentId} not found`);
    }

    // Check if user already has an active booking
    await this.validateSingleBookingConstraint(studentId);

    // Verify hostel exists
    const hostel = await this.prisma.hostel.findUnique({ where: { id: hostelId } });
    if (!hostel) {
      throw new NotFoundException(`Hostel with ID ${hostelId} not found`);
    }

    // Verify room exists and belongs to the hostel
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { roomType: true }
    });
    if (!room || room.hostelId !== hostelId) {
      throw new NotFoundException(`Room with ID ${roomId} not found in this hostel`);
    }

    // Validate gender compatibility
    await this.validateGenderCompatibility(user, room);

    // Check if room is available
    if (room.status?.toUpperCase() !== 'AVAILABLE' || room.currentOccupancy >= room.maxOccupancy) {
      throw new ConflictException('Room is not available for booking');
    }

    // Validate dates
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      throw new BadRequestException('Check-in date cannot be in the past');
    }

    if (checkOut <= checkIn) {
      throw new BadRequestException('Check-out date must be after check-in date');
    }

    // Check for conflicting bookings
    const conflictingBookings = await this.prisma.booking.findMany({
      where: {
        roomId,
        status: { in: [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.checked_in] },
        checkInDate: { lte: checkOut },
        checkOutDate: { gte: checkIn }
      }
    });

    if (conflictingBookings.length > 0) {
      throw new ConflictException('Room has been booked right now.');
    }

    // Calculate total amount (excluding booking fee)
    const totalRoomAmount = await this.calculateBookingAmount(room.roomType, bookingType, checkIn, checkOut);
    
    // Set payment due date (typically 7 days before check-in)
    const paymentDueDate = new Date(checkIn);
    paymentDueDate.setDate(paymentDueDate.getDate() - 7);

    // Use transaction to ensure atomicity
    return await this.prisma.$transaction(async (tx) => {
      // Create booking with confirmed status since payment is verified
      const booking = await tx.booking.create({
        data: {
          hostelId,
          roomId,
          studentId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          bookingType,
          totalAmount: totalRoomAmount,
          amountPaid: this.BOOKING_FEE, // Booking fee is already paid
          amountDue: totalRoomAmount, // Room amount still due
          paymentDueDate,
          status: BookingStatus.confirmed, // Automatically confirm since payment is verified
          paymentStatus: PaymentStatus.partial, // Partial because only booking fee is paid
          confirmedAt: new Date(),
          bookingFee: this.BOOKING_FEE,
          bookingFeePaid: true,
          paymentReference: paymentReference,
          bookingFeePaidAt: new Date(paymentVerification.paidAt),
          studentName: bookingData.studentName || user.name || 'Unknown',
          studentEmail: bookingData.studentEmail || user.email,
          studentPhone: bookingData.studentPhone || user.phone || '0000000000',
          emergencyContacts: bookingData.emergencyContacts ? (bookingData.emergencyContacts as any) : [],
          specialRequests: bookingData.specialRequests,
          notes: bookingData.notes,
          depositAmount: depositAmount,
          autoCancelAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        }
      });

      // Create payment record for the booking fee
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount: this.BOOKING_FEE,
          paymentMethod: PaymentMethod.card, // Assuming card payment via Paystack
          paymentType: PaymentType.booking_payment,
          transactionRef: paymentReference,
          notes: 'Booking fee payment via Paystack',
          metadata: null as any,
          paymentDate: new Date(paymentVerification.paidAt)
        }
      });

      // Update room occupancy
      const newOccupancy = room.currentOccupancy + 1;
      const newStatus = newOccupancy >= room.maxOccupancy ? 'OCCUPIED' : room.status;
      await tx.room.update({
        where: { id: room.id },
        data: { currentOccupancy: newOccupancy, status: newStatus }
      });

      // Update room type availability
      if (room.roomType && room.roomType.availableRooms > 0) {
        await tx.roomType.update({
          where: { id: room.roomTypeId },
          data: { availableRooms: { decrement: 1 } }
        });
      }

      // Double-check if room is already booked
      const existingBooking = await tx.booking.findFirst({
        where: {
          roomId,
          id: { not: booking.id },
          status: { in: [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.checked_in] }
        }
      });

      if (existingBooking) {
        throw new ConflictException('Room was just booked by another user!');
      }

      return booking;
    });
  }

  /**
   * Record additional payment for booking (room balance)
   */
  async recordRoomPayment(bookingId: string, paymentDto: PaymentDto, receivedBy?: string): Promise<{ payment: any; booking: any }> {
    return await this.prisma.$transaction(async (tx) => {
      // Prisma does not have pessimistic locking natively without raw queries, 
      // but findUnique/update in a transaction ensures atomic state
      const booking = await tx.booking.findUnique({
        where: { id: bookingId }
      });

      if (!booking) {
        throw new NotFoundException(`Booking with ID ${bookingId} not found`);
      }

      if (booking.status === BookingStatus.cancelled) {
        throw new BadRequestException('Cannot record payment for cancelled booking');
      }

      const paymentAmount = Number(paymentDto.amount);
      
      if (!paymentAmount || paymentAmount <= 0) {
        throw new BadRequestException('Payment amount must be greater than 0');
      }

      if (paymentAmount > Number(booking.amountDue)) {
        throw new BadRequestException(`Payment amount ${paymentAmount} exceeds amount due ${booking.amountDue}`);
      }

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          bookingId,
          amount: paymentAmount,
          paymentMethod: paymentDto.paymentMethod as PaymentMethod,
          paymentType: PaymentType.booking_payment,
          transactionRef: paymentDto.transactionRef,
          notes: paymentDto.notes,
          receivedBy,
          metadata: null as any,
          paymentDate: new Date()
        }
      });

      // Update booking payment status
      const currentAmountPaid = Number(booking.amountPaid) || 0;
      const totalAmount = Number(booking.totalAmount);
      
      const newAmountPaid = currentAmountPaid + paymentAmount;
      const newAmountDue = totalAmount - newAmountPaid;

      let newPaymentStatus = booking.paymentStatus;
      if (newAmountDue <= 0) {
        newPaymentStatus = PaymentStatus.paid;
      } else if (newAmountPaid > 0) {
        newPaymentStatus = PaymentStatus.partial;
      }

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue <= 0 ? 0 : newAmountDue,
          paymentStatus: newPaymentStatus
        }
      });

      return { 
        payment, 
        booking: updatedBooking 
      };
    });
  }

// In bookings.service.ts - update the createBookingWithDeposit method

async createBookingWithDeposit(
  createBookingDto: CreateBookingDto,
  userId: string
): Promise<any> {
  const { 
    hostelId, roomId, checkInDate, checkOutDate, 
    bookingType, emergencyContacts, depositAmount = 70,
    ...bookingData 
  } = createBookingDto;

  console.log('🔒 Starting booking with deposit deduction for user:', userId);

  // Prisma interactive transaction to ensure atomicity
  return await this.prisma.$transaction(async (tx) => {
    try {
      // Step 1: Verify deposit balance
      console.log('💰 Checking deposit balance...');
      const depositBalance = await this.depositsService.getUserDepositBalance(userId);
      
      if (depositBalance.availableBalance < depositAmount) {
        throw new BadRequestException(
          `Insufficient deposit balance. Available: GHS ${depositBalance.availableBalance.toFixed(2)}, ` +
          `Required: GHS ${depositAmount.toFixed(2)}`
        );
      }

      // Step 2: Get user
      const user = await tx.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Step 3: Validate single booking constraint
      const existingBooking = await tx.booking.findFirst({
        where: {
          studentId: userId,
          status: { in: [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.checked_in] }
        }
      });

      if (existingBooking) {
        throw new ConflictException(
          'You already have an active booking. Please complete or cancel it before creating a new one.'
        );
      }

      // Step 4: Validate room availability
      console.log('🔐 Locking room for availability check...');
      const room = await tx.room.findUnique({
        where: { id: roomId },
        include: { roomType: true } // We need roomType for calculations and gender checks
      });

      if (!room || room.hostelId !== hostelId) {
        throw new NotFoundException('Room not found in this hostel');
      }

      const roomType = room.roomType;
      if (!roomType) {
        throw new NotFoundException('Room type not found');
      }

      // Step 6: Verify room availability
      if (!this.isRoomAvailable(room)) {
        throw new ConflictException('Room is not available for booking');
      }

      if (room.currentOccupancy >= room.maxOccupancy) {
        throw new ConflictException('Room is now fully booked. Please select another room.');
      }

      // Step 7: Validate gender compatibility
      await this.validateGenderCompatibility(user, room);

      // Step 8: Validate dates
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (checkIn < today) {
        throw new BadRequestException('Check-in date cannot be in the past');
      }

      if (checkOut <= checkIn) {
        throw new BadRequestException('Check-out date must be after check-in date');
      }

      // Step 9: Check for conflicting bookings
      const conflictingBooking = await tx.booking.findFirst({
        where: {
          roomId,
          status: { in: [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.checked_in] },
          checkInDate: { lte: checkOut },
          checkOutDate: { gte: checkIn }
        }
      });

      if (conflictingBooking) {
        throw new ConflictException('Room is already booked for these dates');
      }

      // Step 10: Calculate amounts
      const totalRoomAmount = await this.calculateBookingAmount(
        roomType,
        bookingType,
        checkIn,
        checkOut
      );

      const paymentDueDate = new Date(checkIn);
      paymentDueDate.setDate(paymentDueDate.getDate() - 7);

      const paymentRef = `booking_fee_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Step 11: Create deposit deduction record
      console.log('💸 Creating deposit deduction record...');
      const depositDeduction = await tx.deposit.create({
        data: {
          userId,
          amount: -depositAmount,
          status: DepositStatus.completed,
          depositType: DepositType.booking_deposit,
          paymentReference: paymentRef,
          notes: `Booking fee deduction`,
          paymentDate: new Date(),
          verifiedAt: new Date()
        }
      });

      // Step 12: Create booking
      console.log('📝 Creating booking record...');
      const booking = await tx.booking.create({
        data: {
          hostelId,
          roomId,
          studentId: userId,
          studentName: user.name || bookingData.studentName || 'Unknown',
          studentEmail: user.email || bookingData.studentEmail,
          studentPhone: user.phone || bookingData.studentPhone || '0000000000',
          checkInDate: checkIn,
          checkOutDate: checkOut,
          bookingType,
          totalAmount: totalRoomAmount,
          amountPaid: depositAmount,
          amountDue: totalRoomAmount,
          paymentDueDate,
          status: BookingStatus.confirmed,
          paymentStatus: PaymentStatus.partial,
          confirmedAt: new Date(),
          bookingFee: depositAmount,
          bookingFeePaid: true,
          paymentReference: paymentRef,
          bookingFeePaidAt: new Date(),
          emergencyContacts: emergencyContacts ? (emergencyContacts as any) : null as any,
          specialRequests: bookingData.specialRequests,
          notes: bookingData.notes
        }
      });

      // Step 13: Create payment record
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount: depositAmount,
          paymentMethod: PaymentMethod.account_credit,
          paymentType: PaymentType.booking_payment,
          transactionRef: paymentRef,
          notes: 'Booking fee from deposit balance',
          metadata: null as any,
          paymentDate: new Date()
        }
      });

      // Step 14: Update room occupancy
      console.log('🏠 Updating room occupancy...');
      const newOccupancy = room.currentOccupancy + 1;
      const newStatus = newOccupancy >= room.maxOccupancy ? 'OCCUPIED' : room.status;
      await tx.room.update({
        where: { id: room.id },
        data: { currentOccupancy: newOccupancy, status: newStatus }
      });

      // Step 15: Update room type availability
      if (roomType && roomType.availableRooms > 0) {
        await tx.roomType.update({
          where: { id: roomType.id },
          data: { availableRooms: { decrement: 1 } }
        });
      }

      console.log('✅ Booking created successfully:', booking.id);
      console.log('💵 Deposit deducted:', depositAmount);

      return booking;

    } catch (error) {
      console.error('❌ Booking creation failed:', error);
      throw error;
    }
  });
}

// Add this helper method to check room availability
private isRoomAvailable(room: any): boolean {
  return room.status?.toUpperCase() === 'AVAILABLE' && 
         room.currentOccupancy < room.maxOccupancy;
}

  async getBookings(filterDto: BookingFilterDto) {
    const {
      hostelId,
      roomId,
      studentId,
      status,
      bookingType,
      paymentStatus,
      checkInFrom,
      checkInTo,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      excludeStatuses
    } = filterDto;

    try {
      const where: Prisma.BookingWhereInput = {};

      if (hostelId) where.hostelId = hostelId;
      if (roomId) where.roomId = roomId;
      if (studentId) where.studentId = studentId;
      if (status) where.status = status;
      if (bookingType) where.bookingType = bookingType;
      if (paymentStatus) where.paymentStatus = paymentStatus;

      if (checkInFrom || checkInTo) {
        where.checkInDate = {};
        if (checkInFrom) where.checkInDate.gte = new Date(checkInFrom);
        if (checkInTo) where.checkInDate.lte = new Date(checkInTo);
      }

      if (excludeStatuses && excludeStatuses.length > 0) {
        where.status = { 
          notIn: excludeStatuses as BookingStatus[],
        };
        if (status) {
          where.status = {
            in: [status],
            notIn: excludeStatuses as BookingStatus[]
          };
        }
      }

      if (search) {
        where.OR = [
          { studentName: { contains: search, mode: 'insensitive' } },
          { studentEmail: { contains: search, mode: 'insensitive' } },
          { studentPhone: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Convert sortOrder to Prisma sort order
      const prismaSortOrder: Prisma.SortOrder = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

      const [total, bookings] = await Promise.all([
        this.prisma.booking.count({ where }),
        this.prisma.booking.findMany({
          where,
          include: {
            hostel: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                address: true,
                images: true,
                isVerified: true,
                isActive: true,
                createdAt: true,
                adminId: true,
                updatedAt: true
              }
            },
            room: {
              include: { roomType: true }
            },
            student: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          },
          orderBy: { [sortBy]: prismaSortOrder },
          skip: (page - 1) * limit,
          take: limit,
        })
      ]);

      return {
        bookings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error in getBookings:', error);
      throw new BadRequestException(`Failed to fetch bookings: ${(error as Error).message}`);
    }
  }

  async getBookingById(id: string): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        hostel: true,
        room: { include: { roomType: true } },
        payments: true
      }
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    return booking;
  }

  // Update booking
  async updateBooking(id: string, updateBookingDto: UpdateBookingDto): Promise<any> {
    const booking = await this.getBookingById(id);

    // Check if booking can be updated
    if ([BookingStatus.checked_out, BookingStatus.cancelled].includes(booking.status as any)) {
      throw new BadRequestException('Cannot update completed or cancelled booking');
    }

    const updates: any = { ...updateBookingDto };

    // If dates are being updated, validate and check for conflicts
    if (updateBookingDto.checkInDate || updateBookingDto.checkOutDate) {
      const newCheckIn = updateBookingDto.checkInDate ? new Date(updateBookingDto.checkInDate) : booking.checkInDate;
      const newCheckOut = updateBookingDto.checkOutDate ? new Date(updateBookingDto.checkOutDate) : booking.checkOutDate;

      if (newCheckOut <= newCheckIn) {
        throw new BadRequestException('Check-out date must be after check-in date');
      }

      // Check for conflicts with other bookings
      const conflictingBookings = await this.prisma.booking.findMany({
        where: {
          roomId: booking.roomId,
          id: { not: booking.id },
          status: { in: [BookingStatus.confirmed, BookingStatus.checked_in] },
          checkInDate: { lte: newCheckOut },
          checkOutDate: { gte: newCheckIn }
        }
      });

      if (conflictingBookings.length > 0) {
        throw new ConflictException('Room is already booked for the selected dates');
      }

      // Recalculate total amount if dates changed
      if (updateBookingDto.checkInDate || updateBookingDto.checkOutDate) {
        const room = await this.prisma.room.findUnique({
          where: { id: booking.roomId },
          include: { roomType: true }
        });

        if (!room) {
          throw new NotFoundException(`Room with ID ${booking.roomId} not found`);
        }
        
        const newTotalAmount = await this.calculateBookingAmount(
          room.roomType, 
          booking.bookingType as BookingType, 
          newCheckIn, 
          newCheckOut
        );
        
        updates.totalAmount = newTotalAmount;
        updates.amountDue = newTotalAmount - Number(booking.amountPaid);
      }
    }

    if (updates.emergencyContacts) {
      updates.emergencyContacts = updates.emergencyContacts as any;
    }

    return await this.prisma.booking.update({
      where: { id },
      data: updates
    });
  }

  // Confirm booking
  async confirmBooking(id: string, confirmDto: ConfirmBookingDto): Promise<any> {
    const booking = await this.getBookingById(id);

    if (booking.status !== BookingStatus.pending) {
      throw new BadRequestException('Only pending bookings can be confirmed');
    }

    const notes = confirmDto.notes ? 
      (booking.notes ? `${booking.notes}\n${confirmDto.notes}` : confirmDto.notes) : 
      booking.notes;

    return await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.confirmed,
        confirmedAt: new Date(),
        notes
      }
    });
  }

  async cancelBooking(id: string, cancelDto: CancelBookingDto): Promise<any> {
    const booking = await this.getBookingById(id);

    if (booking.status === BookingStatus.cancelled || booking.status === BookingStatus.checked_out) {
      throw new BadRequestException('Booking cannot be cancelled');
    }

    // Use transaction to ensure atomicity
    return await this.prisma.$transaction(async (tx) => {
      // Free up the room
      const room = await tx.room.findUnique({ where: { id: booking.roomId } });
      if (room) {
        const newOccupancy = Math.max(0, room.currentOccupancy - 1);
        const newStatus = newOccupancy === 0 ? 'AVAILABLE' : room.status;
        await tx.room.update({
          where: { id: room.id },
          data: { currentOccupancy: newOccupancy, status: newStatus }
        });

        // Update room type availability
        const roomType = await tx.roomType.findUnique({ where: { id: room.roomTypeId } });
        if (roomType) {
          await tx.roomType.update({
            where: { id: roomType.id },
            data: { availableRooms: Math.min(roomType.totalRooms, roomType.availableRooms + 1) }
          });
        }
      }

      const notes = cancelDto.notes ? 
        (booking.notes ? `${booking.notes}\n${cancelDto.notes}` : cancelDto.notes) : 
        booking.notes;

      // Handle refund for booking fee if cancellation is within policy
      const daysSinceBooking = Math.ceil((new Date().getTime() - booking.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      let paymentStatus = booking.paymentStatus;
      if (daysSinceBooking <= 7) { // Allow refund within 7 days
        paymentStatus = PaymentStatus.cancelled;
      } else {
        paymentStatus = PaymentStatus.paid; // Keep booking fee as non-refundable
      }

      return await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.cancelled,
          cancelledAt: new Date(),
          cancellationReason: cancelDto.reason,
          notes,
          paymentStatus
        }
      });
    });
  }

  // Check in student - now requires full payment
  async checkIn(id: string, checkInDto: CheckInDto): Promise<any> {
    const booking = await this.getBookingById(id);

    if (booking.status !== BookingStatus.confirmed) {
      throw new BadRequestException('Booking cannot be checked in');
    }

    // Verify full payment is complete (booking fee + room amount)
    if (booking.paymentStatus !== PaymentStatus.paid || Number(booking.amountDue) > 0) {
      throw new BadRequestException(
        `Full payment of ${this.paystackService.formatAmount(Number(booking.totalAmount) + Number(this.BOOKING_FEE))} must be completed before check-in. Remaining balance: ${this.paystackService.formatAmount(Number(booking.amountDue))}`
      );
    }

    const notes = checkInDto.notes ? 
      (booking.notes ? `${booking.notes}\n${checkInDto.notes}` : checkInDto.notes) : 
      booking.notes;

    // Update room status
    const room = await this.prisma.room.findUnique({ where: { id: booking.roomId } });
    if (room && room.status?.toUpperCase() === 'AVAILABLE') {
      await this.prisma.room.update({
        where: { id: room.id },
        data: { status: 'OCCUPIED' }
      });
    }

    return await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.checked_in,
        checkedInAt: new Date(),
        notes
      }
    });
  }

  async checkOut(id: string, checkOutDto: CheckOutDto): Promise<any> {
    const booking = await this.getBookingById(id);

    if (booking.status !== BookingStatus.checked_in) {
      throw new BadRequestException('Booking cannot be checked out');
    }

    // Use transaction to ensure atomicity
    return await this.prisma.$transaction(async (tx) => {
      const notes = checkOutDto.notes ? 
        (booking.notes ? `${booking.notes}\n${checkOutDto.notes}` : checkOutDto.notes) : 
        booking.notes;

      // Free up the room
      const room = await tx.room.findUnique({ where: { id: booking.roomId } });
      if (room) {
        const newOccupancy = Math.max(0, room.currentOccupancy - 1);
        const newStatus = newOccupancy === 0 ? 'AVAILABLE' : room.status;
        await tx.room.update({
          where: { id: room.id },
          data: { currentOccupancy: newOccupancy, status: newStatus }
        });

        // Update room type availability
        const roomType = await tx.roomType.findUnique({ where: { id: room.roomTypeId } });
        if (roomType) {
          await tx.roomType.update({
            where: { id: roomType.id },
            data: { availableRooms: Math.min(roomType.totalRooms, roomType.availableRooms + 1) }
          });
        }
      }

      return await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.checked_out,
          checkedOutAt: new Date(),
          notes
        }
      });
    });
  }

  // Delete booking (admin only, strict conditions)
  async deleteBooking(id: string): Promise<void> {
    const booking = await this.getBookingById(id);

    if (booking.status === BookingStatus.checked_in) {
      throw new BadRequestException('Cannot delete checked-in booking');
    }

    if (Number(booking.amountPaid) > 0) {
      throw new BadRequestException('Cannot delete booking with payments');
    }

    // Use transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // Free up the room if it was reserved
      if ([BookingStatus.pending, BookingStatus.confirmed].includes(booking.status as any)) {
        const room = await tx.room.findUnique({ where: { id: booking.roomId } });
        if (room) {
          const newOccupancy = Math.max(0, room.currentOccupancy - 1);
          const newStatus = newOccupancy === 0 ? 'AVAILABLE' : room.status;
          await tx.room.update({
            where: { id: room.id },
            data: { currentOccupancy: newOccupancy, status: newStatus }
          });

          // Update room type availability
          const roomType = await tx.roomType.findUnique({ where: { id: room.roomTypeId } });
          if (roomType) {
            await tx.roomType.update({
              where: { id: roomType.id },
              data: { availableRooms: Math.min(roomType.totalRooms, roomType.availableRooms + 1) }
            });
          }
        }
      }

      // Delete associated payments first
      await tx.payment.deleteMany({ where: { bookingId: booking.id } });
      
      // Delete the booking
      await tx.booking.delete({ where: { id: booking.id } });
    });
  }

  async syncRoomTypeAvailability(): Promise<void> {
    const roomTypes = await this.prisma.roomType.findMany();
    
    for (const roomType of roomTypes) {
      // Get all rooms of this type
      const rooms = await this.prisma.room.findMany({
        where: { roomTypeId: roomType.id }
      });

      // Calculate available rooms based on actual room status
      const availableRooms = rooms.filter(room => room.status?.toUpperCase() === 'AVAILABLE').length;
      
      // Update if different
      if (roomType.availableRooms !== availableRooms) {
        await this.prisma.roomType.update({
          where: { id: roomType.id },
          data: { availableRooms }
        });
      }
    }
  }

  // Legacy method for compatibility - now handles room payments only
  async recordPayment(bookingId: string, paymentDto: PaymentDto, receivedBy?: string): Promise<{ payment: any; booking: any }> {
    return this.recordRoomPayment(bookingId, paymentDto, receivedBy);
  }

  // Get booking payments
  async getBookingPayments(bookingId: string): Promise<any[]> {
    return await this.prisma.payment.findMany({
      where: { bookingId },
      orderBy: { paymentDate: 'desc' }
    });
  }

  // Get bookings by student
  async getBookingsByStudent(studentId: string): Promise<any[]> {
    return await this.prisma.booking.findMany({
      where: { studentId },
      include: {
        hostel: true,
        room: { include: { roomType: true } },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Get bookings by hostel
  async getBookingsByHostel(hostelId: string, filterDto: Partial<BookingFilterDto> = {}): Promise<any[]> {
    const where: any = { hostelId };

    if (filterDto.status) where.status = typeof filterDto.status === 'string' ? filterDto.status as any : { in: filterDto.status as any };
    if (filterDto.paymentStatus) where.paymentStatus = filterDto.paymentStatus;

    return await this.prisma.booking.findMany({
      where,
      include: {
        room: { include: { roomType: true } },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Get booking statistics
  async getBookingStatistics(hostelId?: string) {
    const where: any = {};
    if (hostelId) {
      where.hostelId = hostelId;
    }

    const bookings = await this.prisma.booking.findMany({ where });

    const stats = {
      total: bookings.length,
      pending: 0,
      confirmed: 0,
      checkedIn: 0,
      checkedOut: 0,
      cancelled: 0,
      noShow: 0,
      totalRevenue: 0,
      paidRevenue: 0,
      pendingRevenue: 0,
      bookingFeeRevenue: 0, // New stat for booking fees
      byBookingType: {} as Record<string, number>,
      byPaymentStatus: {} as Record<string, number>,
      averageStayDuration: 0,
      occupancyRate: 0
    };

    let totalDuration = 0;

    bookings.forEach(booking => {
      // Map booking status enum values to the expected property names
      switch (booking.status) {
        case BookingStatus.pending:
          stats.pending++;
          break;
        case BookingStatus.confirmed:
          stats.confirmed++;
          break;
        case BookingStatus.checked_in:
          stats.checkedIn++;
          break;
        case BookingStatus.checked_out:
          stats.checkedOut++;
          break;
        case BookingStatus.cancelled:
          stats.cancelled++;
          break;
        default:
          break;
      }

      // Revenue calculations (including booking fees)
      const totalWithFee = Number(booking.totalAmount) + this.BOOKING_FEE;
      stats.totalRevenue += totalWithFee;
      stats.paidRevenue += Number(booking.amountPaid);
      stats.pendingRevenue += Number(booking.amountDue);
      
      // Track booking fees separately
      if (Number(booking.amountPaid) >= this.BOOKING_FEE) {
        stats.bookingFeeRevenue += this.BOOKING_FEE;
      }

      // Booking type distribution
      stats.byBookingType[booking.bookingType] = (stats.byBookingType[booking.bookingType] || 0) + 1;

      // Payment status distribution
      stats.byPaymentStatus[booking.paymentStatus] = (stats.byPaymentStatus[booking.paymentStatus] || 0) + 1;

      // Duration calculation
      const duration = Math.ceil((new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24));
      totalDuration += duration;
    });

    stats.averageStayDuration = bookings.length > 0 ? totalDuration / bookings.length : 0;

    // Calculate occupancy rate if possible
    if (hostelId) {
      try {
        const totalRooms = await this.prisma.room.count({
          where: { hostelId }
        });
        
        if (totalRooms > 0) {
          stats.occupancyRate = (stats.checkedIn / totalRooms) * 100;
        }
      } catch (error) {
        console.error('Failed to calculate occupancy rate:', error);
        stats.occupancyRate = 0;
      }
    }

    return stats;
  }

  // Generate booking report
  async generateReport(filterDto: BookingReportFilterDto) {
    const { hostelId, startDate, endDate, reportType = 'bookings' } = filterDto;

    const where: any = {};

    if (hostelId) {
      where.hostelId = hostelId;
    }

    if (startDate && endDate) {
      where.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        hostel: true,
        room: { include: { roomType: true } },
        payments: true
      }
    });

    switch (reportType) {
      case 'revenue':
        return this.generateRevenueReport(bookings);
      case 'occupancy':
        return this.generateOccupancyReport(bookings);
      case 'payments':
        return this.generatePaymentReport(bookings);
      default:
        return this.generateBookingsReport(bookings);
    }
  }

  private generateRevenueReport(bookings: any[]) {
    const report = {
      totalBookings: bookings.length,
      totalRevenue: 0,
      paidRevenue: 0,
      pendingRevenue: 0,
      bookingFeeRevenue: 0,
      roomRevenue: 0,
      averageBookingValue: 0,
      revenueByMonth: {} as Record<string, number>,
      revenueByHostel: {} as Record<string, number>
    };

    bookings.forEach(booking => {
      const roomRevenue = Number(booking.totalAmount);
      const paidAmount = Number(booking.amountPaid);
      const pendingAmount = Number(booking.amountDue);

      // Total revenue includes both booking fee and room cost
      const totalBookingRevenue = roomRevenue + this.BOOKING_FEE;
      report.totalRevenue += totalBookingRevenue;
      report.paidRevenue += paidAmount;
      report.pendingRevenue += pendingAmount;
      report.roomRevenue += roomRevenue;

      // Booking fee is always collected upfront
      report.bookingFeeRevenue += this.BOOKING_FEE;

      // Revenue by month
      const month = booking.createdAt.toISOString().substring(0, 7);
      report.revenueByMonth[month] = (report.revenueByMonth[month] || 0) + totalBookingRevenue;

      // Revenue by hostel
      const hostelName = booking.hostel?.name || 'Unknown';
      report.revenueByHostel[hostelName] = (report.revenueByHostel[hostelName] || 0) + totalBookingRevenue;
    });

    report.averageBookingValue = report.totalBookings > 0 ? report.totalRevenue / report.totalBookings : 0;

    return report;
  }

  private generateOccupancyReport(bookings: any[]) {
    const report = {
      totalBookings: bookings.length,
      activeBookings: 0,
      averageOccupancyRate: 0,
      peakOccupancyPeriods: [] as Array<{ date: string; bookings: number }>,
      occupancyByHostel: {} as Record<string, number>
    };

    const activeStatuses = [BookingStatus.confirmed, BookingStatus.checked_in];
    
    bookings.forEach(booking => {
      if (activeStatuses.includes(booking.status)) {
        report.activeBookings++;
      }

      // Occupancy by hostel
      const hostelName = booking.hostel?.name || 'Unknown';
      report.occupancyByHostel[hostelName] = (report.occupancyByHostel[hostelName] || 0) + 1;
    });

    return report;
  }

  private generatePaymentReport(bookings: any[]) {
    const report = {
      totalBookings: bookings.length,
      fullyPaid: 0,
      partiallyPaid: 0,
      unpaid: 0,
      overdue: 0,
      totalCollected: 0,
      totalPending: 0,
      bookingFeesCollected: 0,
      collectionRate: 0
    };

    bookings.forEach(booking => {
      const paid = Number(booking.amountPaid);
      const total = Number(booking.totalAmount);
      const due = Number(booking.amountDue);

      report.totalCollected += paid;
      report.totalPending += due;
      report.bookingFeesCollected += this.BOOKING_FEE; // All bookings have paid booking fee

      if (booking.paymentStatus === PaymentStatus.paid) {
        report.fullyPaid++;
      } else if (booking.paymentStatus === PaymentStatus.partial) {
        report.partiallyPaid++;
      } else if (booking.paymentStatus === PaymentStatus.pending) {
        report.unpaid++;
      }

      if (booking.isOverdue()) {
        report.overdue++;
      }
    });

    const totalRevenue = report.totalCollected + report.totalPending;
    report.collectionRate = totalRevenue > 0 ? (report.totalCollected / totalRevenue) * 100 : 0;

    return report;
  }

  private generateBookingsReport(bookings: any[]) {
    const report = {
      totalBookings: bookings.length,
      statusBreakdown: {} as Record<string, number>,
      typeBreakdown: {} as Record<string, number>,
      monthlyBookings: {} as Record<string, number>,
      averageLeadTime: 0,
      cancellationRate: 0,
      conversionRate: 0 // New metric for payment completion
    };

    let totalLeadTime = 0;
    let cancellations = 0;
    let successfulBookings = 0;

    bookings.forEach(booking => {
      // Status breakdown
      report.statusBreakdown[booking.status] = (report.statusBreakdown[booking.status] || 0) + 1;

      // Type breakdown
      report.typeBreakdown[booking.bookingType] = (report.typeBreakdown[booking.bookingType] || 0) + 1;

      // Monthly bookings
      const month = booking.createdAt.toISOString().substring(0, 7);
      report.monthlyBookings[month] = (report.monthlyBookings[month] || 0) + 1;

      // Lead time calculation
      const leadTime = (new Date(booking.checkInDate).getTime() - booking.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      totalLeadTime += leadTime;

      // Cancellations
      if (booking.status === BookingStatus.cancelled) {
        cancellations++;
      }

      // Successful bookings (confirmed or completed)
      if (
        [BookingStatus.confirmed, BookingStatus.checked_in, BookingStatus.checked_out].includes(
          booking.status,
        )
      ) {
        successfulBookings++;
      }
    });

    report.averageLeadTime = bookings.length > 0 ? totalLeadTime / bookings.length : 0;
    report.cancellationRate = bookings.length > 0 ? (cancellations / bookings.length) * 100 : 0;
    report.conversionRate = bookings.length > 0 ? (successfulBookings / bookings.length) * 100 : 0;

    return report;
  }

  // Mark overdue bookings
  async markOverdueBookings(): Promise<void> {
    const overdueBookings = await this.prisma.booking.findMany({
      where: {
        paymentDueDate: { lt: new Date() },
        paymentStatus: { notIn: [PaymentStatus.paid, PaymentStatus.overdue] }
      }
    });

    for (const booking of overdueBookings) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: PaymentStatus.overdue }
      });
    }
  }

  // Search bookings
  async searchBookings(searchTerm: string, filters: BookingFilterDto = {}) {
    const where: any = {
      OR: [
        { studentName: { contains: searchTerm, mode: 'insensitive' } },
        { studentEmail: { contains: searchTerm, mode: 'insensitive' } },
        { studentPhone: { contains: searchTerm, mode: 'insensitive' } },
        { room: { roomNumber: { contains: searchTerm, mode: 'insensitive' } } },
        { hostel: { name: { contains: searchTerm, mode: 'insensitive' } } }
      ]
    };

    // Apply additional filters
    if (filters.hostelId) {
      where.hostelId = filters.hostelId;
    }

    if (filters.status) {
      where.status = typeof filters.status === 'string' ? filters.status : { in: filters.status };
    }

    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        hostel: true,
        room: { include: { roomType: true } },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return bookings;
  }

  // Get total booking cost including fee
  getTotalBookingCost(roomAmount: number): number {
    return roomAmount + this.BOOKING_FEE;
  }

  // Get booking fee amount
  getBookingFee(): number {
    return this.BOOKING_FEE;
  }

  // Get rooms for a hostel (replaces roomRepository.find)
  async getRooms(filters: { hostelId?: string; roomTypeId?: string; status?: string } = {}) {
    const where: Prisma.RoomWhereInput = {};
    if (filters.hostelId) where.hostelId = filters.hostelId;
    if (filters.roomTypeId) where.roomTypeId = filters.roomTypeId;
    if (filters.status) where.status = filters.status;

    return this.prisma.room.findMany({
      where,
      include: { roomType: true }
    });
  }
}