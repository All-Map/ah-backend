import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Booking,
  BookingStatus,
  BookingType,
  PaymentStatusEnum,
  PaymentMethodEnum,
  PaymentTypeEnum,
  Prisma,
  User,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface BookingRecord {
  id: string;
  studentId: string | null;
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
  paymentStatus: PaymentStatusEnum;
  checkInDate: Date;
  checkOutDate: Date;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  bookingFee: number;
  bookingFeePaid: boolean;
  paymentReference?: string | null;
  specialRequests?: string | null;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  }>;
  notes?: string | null;
  createdAt: Date;
  confirmedAt?: Date | null;
  checkedInAt?: Date | null;
  checkedOutAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  paymentDueDate?: Date | null;
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
  paymentStatus?: PaymentStatusEnum;
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

function parsePaymentMethod(method: string): PaymentMethodEnum {
  const m = method.toLowerCase().replace(/-/g, '_') as PaymentMethodEnum;
  if (Object.values(PaymentMethodEnum).includes(m)) {
    return m;
  }
  return PaymentMethodEnum.cash;
}

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: { hostel: true; room: { include: { roomType: true } } };
}>;

@Injectable()
export class BookingManagementService {
  constructor(private readonly prisma: PrismaService) {}

  private async buildBookingRecord(full: BookingWithRelations): Promise<BookingRecord> {
    let student: Pick<User, 'id' | 'name' | 'email' | 'phone' | 'gender' | 'schoolId'> | null = null;
    if (full.studentId) {
      student = await this.prisma.user.findUnique({
        where: { id: full.studentId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          gender: true,
          schoolId: true,
        },
      });
    }

    const checkIn = new Date(full.checkInDate);
    const checkOut = new Date(full.checkOutDate);
    const now = new Date();
    const duration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    const isOverdue =
      full.paymentStatus === PaymentStatusEnum.overdue ||
      (!!full.paymentDueDate &&
        new Date(full.paymentDueDate) < now &&
        full.paymentStatus !== PaymentStatusEnum.paid);

    const canCheckIn =
      full.status === BookingStatus.confirmed &&
      checkIn <= now &&
      full.paymentStatus === PaymentStatusEnum.paid;

    const canCheckOut = full.status === BookingStatus.checked_in;
    const canCancel =
      full.status === BookingStatus.pending || full.status === BookingStatus.confirmed;

    const totalCost = Number(full.totalAmount) + Number(full.bookingFee);
    const paymentProgress =
      totalCost > 0 ? (Number(full.amountPaid) / totalCost) * 100 : 0;

    const room = full.room!;
    const rt = room.roomType;

    return {
      id: full.id,
      studentId: full.studentId,
      studentName: full.studentName,
      studentEmail: full.studentEmail,
      studentPhone: full.studentPhone,
      student: student
        ? {
            id: student.id,
            name: student.name ?? '',
            email: student.email,
            phone: student.phone ?? '',
            gender: student.gender ?? '',
            school_id: student.schoolId ?? '',
          }
        : null,
      hostelId: full.hostelId,
      hostel: {
        id: full.hostel!.id,
        name: full.hostel!.name,
        email: full.hostel!.email,
        phone: full.hostel!.phone,
        address: full.hostel!.address,
      },
      roomId: full.roomId,
      room: {
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor != null ? String(room.floor) : '',
        maxOccupancy: room.maxOccupancy,
        currentOccupancy: room.currentOccupancy,
        roomTypeId: room.roomTypeId,
        roomType: rt
          ? {
              id: rt.id,
              name: rt.name,
              pricePerSemester: Number(rt.pricePerSemester),
              pricePerMonth: Number(rt.pricePerMonth),
              pricePerWeek: Number(rt.pricePerWeek ?? 0),
            }
          : undefined,
      },
      bookingType: full.bookingType,
      status: full.status,
      paymentStatus: full.paymentStatus,
      checkInDate: full.checkInDate,
      checkOutDate: full.checkOutDate,
      totalAmount: Number(full.totalAmount),
      amountPaid: Number(full.amountPaid),
      amountDue: Number(full.amountDue),
      bookingFee: Number(full.bookingFee),
      bookingFeePaid: full.bookingFeePaid,
      paymentReference: full.paymentReference,
      specialRequests: full.specialRequests,
      emergencyContacts: (full.emergencyContacts as BookingRecord['emergencyContacts']) || [],
      notes: full.notes,
      createdAt: full.createdAt,
      confirmedAt: full.confirmedAt,
      checkedInAt: full.checkedInAt,
      checkedOutAt: full.checkedOutAt,
      cancelledAt: full.cancelledAt,
      cancellationReason: full.cancellationReason,
      paymentDueDate: full.paymentDueDate,
      duration,
      isOverdue,
      canCheckIn,
      canCheckOut,
      canCancel,
      paymentProgress,
    };
  }

  private async toBookingRecordById(id: string): Promise<BookingRecord> {
    const full = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        hostel: true,
        room: { include: { roomType: true } },
      },
    });
    if (!full) {
      throw new NotFoundException('Booking not found');
    }
    return this.buildBookingRecord(full);
  }

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

    const where: Prisma.BookingWhereInput = {};

    if (filters?.hostelId) where.hostelId = filters.hostelId;
    if (filters?.roomId) where.roomId = filters.roomId;
    if (filters?.studentId) where.studentId = filters.studentId;

    if (filters?.status) {
      where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
    }

    if (filters?.paymentStatus) where.paymentStatus = filters.paymentStatus;
    if (filters?.bookingType) where.bookingType = filters.bookingType;

    if (filters?.checkInFrom && filters?.checkInTo) {
      where.checkInDate = { gte: new Date(filters.checkInFrom), lte: new Date(filters.checkInTo) };
    } else if (filters?.checkInFrom) {
      where.checkInDate = { gte: new Date(filters.checkInFrom) };
    } else if (filters?.checkInTo) {
      where.checkInDate = { lte: new Date(filters.checkInTo) };
    }

    if (filters?.overdueOnly) {
      where.paymentStatus = PaymentStatusEnum.overdue;
    }

    if (filters?.search) {
      const s = filters.search;
      where.OR = [
        { studentName: { contains: s, mode: 'insensitive' } },
        { studentEmail: { contains: s, mode: 'insensitive' } },
        { studentPhone: { contains: s, mode: 'insensitive' } },
        { hostel: { name: { contains: s, mode: 'insensitive' } } },
        { room: { roomNumber: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const sortBy = filters?.sortBy || 'createdAt';
    const sortOrder = String(filters?.sortOrder || 'DESC').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const sortFieldMap: Record<string, Prisma.BookingScalarFieldEnum> = {
      createdAt: 'createdAt',
      checkInDate: 'checkInDate',
      checkOutDate: 'checkOutDate',
      status: 'status',
      totalAmount: 'totalAmount',
    };
    const orderField = sortFieldMap[sortBy] ?? 'createdAt';

    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: { hostel: true, room: { include: { roomType: true } } },
      }),
      this.prisma.booking.count({ where }),
    ]);

    const bookings = await Promise.all(rows.map((b) => this.buildBookingRecord(b)));

    return {
      bookings,
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
      currentPeriodBookings,
      previousPeriodBookings,
      allBookings,
      byBookingType,
      byPaymentStatus,
      totalRooms,
    ] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.count({
        where: { status: { in: [BookingStatus.confirmed, BookingStatus.checked_in] } },
      }),
      this.prisma.booking.count({ where: { status: BookingStatus.pending } }),
      this.prisma.booking.count({ where: { status: BookingStatus.confirmed } }),
      this.prisma.booking.count({ where: { status: BookingStatus.checked_in } }),
      this.prisma.booking.count({ where: { status: BookingStatus.checked_out } }),
      this.prisma.booking.count({ where: { status: BookingStatus.cancelled } }),
      this.prisma.booking.count({
        where: { createdAt: { gte: thirtyDaysAgo, lte: now } },
      }),
      this.prisma.booking.count({
        where: { createdAt: { gte: previousPeriodStart, lte: previousPeriodEnd } },
      }),
      this.prisma.booking.findMany({
        select: { checkInDate: true, checkOutDate: true, status: true, paymentStatus: true },
      }),
      this.prisma.booking.groupBy({ by: ['bookingType'], _count: true }),
      this.prisma.booking.groupBy({ by: ['paymentStatus'], _count: true }),
      this.prisma.room.count(),
    ]);

    const bookingFeesAgg = await this.prisma.booking.aggregate({
      _sum: { bookingFee: true },
      where: { bookingFeePaid: true },
    });

    const totalRevenueSum = await this.prisma.booking.aggregate({
      _sum: { totalAmount: true, bookingFee: true },
    });

    const pendingRevenueSum = await this.prisma.booking.aggregate({
      _sum: { amountDue: true },
    });

    const collectedRevenueSum = await this.prisma.booking.aggregate({
      _sum: { amountPaid: true },
    });

    const occupiedRooms = await this.prisma.booking.findMany({
      where: { status: { in: [BookingStatus.confirmed, BookingStatus.checked_in] } },
      distinct: ['roomId'],
      select: { roomId: true },
    });

    const occupancyRate =
      totalRooms > 0 ? (occupiedRooms.length / totalRooms) * 100 : 0;

    let averageStayDuration = 0;
    if (allBookings.length > 0) {
      const totalDuration = allBookings.reduce((sum, booking) => {
        const checkIn = new Date(booking.checkInDate);
        const checkOut = new Date(booking.checkOutDate);
        return sum + Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      averageStayDuration = totalDuration / allBookings.length;
    }

    const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;

    const growthRate =
      previousPeriodBookings > 0
        ? ((currentPeriodBookings - previousPeriodBookings) / previousPeriodBookings) * 100
        : currentPeriodBookings > 0
          ? 100
          : 0;

    return {
      totalBookings,
      activeBookings,
      pendingBookings,
      confirmedBookings,
      checkedInBookings,
      checkedOutBookings,
      cancelledBookings,
      totalRevenue: Number(totalRevenueSum._sum.totalAmount ?? 0) + Number(totalRevenueSum._sum.bookingFee ?? 0),
      pendingRevenue: Number(pendingRevenueSum._sum.amountDue ?? 0),
      collectedRevenue: Number(collectedRevenueSum._sum.amountPaid ?? 0),
      bookingFeesCollected: Number(bookingFeesAgg._sum.bookingFee ?? 0),
      byBookingType: byBookingType.reduce(
        (acc, row) => {
          acc[row.bookingType] = row._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byPaymentStatus: byPaymentStatus.reduce(
        (acc, row) => {
          acc[row.paymentStatus] = row._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      occupancyRate: Math.round(occupancyRate * 10) / 10,
      averageStayDuration: Math.round(averageStayDuration * 10) / 10,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      growthRate: Math.round(growthRate * 10) / 10,
    };
  }

  async getBookingById(id: string): Promise<BookingRecord> {
    return this.toBookingRecordById(id);
  }

  async updateBookingStatus(id: string, status: BookingStatus, notes?: string): Promise<BookingRecord> {
    const current = await this.toBookingRecordById(id);

    switch (status) {
      case BookingStatus.confirmed:
        if (current.status !== BookingStatus.pending) {
          throw new BadRequestException('Only pending bookings can be confirmed');
        }
        break;
      case BookingStatus.checked_in:
        if (current.status !== BookingStatus.confirmed) {
          throw new BadRequestException('Only confirmed bookings can be checked in');
        }
        if (!current.canCheckIn) {
          throw new BadRequestException('Booking cannot be checked in. Ensure payment is complete.');
        }
        break;
      case BookingStatus.checked_out:
        if (current.status !== BookingStatus.checked_in) {
          throw new BadRequestException('Only checked-in bookings can be checked out');
        }
        break;
      case BookingStatus.cancelled:
        if (!current.canCancel) {
          throw new BadRequestException('Booking cannot be cancelled');
        }
        break;
      default:
        break;
    }

    const data: Prisma.BookingUpdateInput = {
      status,
      ...(notes
        ? {
            notes: current.notes ? `${current.notes}\n${notes}` : notes,
          }
        : {}),
    };

    if (status === BookingStatus.confirmed) data.confirmedAt = new Date();
    if (status === BookingStatus.checked_in) data.checkedInAt = new Date();
    if (status === BookingStatus.checked_out) data.checkedOutAt = new Date();
    if (status === BookingStatus.cancelled) data.cancelledAt = new Date();

    await this.prisma.booking.update({
      where: { id },
      data,
    });

    return this.toBookingRecordById(id);
  }

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatusEnum): Promise<BookingRecord> {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    await this.prisma.booking.update({
      where: { id },
      data: { paymentStatus },
    });

    return this.toBookingRecordById(id);
  }

  async getBookingPayments(id: string) {
    return this.prisma.payment.findMany({
      where: { bookingId: id },
      orderBy: { paymentDate: 'desc' },
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
  ): Promise<{ booking: BookingRecord; payment: unknown }> {
    const booking = await this.prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          bookingId: id,
          amount: new Prisma.Decimal(data.amount),
          paymentMethod: parsePaymentMethod(data.paymentMethod),
          paymentType: PaymentTypeEnum.booking_payment,
          transactionRef: data.transactionRef,
          notes: data.notes,
        },
      });

      const newPaid = Number(booking.amountPaid) + data.amount;
      const newDue = Math.max(0, Number(booking.totalAmount) - newPaid);

      let paymentStatus: PaymentStatusEnum = booking.paymentStatus;
      if (newDue <= 0) {
        paymentStatus = PaymentStatusEnum.paid;
      } else if (newPaid > 0) {
        paymentStatus = PaymentStatusEnum.partial;
      }

      await tx.booking.update({
        where: { id },
        data: {
          amountPaid: new Prisma.Decimal(newPaid),
          amountDue: new Prisma.Decimal(newDue),
          paymentStatus,
        },
      });

      return p;
    });

    return {
      booking: await this.toBookingRecordById(id),
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

    const rows = bookings.map((booking) => [
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

    return [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join(
      '\n',
    );
  }

  async getUpcomingCheckIns(days: number = 7) {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);

    return this.prisma.booking.findMany({
      where: {
        checkInDate: {
          gte: new Date(today.toISOString().split('T')[0]),
          lte: new Date(futureDate.toISOString().split('T')[0]),
        },
        status: BookingStatus.confirmed,
      },
      include: { hostel: true, room: true },
      orderBy: { checkInDate: 'asc' },
    });
  }

  async getUpcomingCheckOuts(days: number = 7) {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);

    return this.prisma.booking.findMany({
      where: {
        checkOutDate: {
          gte: new Date(today.toISOString().split('T')[0]),
          lte: new Date(futureDate.toISOString().split('T')[0]),
        },
        status: BookingStatus.checked_in,
      },
      include: { hostel: true, room: true },
      orderBy: { checkOutDate: 'asc' },
    });
  }

  async getOverdueBookings() {
    const today = new Date();

    return this.prisma.booking.findMany({
      where: {
        AND: [
          {
            OR: [
              { paymentStatus: PaymentStatusEnum.overdue },
              {
                paymentDueDate: { lt: today },
                paymentStatus: { not: PaymentStatusEnum.paid },
              },
            ],
          },
          { status: { in: [BookingStatus.pending, BookingStatus.confirmed] } },
        ],
      },
      include: { hostel: true, room: true },
      orderBy: { paymentDueDate: 'asc' },
    });
  }
}
