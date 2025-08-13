// booking-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Between } from 'typeorm';
import { Booking, BookingStatus, PaymentStatus } from '../entities/booking.entity';
import { NotificationsService } from './notifications.service';
import { BookingsService } from './bookings.service';
import { RoomStatus } from 'src/entities/room.entity';

@Injectable()
export class BookingSchedulerService {
  private readonly logger = new Logger(BookingSchedulerService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly notificationsService: NotificationsService,
    private readonly bookingsService: BookingsService,
  ) {}

  // Run every hour to send check-in reminders
  @Cron('0 * * * *') // Every hour at minute 0
  async sendCheckInReminders(): Promise<void> {
    this.logger.log('Running check-in reminder job');

    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const nextDay = new Date(tomorrow);
      nextDay.setDate(nextDay.getDate() + 1);

      // Get bookings with check-in tomorrow
      const bookings = await this.bookingRepository.find({
        where: {
          status: BookingStatus.CONFIRMED,
          checkInDate: Between(tomorrow, nextDay),
        },
        relations: ['hostel', 'room'],
      });

      this.logger.log(`Found ${bookings.length} bookings requiring check-in reminders`);

      for (const booking of bookings) {
        try {
          await this.notificationsService.sendCheckInReminder(booking);
          this.logger.log(`Check-in reminder sent for booking ${booking.id}`);
        } catch (error) {
          this.logger.error(`Failed to send check-in reminder for booking ${booking.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error in check-in reminder job:', error);
    }
  }

  // Run every hour to send check-out reminders
  @Cron('0 * * * *') // Every hour at minute 0
  async sendCheckOutReminders(): Promise<void> {
    this.logger.log('Running check-out reminder job');

    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const nextDay = new Date(tomorrow);
      nextDay.setDate(nextDay.getDate() + 1);

      // Get bookings with check-out tomorrow
      const bookings = await this.bookingRepository.find({
        where: {
          status: BookingStatus.CHECKED_IN,
          checkOutDate: Between(tomorrow, nextDay),
        },
        relations: ['hostel', 'room'],
      });

      this.logger.log(`Found ${bookings.length} bookings requiring check-out reminders`);

      for (const booking of bookings) {
        try {
          await this.notificationsService.sendCheckOutReminder(booking);
          this.logger.log(`Check-out reminder sent for booking ${booking.id}`);
        } catch (error) {
          this.logger.error(`Failed to send check-out reminder for booking ${booking.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error in check-out reminder job:', error);
    }
  }

  // Run daily at 9 AM to send payment reminders
  @Cron('0 9 * * *') // Daily at 9 AM
  async sendPaymentReminders(): Promise<void> {
    this.logger.log('Running payment reminder job');

    try {
      const today = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(today.getDate() + 3);

      // Get bookings with payment due in 3 days or overdue
      const bookings = await this.bookingRepository.find({
        where: [
          {
            paymentStatus: PaymentStatus.PENDING,
            paymentDueDate: LessThan(threeDaysFromNow),
            status: BookingStatus.CONFIRMED,
          },
          {
            paymentStatus: PaymentStatus.PARTIAL,
            paymentDueDate: LessThan(threeDaysFromNow),
            status: BookingStatus.CONFIRMED,
          },
        ],
        relations: ['hostel', 'room'],
      });

      this.logger.log(`Found ${bookings.length} bookings requiring payment reminders`);

      for (const booking of bookings) {
        try {
          await this.notificationsService.sendPaymentReminder(booking);
          this.logger.log(`Payment reminder sent for booking ${booking.id}`);
        } catch (error) {
          this.logger.error(`Failed to send payment reminder for booking ${booking.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error in payment reminder job:', error);
    }
  }

  // Run daily at midnight to mark overdue payments
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async markOverduePayments(): Promise<void> {
    this.logger.log('Running overdue payment marking job');

    try {
      await this.bookingsService.markOverdueBookings();
      this.logger.log('Overdue payments marked successfully');
    } catch (error) {
      this.logger.error('Error marking overdue payments:', error);
    }
  }

  // Run daily at 1 AM to auto-cancel unpaid bookings
  @Cron('0 1 * * *') // Daily at 1 AM
  async autoCancelUnpaidBookings(): Promise<void> {
    this.logger.log('Running auto-cancel unpaid bookings job');

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Find bookings that are overdue for more than 7 days
      const overdueBookings = await this.bookingRepository.find({
        where: {
          status: BookingStatus.PENDING,
          paymentStatus: PaymentStatus.OVERDUE,
          paymentDueDate: LessThan(sevenDaysAgo),
        },
        relations: ['hostel', 'room'],
      });

      this.logger.log(`Found ${overdueBookings.length} bookings to auto-cancel`);

      for (const booking of overdueBookings) {
        try {
          await this.bookingsService.cancelBooking(booking.id, {
            reason: 'Automatic cancellation due to non-payment',
            notes: 'Booking automatically cancelled after 7 days of payment overdue',
          });

          await this.notificationsService.sendBookingCancellation(booking);
          this.logger.log(`Auto-cancelled booking ${booking.id}`);
        } catch (error) {
          this.logger.error(`Failed to auto-cancel booking ${booking.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error in auto-cancel job:', error);
    }
  }

  // Run every Sunday at 10 AM to generate weekly reports
  @Cron('0 10 * * 0') // Every Sunday at 10 AM
  async generateWeeklyReports(): Promise<void> {
    this.logger.log('Running weekly report generation job');

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      const report = await this.bookingsService.generateReport({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        reportType: 'bookings',
      });

      // Here you could email the report to administrators
      this.logger.log('Weekly report generated:', JSON.stringify(report, null, 2));
    } catch (error) {
      this.logger.error('Error generating weekly report:', error);
    }
  }

  // Run at 11 PM daily to check for no-show bookings
  @Cron('0 23 * * *') // Daily at 11 PM
  async markNoShowBookings(): Promise<void> {
    this.logger.log('Running no-show booking check');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Find confirmed bookings where check-in date was yesterday and student didn't check in
      const noShowBookings = await this.bookingRepository.find({
        where: {
          status: BookingStatus.CONFIRMED,
          checkInDate: Between(yesterday, today),
        },
        relations: ['hostel', 'room'],
      });

      this.logger.log(`Found ${noShowBookings.length} potential no-show bookings`);

      for (const booking of noShowBookings) {
        try {
          booking.status = BookingStatus.NO_SHOW;
          await this.bookingRepository.save(booking);

          // Free up the room
          const room = await this.bookingsService['roomRepository'].findOne({
            where: { id: booking.roomId },
          });
          if (room) {
            room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
            if (room.currentOccupancy === 0) {
              room.status = RoomStatus.AVAILABLE;
            }
            await this.bookingsService['roomRepository'].save(room);
          }

          // Send notification
        //   await this.notificationsService.sendNotification({
        //     type: 'email',
        //     recipient: booking.studentEmail,
        //     subject: 'No-Show - Booking Cancelled',
        //     message: `
        //       Dear ${booking.studentName},

        //       Your booking (ID: ${booking.id}) has been marked as a no-show as you did not check in on the scheduled date.

        //       If this was a mistake, please contact us immediately.

        //       Best regards,
        //       Hostel Management Team
        //     `,
        //     data: { booking },
        //   });

          this.logger.log(`Marked booking ${booking.id} as no-show`);
        } catch (error) {
          this.logger.error(`Failed to mark booking ${booking.id} as no-show:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error in no-show check job:', error);
    }
  }

  // Run monthly on the 1st at 8 AM to clean up old data
  @Cron('0 8 1 * *') // Monthly on 1st at 8 AM
  async cleanupOldData(): Promise<void> {
    this.logger.log('Running monthly data cleanup job');

    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Archive or delete old completed bookings (older than 6 months)
      const oldBookings = await this.bookingRepository.find({
        where: {
          status: BookingStatus.CHECKED_OUT,
          updatedAt: LessThan(sixMonthsAgo),
        },
      });

      this.logger.log(`Found ${oldBookings.length} old bookings for cleanup`);

      // Here you might want to archive instead of delete
      // For now, we'll just log what would be cleaned up
      for (const booking of oldBookings) {
        this.logger.log(`Would archive/cleanup booking ${booking.id} from ${booking.updatedAt}`);
      }

      // You could also clean up old payment records, logs, etc.
    } catch (error) {
      this.logger.error('Error in cleanup job:', error);
    }
  }

  // Run every 30 minutes to sync room availability
  @Cron('*/30 * * * *') // Every 30 minutes
  async syncRoomAvailability(): Promise<void> {
    this.logger.log('Running room availability sync job');

    try {
      // Get all active bookings
      const activeBookings = await this.bookingRepository.find({
        where: {
          status: BookingStatus.CHECKED_IN,
        },
        relations: ['room'],
      });

      // Group by room
      const roomOccupancy = new Map<string, number>();
      activeBookings.forEach((booking) => {
        const roomId = booking.roomId;
        roomOccupancy.set(roomId, (roomOccupancy.get(roomId) || 0) + 1);
      });

      // Update room occupancy
      for (const [roomId, occupancy] of roomOccupancy) {
        try {
          const room = await this.bookingsService['roomRepository'].findOne({
            where: { id: roomId },
          });
          if (room && room.currentOccupancy !== occupancy) {
            room.currentOccupancy = occupancy;
            room.status = occupancy >= room.maxOccupancy ? RoomStatus.OCCUPIED : RoomStatus.AVAILABLE;
            await this.bookingsService['roomRepository'].save(room);
            this.logger.log(`Updated room ${roomId} occupancy to ${occupancy}`);
          }
        } catch (error) {
          this.logger.error(`Failed to sync occupancy for room ${roomId}:`, error);
        }
      }

      this.logger.log('Room availability sync completed');
    } catch (error) {
      this.logger.error('Error in room availability sync job:', error);
    }
  }

  // Manual trigger methods for testing
  async triggerCheckInReminders(): Promise<void> {
    await this.sendCheckInReminders();
  }

  async triggerPaymentReminders(): Promise<void> {
    await this.sendPaymentReminders();
  }

  async triggerOverdueMarking(): Promise<void> {
    await this.markOverduePayments();
  }

  // Health check method
  async getSchedulerHealth(): Promise<{
    status: string;
    lastRun: Record<string, Date>;
    nextRun: Record<string, Date>;
  }> {
    // This would typically check the last run times of various jobs
    return {
      status: 'healthy',
      lastRun: {
        checkInReminders: new Date(),
        paymentReminders: new Date(),
        overdueMarking: new Date(),
      },
      nextRun: {
        checkInReminders: new Date(Date.now() + 60 * 60 * 1000), // Next hour
        paymentReminders: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        overdueMarking: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      },
    };
  }
}