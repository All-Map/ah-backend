import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { RecentActivityDto } from './dto/recent-activity.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(): Promise<DashboardStatsDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const [
      totalUsers,
      newUsersToday,
      totalHostels,
      verifiedHostels,
      totalBookings,
      activeBookings,
      payments,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { createdAt: { gt: yesterday } },
      }),
      this.prisma.hostel.count(),
      this.prisma.hostel.count({ where: { isVerified: true } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: BookingStatus.checked_in } }),
      this.prisma.payment.findMany({
        where: {
          paymentDate: { gte: startOfMonth, lte: today },
        },
      }),
    ]);

    const totalRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    const previousMonthPayments = await this.prisma.payment.findMany({
      where: {
        paymentDate: { gte: startOfPreviousMonth, lte: endOfPreviousMonth },
      },
    });

    const previousMonthRevenue = previousMonthPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );

    const revenueThisMonth = totalRevenue;
    const revenueGrowth =
      previousMonthRevenue > 0
        ? ((totalRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
        : 100;

    const usersPreviousMonth = await this.prisma.user.count({
      where: {
        createdAt: { gte: startOfPreviousMonth, lte: endOfPreviousMonth },
      },
    });

    const userGrowth =
      usersPreviousMonth > 0 ? ((totalUsers - usersPreviousMonth) / usersPreviousMonth) * 100 : 100;

    const bookingsPreviousMonth = await this.prisma.booking.count({
      where: {
        createdAt: { gte: startOfPreviousMonth, lte: endOfPreviousMonth },
      },
    });

    const bookingGrowth =
      bookingsPreviousMonth > 0
        ? ((totalBookings - bookingsPreviousMonth) / bookingsPreviousMonth) * 100
        : 100;

    return {
      totalUsers,
      newUsersToday,
      totalHostels,
      verifiedHostels,
      totalBookings,
      activeBookings,
      totalRevenue,
      revenueThisMonth,
      userGrowth: Math.round(userGrowth * 10) / 10,
      bookingGrowth: Math.round(bookingGrowth * 10) / 10,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    };
  }

  async getRecentActivities(limit: number = 10): Promise<RecentActivityDto[]> {
    const activities: RecentActivityDto[] = [];

    const recentUsers = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    recentUsers.forEach((user) => {
      activities.push({
        id: user.id,
        type: 'user',
        action: 'REGISTERED',
        description: `New user registered: ${user.name || user.email}`,
        timestamp: user.createdAt ?? new Date(),
        user: {
          id: user.id,
          name: user.name || 'Unnamed User',
          email: user.email,
        },
        metadata: {
          role: user.role,
          isVerified: user.isVerified,
        },
      });
    });

    const recentBookings = await this.prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { hostel: true, room: true },
    });

    recentBookings.forEach((booking) => {
      activities.push({
        id: booking.id,
        type: 'booking',
        action: String(booking.status).toUpperCase(),
        description: `Booking ${booking.status} for ${booking.studentName}`,
        timestamp: booking.createdAt,
        metadata: {
          hostelName: booking.hostel?.name,
          roomNumber: booking.room?.roomNumber,
          amount: Number(booking.totalAmount),
          status: booking.status,
        },
      });
    });

    const recentPayments = await this.prisma.payment.findMany({
      orderBy: { paymentDate: 'desc' },
      take: 5,
      include: { booking: true },
    });

    recentPayments.forEach((payment) => {
      activities.push({
        id: payment.id,
        type: 'payment',
        action: 'PAYMENT_COMPLETED',
        description: `Payment of ₵${payment.amount} received`,
        timestamp: payment.paymentDate,
        metadata: {
          amount: Number(payment.amount),
          method: payment.paymentMethod,
        },
      });
    });

    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async getUsersOverview() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 7);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const [totalUsers, usersThisWeek, usersThisMonth, usersPreviousMonth, byRole] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gt: startOfWeek } } }),
      this.prisma.user.count({ where: { createdAt: { gt: startOfMonth } } }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfPreviousMonth, lte: endOfPreviousMonth } },
      }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
    ]);

    const userGrowth =
      usersPreviousMonth > 0 ? ((usersThisMonth - usersPreviousMonth) / usersPreviousMonth) * 100 : 100;

    return {
      total: totalUsers,
      weekly: usersThisWeek,
      monthly: usersThisMonth,
      growth: Math.round(userGrowth * 10) / 10,
      byRole: byRole.reduce(
        (acc, row) => {
          acc[row.role] = row._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  async getBookingsOverview() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const [totalBookings, bookingsThisMonth, bookingsPreviousMonth, byStatus, byType] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { createdAt: { gt: startOfMonth } } }),
      this.prisma.booking.count({
        where: { createdAt: { gte: startOfPreviousMonth, lte: endOfPreviousMonth } },
      }),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.booking.groupBy({
        by: ['bookingType'],
        _count: true,
      }),
    ]);

    const bookingGrowth =
      bookingsPreviousMonth > 0
        ? ((bookingsThisMonth - bookingsPreviousMonth) / bookingsPreviousMonth) * 100
        : 100;

    return {
      total: totalBookings,
      monthly: bookingsThisMonth,
      growth: Math.round(bookingGrowth * 10) / 10,
      byStatus: byStatus.reduce(
        (acc, row) => {
          acc[row.status] = row._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byType: byType.reduce(
        (acc, row) => {
          acc[row.bookingType] = row._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  async getHostelsOverview() {
    const [totalHostels, verifiedHostels, acceptingBookings, byVerified, byAccepting] = await Promise.all([
      this.prisma.hostel.count(),
      this.prisma.hostel.count({ where: { isVerified: true } }),
      this.prisma.hostel.count({ where: { acceptingBookings: true } }),
      this.prisma.hostel.groupBy({
        by: ['isVerified'],
        _count: true,
      }),
      this.prisma.hostel.groupBy({
        by: ['acceptingBookings'],
        _count: true,
      }),
    ]);

    const verificationRate = totalHostels > 0 ? (verifiedHostels / totalHostels) * 100 : 0;

    return {
      total: totalHostels,
      verified: verifiedHostels,
      acceptingBookings,
      verificationRate: Math.round(verificationRate * 10) / 10,
      byVerificationStatus: byVerified.reduce(
        (acc, row) => {
          acc[row.isVerified ? 'verified' : 'unverified'] = row._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byBookingStatus: byAccepting.reduce(
        (acc, row) => {
          acc[row.acceptingBookings ? 'accepting' : 'closed'] = row._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  async getRevenueOverview(period: 'daily' | 'weekly' | 'monthly' = 'monthly') {
    const today = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    let previousEndDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 1);
        previousEndDate = new Date(startDate);
        break;

      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 7);
        previousEndDate = new Date(startDate);
        break;

      case 'monthly':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        previousStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        previousEndDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
    }

    const [currentPayments, previousPayments, byMethod] = await Promise.all([
      this.prisma.payment.findMany({
        where: { paymentDate: { gte: startDate, lte: today } },
      }),
      this.prisma.payment.findMany({
        where: { paymentDate: { gte: previousStartDate, lte: previousEndDate } },
      }),
      this.prisma.payment.groupBy({
        by: ['paymentMethod'],
        where: { paymentDate: { gte: startDate, lte: today } },
        _sum: { amount: true },
      }),
    ]);

    const currentRevenue = currentPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    const previousRevenue = previousPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    const revenueGrowth =
      previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : currentRevenue > 0
          ? 100
          : 0;

    return {
      total: currentRevenue,
      previous: previousRevenue,
      growth: Math.round(revenueGrowth * 10) / 10,
      byMethod: byMethod.reduce(
        (acc, row) => {
          acc[row.paymentMethod] = Number(row._sum.amount ?? 0);
          return acc;
        },
        {} as Record<string, number>,
      ),
      byStatus: {} as Record<string, number>,
      period,
    };
  }
}
