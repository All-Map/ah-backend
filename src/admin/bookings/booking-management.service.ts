import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Like, Not, IsNull } from 'typeorm';
import { Booking, BookingStatus, BookingType, PaymentStatus } from '../../entities/booking.entity';
import { User } from '../../entities/user.entity';
import { Hostel } from '../../entities/hostel.entity';
import { Room } from '../../entities/room.entity';
import { RoomType } from '../../entities/room-type.entity';
import { Payment } from '../../entities/payment.entity';

export interface BookingRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  student?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    gender: string;
    school_id: string;
  } | null;
  hostelId: string;
  hostel: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  roomId: string;
  room: {
    id: string;
    roomNumber: string;
    floor: string;
    maxOccupancy: number;
    currentOccupancy: number;
    roomTypeId: string;
    roomType?: {
      id: string;
      name: string;
      pricePerSemester: number;
      pricePerMonth: number;
      pricePerWeek: number;
    };
  };
  bookingType: BookingType;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  checkInDate: Date;
  checkOutDate: Date;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  bookingFee: number;
  bookingFeePaid: boolean;
  paymentReference?: string;
  specialRequests?: string;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  }>;
  notes?: string;
  createdAt: Date;
  confirmedAt?: Date;
  checkedInAt?: Date;
  checkedOutAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  duration: number;
  isOverdue: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  canCancel: boolean;
  paymentProgress: number;
}

export interface BookingStats {
  totalBookings: number;
  activeBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  checkedInBookings: number;
  checkedOutBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  pendingRevenue: number;
  collectedRevenue: number;
  bookingFeesCollected: number;
  byBookingType: Record<string, number>;
  byPaymentStatus: Record<string, number>;
  occupancyRate: number;
  averageStayDuration: number;
  cancellationRate: number;
  growthRate: number;
}

export interface BookingFilters {
  hostelId?: string;
  roomId?: string;
  studentId?: string;
  status?: BookingStatus | BookingStatus[];
  paymentStatus?: PaymentStatus;
  bookingType?: BookingType;
  checkInFrom?: string;
  checkInTo?: string;
  search?: string;
  overdueOnly?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class BookingManagementService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Hostel)
    private readonly hostelRepository: Repository<Hostel>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(RoomType)
    private readonly roomTypeRepository: Repository<RoomType>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async getBookings(filters?: BookingFilters): Promise<{
    bookings: BookingRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.hostel', 'hostel')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoin('room.roomType', 'roomType')
      .select([
        'booking.id',
        'booking.studentId',
        'booking.studentName',
        'booking.studentEmail',
        'booking.studentPhone',
        'booking.hostelId',
        'booking.roomId',
        'booking.bookingType',
        'booking.status',
        'booking.paymentStatus',
        'booking.checkInDate',
        'booking.checkOutDate',
        'booking.totalAmount',
        'booking.amountPaid',
        'booking.amountDue',
        'booking.bookingFee',
        'booking.bookingFeePaid',
        'booking.paymentReference',
        'booking.specialRequests',
        'booking.emergencyContacts',
        'booking.notes',
        'booking.createdAt',
        'booking.confirmedAt',
        'booking.checkedInAt',
        'booking.checkedOutAt',
        'booking.cancelledAt',
        'booking.cancellationReason',
        'hostel.id',
        'hostel.name',
        'hostel.email',
        'hostel.phone',
        'hostel.address',
        'room.id',
        'room.roomNumber',
        'room.floor',
        'room.maxOccupancy',
        'room.currentOccupancy',
        'room.roomTypeId',
        'roomType.id',
        'roomType.name',
        'roomType.pricePerSemester',
        'roomType.pricePerMonth',
        'roomType.pricePerWeek',
      ]);

    // Apply filters
    if (filters?.hostelId) {
      queryBuilder.andWhere('booking.hostelId = :hostelId', { hostelId: filters.hostelId });
    }

    if (filters?.roomId) {
      queryBuilder.andWhere('booking.roomId = :roomId', { roomId: filters.roomId });
    }

    if (filters?.studentId) {
      queryBuilder.andWhere('booking.studentId = :studentId', { studentId: filters.studentId });
    }

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        queryBuilder.andWhere('booking.status IN (:...status)', { status: filters.status });
      } else {
        queryBuilder.andWhere('booking.status = :status', { status: filters.status });
      }
    }

    if (filters?.paymentStatus) {
      queryBuilder.andWhere('booking.paymentStatus = :paymentStatus', { paymentStatus: filters.paymentStatus });
    }

    if (filters?.bookingType) {
      queryBuilder.andWhere('booking.bookingType = :bookingType', { bookingType: filters.bookingType });
    }

    if (filters?.checkInFrom && filters?.checkInTo) {
      queryBuilder.andWhere('booking.checkInDate BETWEEN :checkInFrom AND :checkInTo', {
        checkInFrom: filters.checkInFrom,
        checkInTo: filters.checkInTo,
      });
    } else if (filters?.checkInFrom) {
      queryBuilder.andWhere('booking.checkInDate >= :checkInFrom', { checkInFrom: filters.checkInFrom });
    } else if (filters?.checkInTo) {
      queryBuilder.andWhere('booking.checkInDate <= :checkInTo', { checkInTo: filters.checkInTo });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(booking.studentName ILIKE :search OR booking.studentEmail ILIKE :search OR booking.studentPhone ILIKE :search OR hostel.name ILIKE :search OR room.roomNumber ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters?.overdueOnly) {
      queryBuilder.andWhere('booking.paymentStatus = :overdueStatus', { overdueStatus: PaymentStatus.OVERDUE });
    }

    // Apply sorting
    const sortBy = filters?.sortBy || 'createdAt';
    const sortOrder = filters?.sortOrder || 'DESC';
    queryBuilder.orderBy(`booking.${sortBy}`, sortOrder);

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const [bookings, total] = await queryBuilder.getManyAndCount();

    // Transform bookings with additional calculated fields
    const now = new Date();
    const transformedBookings = await Promise.all(
      bookings.map(async (booking) => {
        // Get student details if available
        let student: User | null = null;
        if (booking.studentId) {
          const studentData = await this.userRepository.findOne({
            where: { id: booking.studentId },
            select: ['id', 'name', 'email', 'phone', 'gender', 'school_id'],
          });
          if (studentData) {
            student = studentData;
          }
        }

        // Calculate duration
        const checkIn = new Date(booking.checkInDate);
        const checkOut = new Date(booking.checkOutDate);
        const duration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

        // Determine status flags
        const isOverdue = booking.paymentStatus === PaymentStatus.OVERDUE || 
          (booking.paymentDueDate && new Date(booking.paymentDueDate) < now && booking.paymentStatus !== PaymentStatus.PAID);
        
        const canCheckIn = booking.status === BookingStatus.CONFIRMED && 
          checkIn <= now && 
          booking.paymentStatus === PaymentStatus.PAID;
        
        const canCheckOut = booking.status === BookingStatus.CHECKED_IN;
        const canCancel = [BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(booking.status);

        // Calculate payment progress
        const totalCost = booking.totalAmount + booking.bookingFee;
        const paymentProgress = totalCost > 0 ? (booking.amountPaid / totalCost) * 100 : 0;

        return {
          ...booking,
          student,
          room: {
            ...booking.room,
            floor: booking.room.floor.toString(),
            roomType: booking.room.roomType ? {
              ...booking.room.roomType,
              pricePerWeek: booking.room.roomType.pricePerWeek ?? 0,
            } : undefined,
          },
          duration,
          isOverdue,
          canCheckIn,
          canCheckOut,
          canCancel,
          paymentProgress,
        };
      }),
    );

    return {
      bookings: transformedBookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBookingStats(): Promise<BookingStats> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000);
    const previousPeriodEnd = new Date(thirtyDaysAgo.getTime() - 1 * 24 * 60 * 60 * 1000);

    const [
      totalBookings,
      activeBookings,
      pendingBookings,
      confirmedBookings,
      checkedInBookings,
      checkedOutBookings,
      cancelledBookings,
      totalRevenue,
      pendingRevenue,
      collectedRevenue,
      bookingFeesCollected,
      byBookingType,
      byPaymentStatus,
      currentPeriodBookings,
      previousPeriodBookings,
      allBookings,
    ] = await Promise.all([
      this.bookingRepository.count(),
      this.bookingRepository.count({ where: { status: In([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]) } }),
      this.bookingRepository.count({ where: { status: BookingStatus.PENDING } }),
      this.bookingRepository.count({ where: { status: BookingStatus.CONFIRMED } }),
      this.bookingRepository.count({ where: { status: BookingStatus.CHECKED_IN } }),
      this.bookingRepository.count({ where: { status: BookingStatus.CHECKED_OUT } }),
      this.bookingRepository.count({ where: { status: BookingStatus.CANCELLED } }),
      this.bookingRepository
        .createQueryBuilder('booking')
        .select('SUM(booking.totalAmount + booking.bookingFee)', 'total')
        .getRawOne(),
      this.bookingRepository
        .createQueryBuilder('booking')
        .select('SUM(booking.amountDue)', 'total')
        .getRawOne(),
      this.bookingRepository
        .createQueryBuilder('booking')
        .select('SUM(booking.amountPaid)', 'total')
        .getRawOne(),
      this.bookingRepository
        .createQueryBuilder('booking')
        .select('SUM(booking.bookingFee)', 'total')
        .where('booking.bookingFeePaid = :paid', { paid: true })
        .getRawOne(),
      this.bookingRepository
        .createQueryBuilder('booking')
        .select('booking.bookingType, COUNT(*) as count')
        .groupBy('booking.bookingType')
        .getRawMany(),
      this.bookingRepository
        .createQueryBuilder('booking')
        .select('booking.paymentStatus, COUNT(*) as count')
        .groupBy('booking.paymentStatus')
        .getRawMany(),
      this.bookingRepository.count({ where: { createdAt: Between(thirtyDaysAgo, now) } }),
      this.bookingRepository.count({ where: { createdAt: Between(previousPeriodStart, previousPeriodEnd) } }),
      this.bookingRepository.find({
        select: ['checkInDate', 'checkOutDate', 'status', 'paymentStatus'],
      }),
    ]);

    // Calculate occupancy rate
    const totalRooms = await this.roomRepository.count();
    const occupiedRooms = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('COUNT(DISTINCT booking.roomId) as count')
      .where('booking.status IN (:...statuses)', {
        statuses: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
      })
      .getRawOne();
    
    const occupancyRate = totalRooms > 0 ? 
      (parseInt(occupiedRooms?.count) / totalRooms) * 100 : 0;

    // Calculate average stay duration
    let averageStayDuration = 0;
    if (allBookings.length > 0) {
      const totalDuration = allBookings.reduce((sum, booking) => {
        const checkIn = new Date(booking.checkInDate);
        const checkOut = new Date(booking.checkOutDate);
        return sum + Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      averageStayDuration = totalDuration / allBookings.length;
    }

    // Calculate cancellation rate
    const cancellationRate = totalBookings > 0 ? 
      (cancelledBookings / totalBookings) * 100 : 0;

    // Calculate growth rate
    const growthRate = previousPeriodBookings > 0 ? 
      ((currentPeriodBookings - previousPeriodBookings) / previousPeriodBookings) * 100 : 
      currentPeriodBookings > 0 ? 100 : 0;

    return {
      totalBookings,
      activeBookings,
      pendingBookings,
      confirmedBookings,
      checkedInBookings,
      checkedOutBookings,
      cancelledBookings,
      totalRevenue: parseFloat(totalRevenue?.total) || 0,
      pendingRevenue: parseFloat(pendingRevenue?.total) || 0,
      collectedRevenue: parseFloat(collectedRevenue?.total) || 0,
      bookingFeesCollected: parseFloat(bookingFeesCollected?.total) || 0,
      byBookingType: byBookingType.reduce((acc, row) => {
        acc[row.booking_bookingType] = parseInt(row.count);
        return acc;
      }, {}),
      byPaymentStatus: byPaymentStatus.reduce((acc, row) => {
        acc[row.booking_paymentStatus] = parseInt(row.count);
        return acc;
      }, {}),
      occupancyRate: Math.round(occupancyRate * 10) / 10,
      averageStayDuration: Math.round(averageStayDuration * 10) / 10,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      growthRate: Math.round(growthRate * 10) / 10,
    };
  }

  async getBookingById(id: string): Promise<BookingRecord> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['hostel', 'room', 'room.roomType', 'payments'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Get student details
    let student: User | null = null;
    if (booking.studentId) {
      student = await this.userRepository.findOne({
        where: { id: booking.studentId },
        select: ['id', 'name', 'email', 'phone', 'gender', 'school_id'],
      });
    }

    // Get hostel details
    const hostel = await this.hostelRepository.findOne({
      where: { id: booking.hostelId },
      select: ['id', 'name', 'email', 'phone', 'address'],
    });

    if (!hostel) {
      throw new NotFoundException('Hostel not found');
    }

    // Get room details
    const room = await this.roomRepository.findOne({
      where: { id: booking.roomId },
      relations: ['roomType'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Calculate derived fields
    const now = new Date();
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    const duration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    const isOverdue = booking.paymentStatus === PaymentStatus.OVERDUE || 
      (booking.paymentDueDate && new Date(booking.paymentDueDate) < now && booking.paymentStatus !== PaymentStatus.PAID);
    
    const canCheckIn = booking.status === BookingStatus.CONFIRMED && 
      checkIn <= now && 
      booking.paymentStatus === PaymentStatus.PAID;
    
    const canCheckOut = booking.status === BookingStatus.CHECKED_IN;
    const canCancel = [BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(booking.status);

    const totalCost = booking.totalAmount + booking.bookingFee;
    const paymentProgress = totalCost > 0 ? (booking.amountPaid / totalCost) * 100 : 0;

    return {
      ...booking,
      student,
      hostel,
      room: {
        ...room,
        floor: room.floor.toString(),
        roomType: room.roomType ? {
          ...room.roomType,
          pricePerWeek: room.roomType.pricePerWeek ?? 0,
        } : undefined,
      },
      duration,
      isOverdue,
      canCheckIn,
      canCheckOut,
      canCancel,
      paymentProgress,
    };
  }

  async updateBookingStatus(id: string, status: BookingStatus, notes?: string): Promise<BookingRecord> {
    const booking = await this.getBookingById(id);

    // Validate status transition
    switch (status) {
      case BookingStatus.CONFIRMED:
        if (booking.status !== BookingStatus.PENDING) {
          throw new BadRequestException('Only pending bookings can be confirmed');
        }
        booking.confirmedAt = new Date();
        break;
      
      case BookingStatus.CHECKED_IN:
        if (booking.status !== BookingStatus.CONFIRMED) {
          throw new BadRequestException('Only confirmed bookings can be checked in');
        }
        if (!booking.canCheckIn) {
          throw new BadRequestException('Booking cannot be checked in. Ensure payment is complete.');
        }
        booking.checkedInAt = new Date();
        break;
      
      case BookingStatus.CHECKED_OUT:
        if (booking.status !== BookingStatus.CHECKED_IN) {
          throw new BadRequestException('Only checked-in bookings can be checked out');
        }
        booking.checkedOutAt = new Date();
        break;
      
      case BookingStatus.CANCELLED:
        if (!booking.canCancel) {
          throw new BadRequestException('Booking cannot be cancelled');
        }
        booking.cancelledAt = new Date();
        break;
    }

    booking.status = status;
    if (notes) {
      booking.notes = booking.notes ? `${booking.notes}\n${notes}` : notes;
    }

    const bookingEntity = await this.bookingRepository.findOne({ where: { id } });
    if (bookingEntity) {
      bookingEntity.status = status;
      if (notes) {
        bookingEntity.notes = bookingEntity.notes ? `${bookingEntity.notes}\n${notes}` : notes;
      }
      await this.bookingRepository.save(bookingEntity);
    }
    return this.getBookingById(id);
  }

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<BookingRecord> {
    const booking = await this.bookingRepository.findOne({ where: { id } });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    booking.paymentStatus = paymentStatus;
    await this.bookingRepository.save(booking);
    return this.getBookingById(id);
  }

  async getBookingPayments(id: string) {
    return this.paymentRepository.find({
      where: { bookingId: id },
      order: { paymentDate: 'DESC' },
    });
  }

  async addPaymentToBooking(
    id: string,
    data: {
      amount: number;
      paymentMethod: string;
      transactionRef: string;
      notes?: string;
    },
  ): Promise<{ booking: BookingRecord; payment: any }> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      select: ['id', 'amountPaid', 'amountDue', 'totalAmount'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Create payment record
    const payment = this.paymentRepository.create({
      bookingId: id,
      amount: data.amount,
      paymentMethod: data.paymentMethod as any,
      transactionRef: data.transactionRef,
      notes: data.notes,
      paymentDate: new Date(),
    });

    await this.paymentRepository.save(payment);

    // Update booking payment status
    booking.amountPaid += data.amount;
    booking.amountDue = Math.max(0, booking.totalAmount - booking.amountPaid);
    
    if (booking.amountDue <= 0) {
      booking.paymentStatus = PaymentStatus.PAID;
    } else if (booking.amountPaid > 0) {
      booking.paymentStatus = PaymentStatus.PARTIAL;
    }

    await this.bookingRepository.save(booking);

    return {
      booking: await this.getBookingById(id),
      payment,
    };
  }

  async exportBookings(filters?: BookingFilters): Promise<string> {
    const { bookings } = await this.getBookings({ ...filters, limit: 1000 });

    const headers = [
      'Booking ID',
      'Student Name',
      'Student Email',
      'Student Phone',
      'Hostel Name',
      'Room Number',
      'Booking Type',
      'Status',
      'Payment Status',
      'Check-in Date',
      'Check-out Date',
      'Duration (days)',
      'Total Amount',
      'Amount Paid',
      'Amount Due',
      'Booking Fee',
      'Booking Fee Paid',
      'Payment Reference',
      'Created Date',
      'Confirmed Date',
      'Checked-in Date',
      'Checked-out Date',
      'Cancelled Date',
      'Cancellation Reason',
    ];

    const rows = bookings.map(booking => [
      booking.id,
      booking.studentName,
      booking.studentEmail,
      booking.studentPhone,
      booking.hostel?.name || '',
      booking.room?.roomNumber || '',
      booking.bookingType,
      booking.status,
      booking.paymentStatus,
      new Date(booking.checkInDate).toISOString().split('T')[0],
      new Date(booking.checkOutDate).toISOString().split('T')[0],
      booking.duration.toString(),
      booking.totalAmount.toString(),
      booking.amountPaid.toString(),
      booking.amountDue.toString(),
      booking.bookingFee.toString(),
      booking.bookingFeePaid ? 'Yes' : 'No',
      booking.paymentReference || '',
      new Date(booking.createdAt).toISOString(),
      booking.confirmedAt ? new Date(booking.confirmedAt).toISOString() : '',
      booking.checkedInAt ? new Date(booking.checkedInAt).toISOString() : '',
      booking.checkedOutAt ? new Date(booking.checkedOutAt).toISOString() : '',
      booking.cancelledAt ? new Date(booking.cancelledAt).toISOString() : '',
      booking.cancellationReason || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }

  async getUpcomingCheckIns(days: number = 7) {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);

    const bookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.hostel', 'hostel')
      .leftJoinAndSelect('booking.room', 'room')
      .where('booking.checkInDate BETWEEN :today AND :futureDate', {
        today: today.toISOString().split('T')[0],
        futureDate: futureDate.toISOString().split('T')[0],
      })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: [BookingStatus.CONFIRMED],
      })
      .orderBy('booking.checkInDate', 'ASC')
      .getMany();

    return bookings;
  }

  async getUpcomingCheckOuts(days: number = 7) {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);

    const bookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.hostel', 'hostel')
      .leftJoinAndSelect('booking.room', 'room')
      .where('booking.checkOutDate BETWEEN :today AND :futureDate', {
        today: today.toISOString().split('T')[0],
        futureDate: futureDate.toISOString().split('T')[0],
      })
      .andWhere('booking.status = :status', {
        status: BookingStatus.CHECKED_IN,
      })
      .orderBy('booking.checkOutDate', 'ASC')
      .getMany();

    return bookings;
  }

  async getOverdueBookings() {
    const today = new Date();

    const bookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.hostel', 'hostel')
      .leftJoinAndSelect('booking.room', 'room')
      .where('booking.paymentStatus = :status', { status: PaymentStatus.OVERDUE })
      .orWhere('(booking.paymentDueDate < :today AND booking.paymentStatus != :paidStatus)', {
        today,
        paidStatus: PaymentStatus.PAID,
      })
      .andWhere('booking.status IN (:...activeStatuses)', {
        activeStatuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      })
      .orderBy('booking.paymentDueDate', 'ASC')
      .getMany();

    return bookings;
  }
}