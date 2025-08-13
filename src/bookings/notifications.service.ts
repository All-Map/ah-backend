// notifications.service.ts
import { Injectable } from '@nestjs/common';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';

export interface NotificationData {
  type: string;
  recipient: string;
  subject: string;
  message: string;
  data?: any;
}

@Injectable()
export class NotificationsService {

  // Email notification methods
  async sendBookingConfirmation(booking: Booking): Promise<void> {
    const notification: NotificationData = {
      type: 'email',
      recipient: booking.studentEmail,
      subject: 'Booking Confirmation - Your Hostel Reservation',
      message: `
        Dear ${booking.studentName},

        Your booking has been confirmed! Here are the details:

        Booking ID: ${booking.id}
        Hostel: ${booking.hostel?.name}
        Room: ${booking.room?.roomNumber}
        Check-in: ${booking.checkInDate.toDateString()}
        Check-out: ${booking.checkOutDate.toDateString()}
        Total Amount: $${booking.totalAmount}
        Amount Paid: $${booking.amountPaid}
        Amount Due: $${booking.amountDue}

        Please make sure to complete your payment before check-in.

        Best regards,
        Hostel Management Team
      `,
      data: { booking }
    };

    await this.sendNotification(notification);
  }

  async sendBookingCancellation(booking: Booking): Promise<void> {
    const notification: NotificationData = {
      type: 'email',
      recipient: booking.studentEmail,
      subject: 'Booking Cancellation - Reservation Cancelled',
      message: `
        Dear ${booking.studentName},

        Your booking has been cancelled.

        Booking ID: ${booking.id}
        Hostel: ${booking.hostel?.name}
        Room: ${booking.room?.roomNumber}
        Cancellation Reason: ${booking.cancellationReason}

        If you paid any amount, refunds will be processed within 3-5 business days.

        Best regards,
        Hostel Management Team
      `,
      data: { booking }
    };

    await this.sendNotification(notification);
  }

  async sendPaymentConfirmation(booking: Booking, payment: Payment): Promise<void> {
    const notification: NotificationData = {
      type: 'email',
      recipient: booking.studentEmail,
      subject: 'Payment Confirmation - Payment Received',
      message: `
        Dear ${booking.studentName},

        We have received your payment for booking ${booking.id}.

        Payment Details:
        Amount: $${payment.amount}
        Payment Method: ${payment.paymentMethod}
        Transaction Reference: ${payment.transactionRef}
        Date: ${payment.paymentDate.toDateString()}

        Booking Summary:
        Total Amount: $${booking.totalAmount}
        Amount Paid: $${booking.amountPaid}
        Remaining Balance: $${booking.amountDue}

        ${booking.amountDue === 0 ? 'Your booking is now fully paid!' : 'Please complete the remaining payment before check-in.'}

        Best regards,
        Hostel Management Team
      `,
      data: { booking, payment }
    };

    await this.sendNotification(notification);
  }

  async sendCheckInReminder(booking: Booking): Promise<void> {
    const checkInDate = new Date(booking.checkInDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Only send if check-in is tomorrow
    if (checkInDate.toDateString() !== tomorrow.toDateString()) {
      return;
    }

    const notification: NotificationData = {
      type: 'email',
      recipient: booking.studentEmail,
      subject: 'Check-in Reminder - Your Stay Starts Tomorrow',
      message: `
        Dear ${booking.studentName},

        This is a reminder that your check-in is scheduled for tomorrow!

        Booking Details:
        Hostel: ${booking.hostel?.name}
        Room: ${booking.room?.roomNumber}
        Check-in Date: ${booking.checkInDate.toDateString()}
        Check-out Date: ${booking.checkOutDate.toDateString()}

        ${booking.amountDue > 0 ? `Outstanding Balance: $${booking.amountDue} - Please complete payment before check-in.` : 'All payments are complete. You\'re ready to check in!'}

        Please bring a valid ID and this confirmation email.

        Best regards,
        Hostel Management Team
      `,
      data: { booking }
    };

    await this.sendNotification(notification);
  }

  async sendPaymentReminder(booking: Booking): Promise<void> {
    const daysUntilDue = Math.ceil(
      (new Date(booking.paymentDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    const notification: NotificationData = {
      type: 'email',
      recipient: booking.studentEmail,
      subject: `Payment Reminder - ${daysUntilDue <= 0 ? 'Payment Overdue' : `Payment Due in ${daysUntilDue} days`}`,
      message: `
        Dear ${booking.studentName},

        ${daysUntilDue <= 0 
          ? 'Your payment is now overdue. Please make the payment immediately to avoid cancellation of your booking.'
          : `This is a reminder that your payment is due in ${daysUntilDue} days.`
        }

        Booking Details:
        Booking ID: ${booking.id}
        Hostel: ${booking.hostel?.name}
        Room: ${booking.room?.roomNumber}
        Outstanding Amount: $${booking.amountDue}
        Due Date: ${booking.paymentDueDate?.toDateString()}

        Please make the payment as soon as possible to secure your reservation.

        Best regards,
        Hostel Management Team
      `,
      data: { booking }
    };

    await this.sendNotification(notification);
  }

  async sendCheckOutReminder(booking: Booking): Promise<void> {
    const checkOutDate = new Date(booking.checkOutDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Only send if check-out is tomorrow
    if (checkOutDate.toDateString() !== tomorrow.toDateString()) {
      return;
    }

    const notification: NotificationData = {
      type: 'email',
      recipient: booking.studentEmail,
      subject: 'Check-out Reminder - Your Stay Ends Tomorrow',
      message: `
        Dear ${booking.studentName},

        This is a reminder that your check-out is scheduled for tomorrow.

        Booking Details:
        Hostel: ${booking.hostel?.name}
        Room: ${booking.room?.roomNumber}
        Check-out Date: ${booking.checkOutDate.toDateString()}

        Please ensure you:
        - Pack all your belongings
        - Return any room keys or cards
        - Clear any outstanding dues
        - Complete the check-out process at the front desk

        Thank you for staying with us!

        Best regards,
        Hostel Management Team
      `,
      data: { booking }
    };

    await this.sendNotification(notification);
  }

  // SMS notification methods
  async sendSMSNotification(phoneNumber: string, message: string): Promise<void> {
    const notification: NotificationData = {
      type: 'sms',
      recipient: phoneNumber,
      subject: '',
      message,
      data: {}
    };

    await this.sendNotification(notification);
  }

  async sendBookingConfirmationSMS(booking: Booking): Promise<void> {
    const message = `Booking confirmed! ID: ${booking.id}, Room: ${booking.room?.roomNumber}, Check-in: ${booking.checkInDate.toDateString()}. Amount due: $${booking.amountDue}`;
    await this.sendSMSNotification(booking.studentPhone, message);
  }

  async sendPaymentConfirmationSMS(booking: Booking, payment: Payment): Promise<void> {
    const message = `Payment of $${payment.amount} received for booking ${booking.id}. Balance: $${booking.amountDue}. Thank you!`;
    await this.sendSMSNotification(booking.studentPhone, message);
  }

  // Admin notifications
  async notifyAdminNewBooking(booking: Booking, adminEmail: string): Promise<void> {
    const notification: NotificationData = {
      type: 'email',
      recipient: adminEmail,
      subject: 'New Booking Received',
      message: `
        A new booking has been received:

        Booking ID: ${booking.id}
        Student: ${booking.studentName} (${booking.studentEmail})
        Hostel: ${booking.hostel?.name}
        Room: ${booking.room?.roomNumber}
        Check-in: ${booking.checkInDate.toDateString()}
        Check-out: ${booking.checkOutDate.toDateString()}
        Amount: $${booking.totalAmount}
        Status: ${booking.status}

        Please review and confirm the booking.

        Admin Dashboard: [Your Dashboard URL]
      `,
      data: { booking }
    };

    await this.sendNotification(notification);
  }

  async notifyAdminPaymentReceived(booking: Booking, payment: Payment, adminEmail: string): Promise<void> {
    const notification: NotificationData = {
      type: 'email',
      recipient: adminEmail,
      subject: 'Payment Received',
      message: `
        Payment received for booking ${booking.id}:

        Student: ${booking.studentName}
        Payment Amount: $${payment.amount}
        Payment Method: ${payment.paymentMethod}
        Transaction Ref: ${payment.transactionRef}
        Remaining Balance: $${booking.amountDue}

        Admin Dashboard: [Your Dashboard URL]
      `,
      data: { booking, payment }
    };

    await this.sendNotification(notification);
  }

  // Bulk notification methods
  async sendBulkReminders(): Promise<void> {
    // This would typically be called by a cron job
    // Implementation would fetch bookings that need reminders and send them
    console.log('Sending bulk reminders...');
  }

  async sendBookingStatusUpdate(booking: Booking, oldStatus: BookingStatus, newStatus: BookingStatus): Promise<void> {
    let subject = '';
    let message = '';

    switch (newStatus) {
      case BookingStatus.CONFIRMED:
        subject = 'Booking Confirmed';
        message = `Your booking has been confirmed and is ready for check-in.`;
        break;
      case BookingStatus.CHECKED_IN:
        subject = 'Check-in Successful';
        message = `You have been successfully checked in. Welcome to ${booking.hostel?.name}!`;
        break;
      case BookingStatus.CHECKED_OUT:
        subject = 'Check-out Complete';
        message = `Thank you for staying with us. Your check-out is complete.`;
        break;
      case BookingStatus.CANCELLED:
        subject = 'Booking Cancelled';
        message = `Your booking has been cancelled. ${booking.cancellationReason ? 'Reason: ' + booking.cancellationReason : ''}`;
        break;
      default:
        return; // No notification needed for other status changes
    }

    const notification: NotificationData = {
      type: 'email',
      recipient: booking.studentEmail,
      subject,
      message: `
        Dear ${booking.studentName},

        ${message}

        Booking ID: ${booking.id}
        Hostel: ${booking.hostel?.name}
        Room: ${booking.room?.roomNumber}

        Best regards,
        Hostel Management Team
      `,
      data: { booking, oldStatus, newStatus }
    };

    await this.sendNotification(notification);
  }

  // Core notification sending method
  private async sendNotification(notification: NotificationData): Promise<void> {
    try {
      // Here you would integrate with your preferred notification service
      // Examples: SendGrid, AWS SES, Twilio, Firebase, etc.
      
      console.log(`Sending ${notification.type} notification to ${notification.recipient}:`);
      console.log(`Subject: ${notification.subject}`);
      console.log(`Message: ${notification.message}`);
      
      // For email notifications
      if (notification.type === 'email') {
        // await this.emailService.send({
        //   to: notification.recipient,
        //   subject: notification.subject,
        //   html: notification.message,
        //   data: notification.data
        // });
      }
      
      // For SMS notifications
      if (notification.type === 'sms') {
        // await this.smsService.send({
        //   to: notification.recipient,
        //   message: notification.message
        // });
      }
      
      // For push notifications
      if (notification.type === 'push') {
        // await this.pushService.send({
        //   to: notification.recipient,
        //   title: notification.subject,
        //   body: notification.message,
        //   data: notification.data
        // });
      }

    } catch (error) {
      console.error('Failed to send notification:', error);
      // You might want to implement retry logic or queue failed notifications
    }
  }

  // Utility method to format currency
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  // Utility method to format dates
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }
}