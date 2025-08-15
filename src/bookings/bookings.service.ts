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
  BookingReportFilterDto
} from './dto/booking.dto';
import { Gender, User } from 'src/entities/user.entity';

@Injectable()
export class BookingsService {
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
  ) {}

  // Create a new booking
async createBooking(createBookingDto: CreateBookingDto): Promise<Booking> {
    const { hostelId, roomId, studentId, checkInDate, checkOutDate, bookingType, ...bookingData } = createBookingDto;

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
        status: In([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
        checkInDate: Between(checkIn, checkOut),
      }
    });

    if (conflictingBookings.length > 0) {
      throw new ConflictException('Room is already booked for the selected dates');
    }

    // Calculate total amount
    const totalAmount = await this.calculateBookingAmount(room.roomType, bookingType, checkIn, checkOut);
    
    // Set payment due date (typically 7 days from booking creation)
    const paymentDueDate = new Date();
    paymentDueDate.setDate(paymentDueDate.getDate() + 7);

    // Create booking
    const booking = this.bookingRepository.create({
      hostelId,
      roomId,
      studentId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      bookingType,
      totalAmount,
      amountDue: totalAmount,
      paymentDueDate,
      ...bookingData
    });

    const savedBooking = await this.bookingRepository.save(booking);

    // Reserve the room (increase current occupancy)
    room.currentOccupancy += 1;
    if (room.currentOccupancy >= room.maxOccupancy) {
      room.status = RoomStatus.OCCUPIED;
    }
    await this.roomRepository.save(room);

    return savedBooking;
  }

  /**
   * Validates that a user can only have one active booking at a time
   * @param studentId - The student's ID
   * @throws ConflictException if user already has an active booking
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
        `You already have an active booking (${statusText}) at ${existingBooking.hostel?.name || 'Unknown Hostel'}, Room ${existingBooking.room?.roomNumber || 'N/A'}. Please complete or cancel your current booking before creating a new one.`
      );
    }
  }

  /**
   * Validates that the user's gender is compatible with the room type
   * @param user - The user attempting to book
   * @param room - The room being booked
   * @throws BadRequestException if gender is not compatible
   */
  private async validateGenderCompatibility(user: User, room: Room): Promise<void> {
    // If user hasn't specified gender, allow booking but warn
    if (!user.gender || user.gender === Gender.PREFER_NOT_TO_SAY) {
      // You might want to log this or handle it differently
      return;
    }

    // Get room type with gender restrictions
    const roomType = await this.roomTypeRepository.findOne({
      where: { id: room.roomType.id }
    });

    if (!roomType) {
      throw new NotFoundException('Room type not found');
    }

    // Check if room type has gender restrictions
    if (roomType.allowedGenders && roomType.allowedGenders.length > 0) {
      const userGender = user.gender.toLowerCase();
      const allowedGenders = roomType.allowedGenders.map(g => g.toLowerCase());

      if (!allowedGenders.includes(userGender) && !allowedGenders.includes('mixed')) {
        const allowedGendersText = allowedGenders.join(', ');
        throw new BadRequestException(
          `This room is restricted to ${allowedGendersText} students only. Your profile gender (${user.gender}) is not compatible with this room type.`
        );
      }
    }

    // Additional check: if room has existing occupants, verify gender compatibility
    await this.validateRoomGenderMix(user, room);
  }

  /**
   * Validates that adding this user won't create gender conflicts in the room
   * @param user - The user attempting to book
   * @param room - The room being booked
   * @throws BadRequestException if gender mix would be incompatible
   */
  private async validateRoomGenderMix(user: User, room: Room): Promise<void> {
    // Get current active bookings for this room
    const currentBookings = await this.bookingRepository.find({
      where: {
        roomId: room.id,
        status: In([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN])
      },
      relations: ['room', 'room.roomType']
    });

    if (currentBookings.length === 0) {
      return; // No current occupants, no conflict
    }

    // Get genders of current occupants
    const currentOccupantIds = currentBookings.map(booking => booking.studentId);
    const currentOccupants = await this.userRepository.find({
      where: { id: In(currentOccupantIds) }
    });

    const currentGenders = currentOccupants
      .map(occupant => occupant.gender?.toLowerCase())
      .filter(gender => gender && gender !== Gender.PREFER_NOT_TO_SAY.toLowerCase());

    // If no specific genders or room allows mixed, allow booking
    const roomType = room.roomType;
    if (!roomType.allowedGenders || 
        roomType.allowedGenders.includes('mixed') || 
        currentGenders.length === 0) {
      return;
    }

    // Check if new user's gender matches existing occupants
    const userGender = user.gender?.toLowerCase();
    if (userGender && userGender !== Gender.PREFER_NOT_TO_SAY.toLowerCase()) {
      const existingGender = currentGenders[0]; // Assume all current occupants have same gender
      if (existingGender && userGender !== existingGender) {
        throw new BadRequestException(
          `This room currently has ${existingGender} occupants. Mixed gender occupancy is not allowed in this room type.`
        );
      }
    }
  }

// Calculate booking amount based on room type and booking duration
  private async calculateBookingAmount(roomType: RoomType, bookingType: BookingType, checkIn: Date, checkOut: Date): Promise<number> {
    const duration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    
    switch (bookingType) {
      case BookingType.SEMESTER:
        return roomType.pricePerSemester;
      case BookingType.MONTHLY:
        const months = Math.ceil(duration / 30);
        return roomType.pricePerMonth * months;
      case BookingType.WEEKLY:
        const weeks = Math.ceil(duration / 7);
        return roomType.pricePerWeek ? roomType.pricePerWeek * weeks : roomType.pricePerMonth * weeks / 4;
      default:
        throw new BadRequestException('Invalid booking type');
    }
  }

  // Get bookings with filtering and pagination
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
      sortOrder = 'DESC'
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

    if (status) {
      queryBuilder.andWhere('booking.status = :status', { status });
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
        '(booking.studentName ILIKE :search OR booking.studentEmail ILIKE :search OR booking.studentPhone ILIKE :search OR room.roomNumber ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Apply sorting
    queryBuilder.orderBy(`booking.${sortBy}`, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

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
  }

  // Get booking by ID
  async getBookingById(id: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['hostel', 'room', 'room.roomType']
    });

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

    // Free up the room
    const room = await this.roomRepository.findOne({ where: { id: booking.roomId } });
    if (room) {
      room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
      if (room.currentOccupancy === 0) {
        room.status = RoomStatus.AVAILABLE;
      }
      await this.roomRepository.save(room);
    }

    booking.status = BookingStatus.CANCELLED;
    booking.cancelledAt = new Date();
    booking.cancellationReason = cancelDto.reason;
    if (cancelDto.notes) {
      booking.notes = booking.notes ? `${booking.notes}\n${cancelDto.notes}` : cancelDto.notes;
    }

    // Update payment status
    booking.paymentStatus = PaymentStatus.REFUNDED;

    return await this.bookingRepository.save(booking);
  }

  // Check in student
  async checkIn(id: string, checkInDto: CheckInDto): Promise<Booking> {
    const booking = await this.getBookingById(id);

    if (!booking.canCheckIn()) {
      throw new BadRequestException('Booking cannot be checked in');
    }

    // Verify payment is complete or sufficient
    if (booking.paymentStatus === PaymentStatus.PENDING || booking.amountDue > 0) {
      throw new BadRequestException('Payment must be completed before check-in');
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

  // Check out student
  async checkOut(id: string, checkOutDto: CheckOutDto): Promise<Booking> {
    const booking = await this.getBookingById(id);

    if (!booking.canCheckOut()) {
      throw new BadRequestException('Booking cannot be checked out');
    }

    booking.status = BookingStatus.CHECKED_OUT;
    booking.checkedOutAt = new Date();
    if (checkOutDto.notes) {
      booking.notes = booking.notes ? `${booking.notes}\n${checkOutDto.notes}` : checkOutDto.notes;
    }

    // Free up the room
    const room = await this.roomRepository.findOne({ where: { id: booking.roomId } });
    if (room) {
      room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
      if (room.currentOccupancy === 0) {
        room.status = RoomStatus.AVAILABLE;
      }
      await this.roomRepository.save(room);
    }

    return await this.bookingRepository.save(booking);
  }

async recordPayment(bookingId: string, paymentDto: PaymentDto, receivedBy?: string): Promise<{ payment: Payment; booking: Booking }> {
  // Use transaction to ensure both payment and booking updates succeed together
  return await this.dataSource.transaction(async manager => {
    // Get booking with lock to prevent concurrent updates
    const booking = await manager.findOne(Booking, {
      where: { id: bookingId },
      lock: { mode: 'pessimistic_write' } // Remove relations
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Cannot record payment for cancelled booking');
    }

    // Convert to number and validate
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
      receivedBy
    });

    const savedPayment = await manager.save(Payment, payment);

    // Update booking payment status with explicit number conversion
    const currentAmountPaid = Number(booking.amountPaid) || 0;
    const totalAmount = Number(booking.totalAmount);
    
    booking.amountPaid = currentAmountPaid + paymentAmount;
    booking.amountDue = totalAmount - booking.amountPaid;

    // Update payment status based on amount due
    if (booking.amountDue <= 0) {
      booking.paymentStatus = PaymentStatus.PAID;
      booking.amountDue = 0; // Ensure it's exactly 0
    } else if (booking.amountPaid > 0) {
      booking.paymentStatus = PaymentStatus.PARTIAL;
    }

// After creating payment, refresh booking if needed
const updatedBooking = await manager.save(Booking, booking);


    console.log('Payment recorded:', {
      paymentId: savedPayment.id,
      amount: savedPayment.amount,
      bookingId: updatedBooking.id,
      previousAmountPaid: currentAmountPaid,
      newAmountPaid: updatedBooking.amountPaid,
      amountDue: updatedBooking.amountDue,
      paymentStatus: updatedBooking.paymentStatus
    });

    return { 
      payment: savedPayment, 
      booking: updatedBooking 
    };
  });
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
    return await this.bookingRepository.find({
      where: { studentId },
      relations: ['hostel', 'room', 'room.roomType'],
      order: { createdAt: 'DESC' }
    });
  }

  // Get bookings by hostel
  async getBookingsByHostel(hostelId: string, filterDto: Partial<BookingFilterDto> = {}): Promise<Booking[]> {
    const where: any = { hostelId };

    if (filterDto.status) where.status = filterDto.status;
    if (filterDto.paymentStatus) where.paymentStatus = filterDto.paymentStatus;

    return await this.bookingRepository.find({
      where,
      relations: ['room', 'room.roomType'],
      order: { createdAt: 'DESC' }
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

    // Free up the room if it was reserved
    if ([BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(booking.status)) {
      const room = await this.roomRepository.findOne({ where: { id: booking.roomId } });
      if (room) {
        room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
        if (room.currentOccupancy === 0) {
          room.status = RoomStatus.AVAILABLE;
        }
        await this.roomRepository.save(room);
      }
    }

    await this.bookingRepository.remove(booking);
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
      byBookingType: {} as Record<string, number>,
      byPaymentStatus: {} as Record<string, number>,
      averageStayDuration: 0,
      occupancyRate: 0
    };

    let totalDuration = 0;

    bookings.forEach(booking => {
      // Status counts
      stats[booking.status]++;

      // Revenue calculations
      stats.totalRevenue += Number(booking.totalAmount);
      stats.paidRevenue += Number(booking.amountPaid);
      stats.pendingRevenue += Number(booking.amountDue);

      // Booking type distribution
      stats.byBookingType[booking.bookingType] = (stats.byBookingType[booking.bookingType] || 0) + 1;

      // Payment status distribution
      stats.byPaymentStatus[booking.paymentStatus] = (stats.byPaymentStatus[booking.paymentStatus] || 0) + 1;

      // Duration calculation
      totalDuration += booking.getDurationInDays();
    });

    stats.averageStayDuration = bookings.length > 0 ? totalDuration / bookings.length : 0;

    return stats;
  }

  // Generate booking report
  async generateReport(filterDto: BookingReportFilterDto) {
    const { hostelId, startDate, endDate, reportType = 'bookings' } = filterDto;

    let queryBuilder = this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.hostel', 'hostel')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoinAndSelect('room.roomType', 'roomType');

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
      averageBookingValue: 0,
      revenueByMonth: {} as Record<string, number>,
      revenueByHostel: {} as Record<string, number>
    };

    bookings.forEach(booking => {
      const revenue = Number(booking.totalAmount);
      const paid = Number(booking.amountPaid);
      const pending = Number(booking.amountDue);

      report.totalRevenue += revenue;
      report.paidRevenue += paid;
      report.pendingRevenue += pending;

      // Revenue by month
      const month = booking.createdAt.toISOString().substring(0, 7);
      report.revenueByMonth[month] = (report.revenueByMonth[month] || 0) + revenue;

      // Revenue by hostel
      const hostelName = booking.hostel?.name || 'Unknown';
      report.revenueByHostel[hostelName] = (report.revenueByHostel[hostelName] || 0) + revenue;
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
      collectionRate: 0
    };

    bookings.forEach(booking => {
      const paid = Number(booking.amountPaid);
      const total = Number(booking.totalAmount);
      const due = Number(booking.amountDue);

      report.totalCollected += paid;
      report.totalPending += due;

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
      cancellationRate: 0
    };

    let totalLeadTime = 0;
    let cancellations = 0;

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
    });

    report.averageLeadTime = bookings.length > 0 ? totalLeadTime / bookings.length : 0;
    report.cancellationRate = bookings.length > 0 ? (cancellations / bookings.length) * 100 : 0;

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
}