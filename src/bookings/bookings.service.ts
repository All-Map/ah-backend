// bookings.service.ts
import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, In, Not, DataSource } from 'typeorm';
import { Booking, BookingStatus, BookingType, PaymentStatus } from '../entities/booking.entity';
import { Payment, PaymentMethod, PaymentType } from '../entities/payment.entity';
import { Room, RoomStatus } from '../entities/room.entity';
import { Hostel } from '../entities/hostel.entity';
import { RoomType } from '../entities/room-type.entity';
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
import { Gender, User } from 'src/entities/user.entity';
import { PaystackService } from 'src/paystack/paystack.service';

@Injectable()
export class BookingsService {
  private readonly BOOKING_FEE = 70; 

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Hostel)
    private readonly hostelRepository: Repository<Hostel>,
    @InjectRepository(RoomType)
    private readonly roomTypeRepository: Repository<RoomType>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly paystackService: PaystackService,
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
      bookingType, paymentReference, bookingFeeAmount, ...bookingData 
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
    const [hostel, room] = await Promise.all([
      this.hostelRepository.findOne({ where: { id: hostelId } }),
      this.roomRepository.findOne({ where: { id: roomId, hostelId }, relations: ['roomType'] })
    ]);

    if (!hostel) {
      throw new NotFoundException(`Hostel with ID ${hostelId} not found`);
    }

    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found in this hostel`);
    }

    // Check if room is available
    if (!room.isAvailable()) {
      throw new ConflictException('Room is not available for booking');
    }

    // Try to find the user - but don't fail if not found
    const user = await this.userRepository.findOne({ where: { id: studentId } });
    
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
    const conflictingBookings = await this.bookingRepository.find({
      where: {
        roomId,
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
        checkInDate: Between(checkIn, checkOut),
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
    return await this.dataSource.transaction(async manager => {
      const booking = manager.create(Booking, {
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
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PARTIAL,
        confirmedAt: new Date(),
        bookingFee: this.BOOKING_FEE,
        bookingFeePaid: true,
        paymentReference: paymentReference,
        bookingFeePaidAt: new Date(paymentVerification.paidAt),
        ...bookingData
      });

      const savedBooking = await manager.save(Booking, booking);

      // Create payment record
      const payment = manager.create(Payment, {
        bookingId: savedBooking.id,
        amount: this.BOOKING_FEE,
        paymentMethod: PaymentMethod.CARD,
        paymentType: PaymentType.BOOKING_PAYMENT,
        transactionRef: paymentReference,
        notes: 'Booking fee via Paystack',
        status: 'completed',
        paymentDate: new Date(paymentVerification.paidAt)
      });

      await manager.save(Payment, payment);

      // Update room occupancy
      room.currentOccupancy += 1;
      if (room.currentOccupancy >= room.maxOccupancy) {
        room.status = RoomStatus.OCCUPIED;
      }
      await manager.save(Room, room);

      // Update room type availability
      const roomType = await manager.findOne(RoomType, { where: { id: room.roomTypeId } });
      if (roomType && roomType.availableRooms > 0) {
        roomType.availableRooms -= 1;
        await manager.save(RoomType, roomType);
      }

      console.log('✅ Booking created successfully:', savedBooking.id);

      return savedBooking;
    });
  }

  /**
   * Validates that a user can only have one active booking at a time
   * Only called if user exists in database
   */
  private async validateSingleBookingConstraint(studentId: string): Promise<void> {
    const activeBookingStatuses = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.CHECKED_IN
    ];

    const existingBooking = await this.bookingRepository.findOne({
      where: {
        studentId,
        status: In(activeBookingStatuses)
      },
      relations: ['hostel', 'room']
    });

    if (existingBooking) {
      const statusText = existingBooking.status.replace('_', ' ').toUpperCase();
      throw new ConflictException(
        `This student already has an active booking (${statusText}) at ${existingBooking.hostel?.name || 'Unknown Hostel'}, Room ${existingBooking.room?.roomNumber || 'N/A'}. Please complete or cancel the current booking before creating a new one.`
      );
    }
  }

  /**
   * Validates gender compatibility - only called if user exists
   */
  private async validateGenderCompatibility(user: User, room: Room): Promise<void> {
    if (!user.gender || user.gender === Gender.PREFER_NOT_TO_SAY) {
      return;
    }

    const roomType = await this.roomTypeRepository.findOne({
      where: { id: room.roomType.id }
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
  private async validateRoomGenderMix(user: User, room: Room): Promise<void> {
    const currentBookings = await this.bookingRepository.find({
      where: {
        roomId: room.id,
        status: In([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN])
      }
    });

    if (currentBookings.length === 0) {
      return;
    }

    const currentOccupantIds = currentBookings.map(booking => booking.studentId);
    const currentOccupants = await this.userRepository.find({
      where: { id: In(currentOccupantIds) }
    });

    const currentGenders = currentOccupants
      .map(occupant => occupant.gender?.toLowerCase())
      .filter(gender => gender && gender !== Gender.PREFER_NOT_TO_SAY.toLowerCase());

    const roomType = room.roomType;
    if (!roomType.allowedGenders || 
        roomType.allowedGenders.includes('mixed') || 
        currentGenders.length === 0) {
      return;
    }

    const userGender = user.gender?.toLowerCase();
    if (userGender && userGender !== Gender.PREFER_NOT_TO_SAY.toLowerCase()) {
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
    roomType: RoomType, 
    bookingType: BookingType, 
    checkIn: Date, 
    checkOut: Date
  ): Promise<number> {
    const duration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    
    switch (bookingType) {
      case BookingType.SEMESTER:
        return roomType.pricePerSemester;
      case BookingType.MONTHLY:
        const months = Math.ceil(duration / 30);
        return roomType.pricePerMonth * months;
      case BookingType.WEEKLY:
        const weeks = Math.ceil(duration / 7);
        return roomType.pricePerWeek ? 
          roomType.pricePerWeek * weeks : 
          roomType.pricePerMonth * weeks / 4;
      default:
        throw new BadRequestException('Invalid booking type');
    }
  }

  async createBooking(createBookingDto: CreateBookingDto): Promise<Booking> {
    const { 
      hostelId, 
      roomId, 
      studentId, 
      checkInDate, 
      checkOutDate, 
      bookingType, 
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
    const user = await this.userRepository.findOne({ where: { id: studentId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${studentId} not found`);
    }

    // Check if user already has an active booking
    await this.validateSingleBookingConstraint(studentId);

    // Verify hostel exists
    const hostel = await this.hostelRepository.findOne({ where: { id: hostelId } });
    if (!hostel) {
      throw new NotFoundException(`Hostel with ID ${hostelId} not found`);
    }

    // Verify room exists and belongs to the hostel
    const room = await this.roomRepository.findOne({
      where: { id: roomId, hostelId },
      relations: ['roomType']
    });
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found in this hostel`);
    }

    // Validate gender compatibility
    await this.validateGenderCompatibility(user, room);

    // Check if room is available
    if (!room.isAvailable()) {
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
    const conflictingBookings = await this.bookingRepository.find({
      where: {
        roomId,
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
        checkInDate: Between(checkIn, checkOut),
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
    return await this.dataSource.transaction(async manager => {
      // Create booking with CONFIRMED status since payment is verified
      const booking = manager.create(Booking, {
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
        status: BookingStatus.CONFIRMED, // Automatically confirm since payment is verified
        paymentStatus: PaymentStatus.PARTIAL, // Partial because only booking fee is paid
        confirmedAt: new Date(),
        ...bookingData
      });

      const savedBooking = await manager.save(Booking, booking);

      // Create payment record for the booking fee
      const payment = manager.create(Payment, {
        bookingId: savedBooking.id,
        amount: this.BOOKING_FEE,
        paymentMethod: PaymentMethod.CARD, // Assuming card payment via Paystack
        paymentType: PaymentType.BOOKING_PAYMENT,
        transactionRef: paymentReference,
        notes: 'Booking fee payment via Paystack',
        status: 'completed',
        paymentDate: new Date(paymentVerification.paidAt)
      });

      await manager.save(Payment, payment);

      // Update room occupancy
      room.currentOccupancy += 1;
      if (room.currentOccupancy >= room.maxOccupancy) {
        room.status = RoomStatus.OCCUPIED;
      }
      await manager.save(Room, room);

      // Update room type availability
      const roomType = await manager.findOne(RoomType, { where: { id: room.roomTypeId } });
      if (roomType && roomType.availableRooms > 0) {
        roomType.availableRooms -= 1;
        await manager.save(RoomType, roomType);
      }

      // Double-check if room is already booked
      const existingBooking = await manager.findOne(Booking, {
        where: {
          roomId,
          id: Not(savedBooking.id),
          status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
        }
      });

      if (existingBooking) {
        throw new ConflictException('Room was just booked by another user!');
      }

      return savedBooking;
    });
  }

  /**
   * Record additional payment for booking (room balance)
   */
  async recordRoomPayment(bookingId: string, paymentDto: PaymentDto, receivedBy?: string): Promise<{ payment: Payment; booking: Booking }> {
    return await this.dataSource.transaction(async manager => {
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!booking) {
        throw new NotFoundException(`Booking with ID ${bookingId} not found`);
      }

      if (booking.status === BookingStatus.CANCELLED) {
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
      const payment = manager.create(Payment, {
        bookingId,
        amount: paymentAmount,
        paymentMethod: paymentDto.paymentMethod as PaymentMethod,
        paymentType: PaymentType.BOOKING_PAYMENT,
        transactionRef: paymentDto.transactionRef,
        notes: paymentDto.notes,
        receivedBy,
        status: 'completed'
      });

      const savedPayment = await manager.save(Payment, payment);

      // Update booking payment status
      const currentAmountPaid = Number(booking.amountPaid) || 0;
      const totalAmount = Number(booking.totalAmount);
      
      booking.amountPaid = currentAmountPaid + paymentAmount;
      booking.amountDue = totalAmount - booking.amountPaid;

      // Update payment status
      if (booking.amountDue <= 0) {
        booking.paymentStatus = PaymentStatus.PAID;
        booking.amountDue = 0;
      } else if (booking.amountPaid > 0) {
        booking.paymentStatus = PaymentStatus.PARTIAL;
      }

      const updatedBooking = await manager.save(Booking, booking);

      return { 
        payment: savedPayment, 
        booking: updatedBooking 
      };
    });
  }

  // Get bookings with filtering and pagination
  // Backend Fix (bookings.service.ts) - Updated getBookings method

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
    sortOrder = 'DESC',
    excludeStatuses = []
  } = filterDto;

  const queryBuilder = this.bookingRepository
    .createQueryBuilder('booking')
    .leftJoinAndSelect('booking.hostel', 'hostel')
    .leftJoinAndSelect('booking.room', 'room')
    .leftJoinAndSelect('room.roomType', 'roomType');

  // Apply filters
  if (hostelId) {
    queryBuilder.andWhere('booking.hostelId = :hostelId', { hostelId });
  }

  if (roomId) {
    queryBuilder.andWhere('booking.roomId = :roomId', { roomId });
  }

  if (studentId) {
    queryBuilder.andWhere('booking.studentId = :studentId', { studentId });
  }

  // Fixed: Handle status filtering correctly
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    queryBuilder.andWhere('booking.status IN (:...statuses)', { statuses });
  }

  // Handle excludeStatuses (useful for filtering out active bookings)
  if (excludeStatuses && excludeStatuses.length > 0) {
    queryBuilder.andWhere('booking.status NOT IN (:...excludeStatuses)', {
      excludeStatuses
    });
  }

  if (bookingType) {
    queryBuilder.andWhere('booking.bookingType = :bookingType', { bookingType });
  }

  if (paymentStatus) {
    queryBuilder.andWhere('booking.paymentStatus = :paymentStatus', { paymentStatus });
  }

  if (checkInFrom && checkInTo) {
    queryBuilder.andWhere('booking.checkInDate BETWEEN :checkInFrom AND :checkInTo', {
      checkInFrom,
      checkInTo
    });
  } else if (checkInFrom) {
    queryBuilder.andWhere('booking.checkInDate >= :checkInFrom', { checkInFrom });
  } else if (checkInTo) {
    queryBuilder.andWhere('booking.checkInDate <= :checkInTo', { checkInTo });
  }

  if (search) {
    queryBuilder.andWhere(
      '(booking.studentName ILIKE :search OR booking.studentEmail ILIKE :search OR booking.studentPhone ILIKE :search OR room.roomNumber ILIKE :search OR hostel.name ILIKE :search)',
      { search: `%${search}%` }
    );
  }

  // Apply sorting
  queryBuilder.orderBy(`booking.${sortBy}`, sortOrder);

  // Apply pagination
  const offset = (page - 1) * limit;
  queryBuilder.skip(offset).take(limit);

  try {
    const [bookings, total] = await queryBuilder.getManyAndCount();

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
    throw new Error(`Failed to fetch bookings: ${error.message}`);
  }
}

  async getBookingById(id: string): Promise<Booking> {
    const booking = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.hostel', 'hostel')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoinAndSelect('room.roomType', 'roomType')
      .leftJoinAndSelect('booking.payments', 'payments')
      .where('booking.id = :id', { id })
      .getOne();

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    return booking;
  }

  // Update booking
  async updateBooking(id: string, updateBookingDto: UpdateBookingDto): Promise<Booking> {
    const booking = await this.getBookingById(id);

    // Check if booking can be updated
    if ([BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED].includes(booking.status)) {
      throw new BadRequestException('Cannot update completed or cancelled booking');
    }

    // If dates are being updated, validate and check for conflicts
    if (updateBookingDto.checkInDate || updateBookingDto.checkOutDate) {
      const newCheckIn = updateBookingDto.checkInDate ? new Date(updateBookingDto.checkInDate) : booking.checkInDate;
      const newCheckOut = updateBookingDto.checkOutDate ? new Date(updateBookingDto.checkOutDate) : booking.checkOutDate;

      if (newCheckOut <= newCheckIn) {
        throw new BadRequestException('Check-out date must be after check-in date');
      }

      // Check for conflicts with other bookings
      const conflictingBookings = await this.bookingRepository.find({
        where: {
          roomId: booking.roomId,
          id: Not(booking.id),
          status: In([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
          checkInDate: Between(newCheckIn, newCheckOut),
        }
      });

      if (conflictingBookings.length > 0) {
        throw new ConflictException('Room is already booked for the selected dates');
      }

      // Recalculate total amount if dates changed
      if (updateBookingDto.checkInDate || updateBookingDto.checkOutDate) {
        const room = await this.roomRepository.findOne({
          where: { id: booking.roomId },
          relations: ['roomType']
        });

        if (!room) {
          throw new NotFoundException(`Room with ID ${booking.roomId} not found`);
        }
        
        const newTotalAmount = await this.calculateBookingAmount(
          room.roomType, 
          booking.bookingType, 
          newCheckIn, 
          newCheckOut
        );
        
        booking.totalAmount = newTotalAmount;
        booking.amountDue = newTotalAmount - booking.amountPaid;
      }
    }

    Object.assign(booking, updateBookingDto);
    return await this.bookingRepository.save(booking);
  }

  // Confirm booking
  async confirmBooking(id: string, confirmDto: ConfirmBookingDto): Promise<Booking> {
    const booking = await this.getBookingById(id);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Only pending bookings can be confirmed');
    }

    booking.status = BookingStatus.CONFIRMED;
    booking.confirmedAt = new Date();
    if (confirmDto.notes) {
      booking.notes = booking.notes ? `${booking.notes}\n${confirmDto.notes}` : confirmDto.notes;
    }

    return await this.bookingRepository.save(booking);
  }

  async cancelBooking(id: string, cancelDto: CancelBookingDto): Promise<Booking> {
    const booking = await this.getBookingById(id);

    if (!booking.canCancel()) {
      throw new BadRequestException('Booking cannot be cancelled');
    }

    // Use transaction to ensure atomicity
    return await this.dataSource.transaction(async manager => {
      // Free up the room
      const room = await manager.findOne(Room, { where: { id: booking.roomId } });
      if (room) {
        room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
        if (room.currentOccupancy === 0) {
          room.status = RoomStatus.AVAILABLE;
        }
        await manager.save(Room, room);

        // Update room type availability
        const roomType = await manager.findOne(RoomType, { where: { id: room.roomTypeId } });
        if (roomType) {
          roomType.availableRooms = Math.min(roomType.totalRooms, roomType.availableRooms + 1);
          await manager.save(RoomType, roomType);
        }
      }

      booking.status = BookingStatus.CANCELLED;
      booking.cancelledAt = new Date();
      booking.cancellationReason = cancelDto.reason;
      if (cancelDto.notes) {
        booking.notes = booking.notes ? `${booking.notes}\n${cancelDto.notes}` : cancelDto.notes;
      }

      // Handle refund for booking fee if cancellation is within policy
      const daysSinceBooking = Math.ceil((new Date().getTime() - booking.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceBooking <= 7) { // Allow refund within 7 days
        booking.paymentStatus = PaymentStatus.REFUNDED;
        // Note: You would implement actual refund logic with Paystack here
      } else {
        booking.paymentStatus = PaymentStatus.PAID; // Keep booking fee as non-refundable
      }

      return await manager.save(Booking, booking);
    });
  }

  // Check in student - now requires full payment
  async checkIn(id: string, checkInDto: CheckInDto): Promise<Booking> {
    const booking = await this.getBookingById(id);

    if (!booking.canCheckIn()) {
      throw new BadRequestException('Booking cannot be checked in');
    }

    // Verify full payment is complete (booking fee + room amount)
    if (booking.paymentStatus !== PaymentStatus.PAID || booking.amountDue > 0) {
      throw new BadRequestException(
        `Full payment of ${this.paystackService.formatAmount(Number(booking.totalAmount) + this.BOOKING_FEE)} must be completed before check-in. Remaining balance: ${this.paystackService.formatAmount(Number(booking.amountDue))}`
      );
    }

    booking.status = BookingStatus.CHECKED_IN;
    booking.checkedInAt = new Date();
    if (checkInDto.notes) {
      booking.notes = booking.notes ? `${booking.notes}\n${checkInDto.notes}` : checkInDto.notes;
    }

    // Update room status
    const room = await this.roomRepository.findOne({ where: { id: booking.roomId } });
    if (room && room.status === RoomStatus.AVAILABLE) {
      room.status = RoomStatus.OCCUPIED;
      await this.roomRepository.save(room);
    }

    return await this.bookingRepository.save(booking);
  }

  async checkOut(id: string, checkOutDto: CheckOutDto): Promise<Booking> {
    const booking = await this.getBookingById(id);

    if (!booking.canCheckOut()) {
      throw new BadRequestException('Booking cannot be checked out');
    }

    // Use transaction to ensure atomicity
    return await this.dataSource.transaction(async manager => {
      booking.status = BookingStatus.CHECKED_OUT;
      booking.checkedOutAt = new Date();
      if (checkOutDto.notes) {
        booking.notes = booking.notes ? `${booking.notes}\n${checkOutDto.notes}` : checkOutDto.notes;
      }

      // Free up the room
      const room = await manager.findOne(Room, { where: { id: booking.roomId } });
      if (room) {
        room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
        if (room.currentOccupancy === 0) {
          room.status = RoomStatus.AVAILABLE;
        }
        await manager.save(Room, room);

        // Update room type availability
        const roomType = await manager.findOne(RoomType, { where: { id: room.roomTypeId } });
        if (roomType) {
          roomType.availableRooms = Math.min(roomType.totalRooms, roomType.availableRooms + 1);
          await manager.save(RoomType, roomType);
        }
      }

      return await manager.save(Booking, booking);
    });
  }

  // Delete booking (admin only, strict conditions)
  async deleteBooking(id: string): Promise<void> {
    const booking = await this.getBookingById(id);

    if (booking.status === BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Cannot delete checked-in booking');
    }

    if (booking.amountPaid > 0) {
      throw new BadRequestException('Cannot delete booking with payments');
    }

    // Use transaction to ensure atomicity
    await this.dataSource.transaction(async manager => {
      // Free up the room if it was reserved
      if ([BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(booking.status)) {
        const room = await manager.findOne(Room, { where: { id: booking.roomId } });
        if (room) {
          room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
          if (room.currentOccupancy === 0) {
            room.status = RoomStatus.AVAILABLE;
          }
          await manager.save(Room, room);

          // Update room type availability
          const roomType = await manager.findOne(RoomType, { where: { id: room.roomTypeId } });
          if (roomType) {
            roomType.availableRooms = Math.min(roomType.totalRooms, roomType.availableRooms + 1);
            await manager.save(RoomType, roomType);
          }
        }
      }

      // Delete associated payments first
      await manager.delete(Payment, { bookingId: booking.id });
      
      // Delete the booking
      await manager.remove(Booking, booking);
    });
  }

  async syncRoomTypeAvailability(): Promise<void> {
    const roomTypes = await this.roomTypeRepository.find();
    
    for (const roomType of roomTypes) {
      // Get all rooms of this type
      const rooms = await this.roomRepository.find({
        where: { roomTypeId: roomType.id }
      });

      // Calculate available rooms based on actual room status
      const availableRooms = rooms.filter(room => room.isAvailable()).length;
      
      // Update if different
      if (roomType.availableRooms !== availableRooms) {
        roomType.availableRooms = availableRooms;
        await this.roomTypeRepository.save(roomType);
      }
    }
  }

  // Legacy method for compatibility - now handles room payments only
  async recordPayment(bookingId: string, paymentDto: PaymentDto, receivedBy?: string): Promise<{ payment: Payment; booking: Booking }> {
    return this.recordRoomPayment(bookingId, paymentDto, receivedBy);
  }

  // Get booking payments
  async getBookingPayments(bookingId: string): Promise<Payment[]> {
    return await this.paymentRepository.find({
      where: { bookingId },
      order: { paymentDate: 'DESC' }
    });
  }

  // Get bookings by student
  async getBookingsByStudent(studentId: string): Promise<Booking[]> {
    return await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.hostel', 'hostel')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoinAndSelect('room.roomType', 'roomType')
      .leftJoinAndSelect('booking.payments', 'payments')
      .where('booking.studentId = :studentId', { studentId })
      .orderBy('booking.createdAt', 'DESC')
      .getMany();
  }

  // Get bookings by hostel
  async getBookingsByHostel(hostelId: string, filterDto: Partial<BookingFilterDto> = {}): Promise<Booking[]> {
    const where: any = { hostelId };

    if (filterDto.status) where.status = filterDto.status;
    if (filterDto.paymentStatus) where.paymentStatus = filterDto.paymentStatus;

    return await this.bookingRepository.find({
      where,
      relations: ['room', 'room.roomType', 'payments'],
      order: { createdAt: 'DESC' }
    });
  }

  // Get booking statistics
  async getBookingStatistics(hostelId?: string) {
    let queryBuilder = this.bookingRepository.createQueryBuilder('booking');

    if (hostelId) {
      queryBuilder = queryBuilder.where('booking.hostelId = :hostelId', { hostelId });
    }

    const bookings = await queryBuilder.getMany();

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
        case BookingStatus.PENDING:
          stats.pending++;
          break;
        case BookingStatus.CONFIRMED:
          stats.confirmed++;
          break;
        case BookingStatus.CHECKED_IN:
          stats.checkedIn++;
          break;
        case BookingStatus.CHECKED_OUT:
          stats.checkedOut++;
          break;
        case BookingStatus.CANCELLED:
          stats.cancelled++;
          break;
        case BookingStatus.NO_SHOW:
          stats.noShow++;
          break;
        default:
          console.warn('Unknown booking status:', booking.status);
      }

      // Revenue calculations (including booking fees)
      const totalWithFee = Number(booking.totalAmount) + this.BOOKING_FEE;
      stats.totalRevenue += totalWithFee;
      stats.paidRevenue += Number(booking.amountPaid);
      stats.pendingRevenue += Number(booking.amountDue);
      
      // Track booking fees separately
      if (booking.amountPaid >= this.BOOKING_FEE) {
        stats.bookingFeeRevenue += this.BOOKING_FEE;
      }

      // Booking type distribution
      stats.byBookingType[booking.bookingType] = (stats.byBookingType[booking.bookingType] || 0) + 1;

      // Payment status distribution
      stats.byPaymentStatus[booking.paymentStatus] = (stats.byPaymentStatus[booking.paymentStatus] || 0) + 1;

      // Duration calculation
      totalDuration += booking.getDurationInDays();
    });

    stats.averageStayDuration = bookings.length > 0 ? totalDuration / bookings.length : 0;

    // Calculate occupancy rate if possible
    if (hostelId) {
      try {
        const totalRooms = await this.roomRepository
          .createQueryBuilder('room')
          .where('room.hostelId = :hostelId', { hostelId })
          .getCount();
        
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

    let queryBuilder = this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.hostel', 'hostel')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoinAndSelect('room.roomType', 'roomType')
      .leftJoinAndSelect('booking.payments', 'payments');

    if (hostelId) {
      queryBuilder = queryBuilder.where('booking.hostelId = :hostelId', { hostelId });
    }

    if (startDate && endDate) {
      queryBuilder = queryBuilder.andWhere(
        'booking.createdAt BETWEEN :startDate AND :endDate',
        { startDate, endDate }
      );
    }

    const bookings = await queryBuilder.getMany();

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

  private generateRevenueReport(bookings: Booking[]) {
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

  private generateOccupancyReport(bookings: Booking[]) {
    const report = {
      totalBookings: bookings.length,
      activeBookings: 0,
      averageOccupancyRate: 0,
      peakOccupancyPeriods: [] as Array<{ date: string; bookings: number }>,
      occupancyByHostel: {} as Record<string, number>
    };

    const activeStatuses = [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN];
    
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

  private generatePaymentReport(bookings: Booking[]) {
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

      if (booking.paymentStatus === PaymentStatus.PAID) {
        report.fullyPaid++;
      } else if (booking.paymentStatus === PaymentStatus.PARTIAL) {
        report.partiallyPaid++;
      } else if (booking.paymentStatus === PaymentStatus.PENDING) {
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

  private generateBookingsReport(bookings: Booking[]) {
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
      if (booking.status === BookingStatus.CANCELLED) {
        cancellations++;
      }

      // Successful bookings (confirmed or completed)
      if ([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT].includes(booking.status)) {
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
    const overdueBookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .where('booking.paymentDueDate < :today', { today: new Date() })
      .andWhere('booking.paymentStatus != :paid', { paid: PaymentStatus.PAID })
      .andWhere('booking.paymentStatus != :overdue', { overdue: PaymentStatus.OVERDUE })
      .getMany();

    for (const booking of overdueBookings) {
      booking.paymentStatus = PaymentStatus.OVERDUE;
      await this.bookingRepository.save(booking);
    }
  }

  // Search bookings
  async searchBookings(searchTerm: string, filters: BookingFilterDto = {}) {
    const queryBuilder = this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.hostel', 'hostel')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoinAndSelect('room.roomType', 'roomType')
      .leftJoinAndSelect('booking.payments', 'payments')
      .where(
        '(booking.studentName ILIKE :search OR booking.studentEmail ILIKE :search OR booking.studentPhone ILIKE :search OR room.roomNumber ILIKE :search OR hostel.name ILIKE :search)',
        { search: `%${searchTerm}%` }
      );

    // Apply additional filters
    if (filters.hostelId) {
      queryBuilder.andWhere('booking.hostelId = :hostelId', { hostelId: filters.hostelId });
    }

    if (filters.status) {
      queryBuilder.andWhere('booking.status = :status', { status: filters.status });
    }

    if (filters.paymentStatus) {
      queryBuilder.andWhere('booking.paymentStatus = :paymentStatus', { paymentStatus: filters.paymentStatus });
    }

    const bookings = await queryBuilder
      .orderBy('booking.createdAt', 'DESC')
      .getMany();

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

}