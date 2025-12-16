import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { User } from '../entities/user.entity';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { Hostel } from '../entities/hostel.entity';
import { Payment } from '../entities/payment.entity';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { RecentActivityDto } from './dto/recent-activity.dto';

interface DashboardStats {
  totalUsers: number;
  newUsersToday: number;
  totalHostels: number;
  verifiedHostels: number;
  totalBookings: number;
  activeBookings: number;
  totalRevenue: number;
  revenueThisMonth: number;
  userGrowth: number;
  bookingGrowth: number;
  revenueGrowth: number;
}

interface RecentActivity {
  id: string;
  type: 'user' | 'booking' | 'hostel' | 'payment';
  action: string;
  description: string;
  timestamp: Date;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  metadata?: Record<string, any>;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Hostel)
    private readonly hostelRepository: Repository<Hostel>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async getDashboardStats(): Promise<DashboardStatsDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Get all counts
    const [
      totalUsers,
      newUsersToday,
      totalHostels,
      verifiedHostels,
      totalBookings,
      activeBookings,
      payments,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { verified_at: MoreThan(yesterday) } }),
      this.hostelRepository.count(),
      this.hostelRepository.count({ where: { is_verified: true } }),
      this.bookingRepository.count(),
      this.bookingRepository.count({ where: { status: BookingStatus.CHECKED_IN } }),
      this.paymentRepository.find({ 
        where: { 
          paymentDate: Between(startOfMonth, today) 
        } 
      }),
    ]);

    // Calculate revenue
    const totalRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    
    // Get previous month data for growth calculation
    const previousMonthPayments = await this.paymentRepository.find({
      where: {
        paymentDate: Between(startOfPreviousMonth, endOfPreviousMonth)
      }
    });
    
    const previousMonthRevenue = previousMonthPayments.reduce(
      (sum, payment) => sum + Number(payment.amount), 0
    );
    
    const revenueThisMonth = totalRevenue;
    const revenueGrowth = previousMonthRevenue > 0 
      ? ((totalRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
      : 100;

    // Get user growth
    const usersPreviousMonth = await this.userRepository.count({
      where: {
        verified_at: Between(startOfPreviousMonth, endOfPreviousMonth)
      }
    });
    
    const userGrowth = usersPreviousMonth > 0 
      ? ((totalUsers - usersPreviousMonth) / usersPreviousMonth) * 100 
      : 100;

    // Get booking growth
    const bookingsPreviousMonth = await this.bookingRepository.count({
      where: {
        createdAt: Between(startOfPreviousMonth, endOfPreviousMonth)
      }
    });
    
    const bookingGrowth = bookingsPreviousMonth > 0 
      ? ((totalBookings - bookingsPreviousMonth) / bookingsPreviousMonth) * 100 
      : 100;

    // Count pending payments

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

    // Get recent users
    const recentUsers = await this.userRepository.find({
      order: { verified_at: 'DESC' },
      take: 5,
    });

    recentUsers.forEach(user => {
      activities.push({
        id: user.id,
        type: 'user',
        action: 'REGISTERED',
        description: `New user registered: ${user.name || user.email}`,
        timestamp: user.verified_at,
        user: {
          id: user.id,
          name: user.name || 'Unnamed User',
          email: user.email,
        },
        metadata: {
          role: user.role,
          isVerified: user.is_verified,
        }
      });
    });

    // Get recent bookings
    const recentBookings = await this.bookingRepository.find({
      order: { createdAt: 'DESC' },
      take: 5,
      relations: ['hostel', 'room'],
    });

    recentBookings.forEach(booking => {
      activities.push({
        id: booking.id,
        type: 'booking',
        action: booking.status.toUpperCase(),
        description: `Booking ${booking.status} for ${booking.studentName}`,
        timestamp: booking.createdAt,
        metadata: {
          hostelName: booking.hostel?.name,
          roomNumber: booking.room?.roomNumber,
          amount: booking.totalAmount,
          status: booking.status,
        }
      });
    });

    // Get recent payments
    const recentPayments = await this.paymentRepository.find({
      order: { paymentDate: 'DESC' },
      take: 5,
      relations: ['booking'],
    });

    recentPayments.forEach(payment => {
      activities.push({
        id: payment.id,
        type: 'payment',
        action: 'PAYMENT_COMPLETED',
        description: `Payment of ₵${payment.amount} received`,
        timestamp: payment.paymentDate,
        metadata: {
          amount: payment.amount,
          method: payment.paymentMethod,
      }
      });
    });

    // Sort by timestamp and limit
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

    const [
      totalUsers,
      usersThisWeek,
      usersThisMonth,
      usersPreviousMonth,
      byRole,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { verified_at: MoreThan(startOfWeek) } }),
      this.userRepository.count({ where: { verified_at: MoreThan(startOfMonth) } }),
      this.userRepository.count({ 
        where: { verified_at: Between(startOfPreviousMonth, endOfPreviousMonth) } 
      }),
      this.userRepository
        .createQueryBuilder('user')
        .select('user.role, COUNT(*) as count')
        .groupBy('user.role')
        .getRawMany(),
    ]);

    const userGrowth = usersPreviousMonth > 0 
      ? ((usersThisMonth - usersPreviousMonth) / usersPreviousMonth) * 100 
      : 100;

    return {
      total: totalUsers,
      weekly: usersThisWeek,
      monthly: usersThisMonth,
      growth: Math.round(userGrowth * 10) / 10,
      byRole: byRole.reduce((acc, row) => {
        acc[row.user_role] = parseInt(row.count);
        return acc;
      }, {}),
    };
  }

  async getBookingsOverview() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const [
      totalBookings,
      bookingsThisMonth,
      bookingsPreviousMonth,
      byStatus,
      byType,
    ] = await Promise.all([
      this.bookingRepository.count(),
      this.bookingRepository.count({ where: { createdAt: MoreThan(startOfMonth) } }),
      this.bookingRepository.count({ 
        where: { createdAt: Between(startOfPreviousMonth, endOfPreviousMonth) } 
      }),
      this.bookingRepository
        .createQueryBuilder('booking')
        .select('booking.status, COUNT(*) as count')
        .groupBy('booking.status')
        .getRawMany(),
      this.bookingRepository
        .createQueryBuilder('booking')
        .select('booking.bookingType, COUNT(*) as count')
        .groupBy('booking.bookingType')
        .getRawMany(),
    ]);

    const bookingGrowth = bookingsPreviousMonth > 0 
      ? ((bookingsThisMonth - bookingsPreviousMonth) / bookingsPreviousMonth) * 100 
      : 100;

    return {
      total: totalBookings,
      monthly: bookingsThisMonth,
      growth: Math.round(bookingGrowth * 10) / 10,
      byStatus: byStatus.reduce((acc, row) => {
        acc[row.booking_status] = parseInt(row.count);
        return acc;
      }, {}),
      byType: byType.reduce((acc, row) => {
        acc[row.booking_bookingType] = parseInt(row.count);
        return acc;
      }, {}),
    };
  }

  async getHostelsOverview() {
    const [
      totalHostels,
      verifiedHostels,
      acceptingBookings,
      byVerificationStatus,
      byBookingStatus,
    ] = await Promise.all([
      this.hostelRepository.count(),
      this.hostelRepository.count({ where: { is_verified: true } }),
      this.hostelRepository.count({ where: { accepting_bookings: true } }),
      this.hostelRepository
        .createQueryBuilder('hostel')
        .select('hostel.is_verified, COUNT(*) as count')
        .groupBy('hostel.is_verified')
        .getRawMany(),
      this.hostelRepository
        .createQueryBuilder('hostel')
        .select('hostel.accepting_bookings, COUNT(*) as count')
        .groupBy('hostel.accepting_bookings')
        .getRawMany(),
    ]);

    const verificationRate = totalHostels > 0 
      ? (verifiedHostels / totalHostels) * 100 
      : 0;

    return {
      total: totalHostels,
      verified: verifiedHostels,
      acceptingBookings,
      verificationRate: Math.round(verificationRate * 10) / 10,
      byVerificationStatus: byVerificationStatus.reduce((acc, row) => {
        acc[row.hostel_is_verified ? 'verified' : 'unverified'] = parseInt(row.count);
        return acc;
      }, {}),
      byBookingStatus: byBookingStatus.reduce((acc, row) => {
        acc[row.hostel_accepting_bookings ? 'accepting' : 'closed'] = parseInt(row.count);
        return acc;
      }, {}),
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

    const [
      currentPayments,
      previousPayments,
      byMethod,
      byStatus,
    ] = await Promise.all([
      this.paymentRepository.find({ 
        where: { paymentDate: Between(startDate, today) } 
      }),
      this.paymentRepository.find({ 
        where: { paymentDate: Between(previousStartDate, previousEndDate) } 
      }),
      this.paymentRepository
        .createQueryBuilder('payment')
        .select('payment.paymentMethod, SUM(payment.amount) as total')
        .where('payment.paymentDate BETWEEN :startDate AND :endDate', {
          startDate,
          endDate: today
        })
        .groupBy('payment.paymentMethod')
        .getRawMany(),
      this.paymentRepository
        .createQueryBuilder('payment')
        .select('payment.status, COUNT(*) as count')
        .where('payment.paymentDate BETWEEN :startDate AND :endDate', {
          startDate,
          endDate: today
        })
        .groupBy('payment.status')
        .getRawMany(),
    ]);

    const currentRevenue = currentPayments.reduce(
      (sum, payment) => sum + Number(payment.amount), 0
    );
    
    const previousRevenue = previousPayments.reduce(
      (sum, payment) => sum + Number(payment.amount), 0
    );

    const revenueGrowth = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : currentRevenue > 0 ? 100 : 0;

    return {
      total: currentRevenue,
      previous: previousRevenue,
      growth: Math.round(revenueGrowth * 10) / 10,
      byMethod: byMethod.reduce((acc, row) => {
        acc[row.payment_paymentMethod] = parseFloat(row.total);
        return acc;
      }, {}),
      byStatus: byStatus.reduce((acc, row) => {
        acc[row.payment_status] = parseInt(row.count);
        return acc;
      }, {}),
      period,
    };
  }
}