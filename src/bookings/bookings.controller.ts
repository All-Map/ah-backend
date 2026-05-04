import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  UsePipes,
  Request,
  BadRequestException
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
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
import type { Booking, Payment } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PaystackService } from 'src/paystack/paystack.service';
import { DepositsService } from 'src/deposits/deposits.service';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly paystackService: PaystackService,
    private readonly depositsService: DepositsService
  ) {}

  @Post('verify-payment')
  @Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Verify Paystack payment before creating booking' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Payment verified successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Payment verification failed' 
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async verifyPayment(@Body() verifyPaymentDto: VerifyPaymentDto) {
    const verification = await this.bookingsService.verifyPayment(verifyPaymentDto);
    return {
      message: 'Payment verified successfully',
      verification
    };
  }

  @Get('booking-fee')
  @Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get current booking fee amount' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking fee retrieved successfully' 
  })
  async getBookingFee() {
    return {
      bookingFee: this.bookingsService.getBookingFee(),
      formattedFee: this.paystackService.formatAmount(this.bookingsService.getBookingFee()),
      currency: 'GHS'
    };
  }

  @Post('create')
  @Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Create a new booking with verified payment' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Booking created successfully',
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data, room not available, or payment not verified' 
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'Room already booked for selected dates' 
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async createBooking(@Body() createBookingDto: CreateBookingDto): Promise<Booking> {
    return await this.bookingsService.createBooking(createBookingDto);
  }

  @Post('create-with-deposit-balance')
@Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
@ApiOperation({ summary: 'Create booking using deposit balance for booking fee' })
@ApiResponse({ 
  status: HttpStatus.CREATED, 
  description: 'Booking created successfully with deposit deduction',
})
@UsePipes(new ValidationPipe({ transform: true }))
async createBookingWithDepositBalance(
  @Body() createBookingDto: CreateBookingDto,
  @Request() req: any
): Promise<{ booking: Booking; message: string; bookingFeeDeducted: number }> {
  const userId = req.user.id;
  
  const booking = await this.bookingsService.createBookingWithDeposit(
    createBookingDto,
    userId
  );

  return {
    booking,
    message: 'Booking created successfully. Booking fee (GHS 70) deducted from your deposit balance.',
    bookingFeeDeducted: 70
  };
}

// In bookings.controller.ts
@Get('deposit-check')
@Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
@ApiOperation({ summary: 'Check if user can pay booking fee from deposit' })
async checkDepositForBooking(@Request() req: any) {
  const userId = req.user.id;
  const depositCheck = await this.depositsService.canPayBookingFeeFromDeposit(userId);
  const bookingFee = this.bookingsService.getBookingFee();
  
  return {
    canCreateBooking: depositCheck.canPay,
    bookingFee,
    depositBalance: depositCheck.availableBalance,
    ...(depositCheck.difference && { 
      additionalNeeded: depositCheck.difference 
    }),
    message: depositCheck.canPay 
      ? 'Sufficient deposit balance for booking fee' 
      : 'Insufficient deposit balance for booking fee'
  };
}

 @Post('admin-create')
  @Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Create a new booking with verified payment (Admin)' })
  @UsePipes(new ValidationPipe({ 
    transform: true,
    whitelist: true,  // Only allow whitelisted properties
    forbidNonWhitelisted: false,  // Changed to false - just ignore extra properties instead of failing
    transformOptions: {
      enableImplicitConversion: true
    }
  }))
  async createAdminBooking(
    @Body() createBookingDto: CreateBookingDto,
    @Request() req: any
  ): Promise<any> {


    try {
      const result = await this.bookingsService.createAdminBooking(createBookingDto);
      return {
        success: true,
        booking: result,
        message: 'Booking created successfully'
      };
      
    } catch (error) {
      console.log('❌ ERROR in controller:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n')
      });
      
      // Re-throw the error to let NestJS handle the HTTP response
      throw error;
    }
  }

  @Get()
  @Roles(UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get all bookings with filtering and pagination' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Bookings retrieved successfully' 
  })
  async getBookings(@Query() filterDto: BookingFilterDto) {
    return await this.bookingsService.getBookings(filterDto);
  }

  @Get('search')
  @Roles(UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Search bookings' })
  @ApiQuery({ name: 'q', description: 'Search term' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Search results retrieved successfully',
  })
  async searchBookings(
    @Query('q') searchTerm: string,
    @Query() filters: BookingFilterDto
  ): Promise<Booking[]> {
    return await this.bookingsService.searchBookings(searchTerm, filters);
  }

  @Get('student/:studentId')
  @Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get bookings by student ID' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Student bookings retrieved successfully',
  })
  async getBookingsByStudent(
    @Param('studentId', ParseUUIDPipe) studentId: string
  ): Promise<Booking[]> {
    return await this.bookingsService.getBookingsByStudent(studentId);
  }

  @Get('hostel/:hostelId')
  @Roles(UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get bookings by hostel ID' })
  @ApiParam({ name: 'hostelId', description: 'Hostel ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Hostel bookings retrieved successfully',
  })
  async getBookingsByHostel(
    @Param('hostelId', ParseUUIDPipe) hostelId: string,
    @Query() filterDto: Partial<BookingFilterDto>
  ): Promise<Booking[]> {
    return await this.bookingsService.getBookingsByHostel(hostelId, filterDto);
  }

  @Get('statistics')
  @Roles(UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get booking statistics' })
  @ApiQuery({ name: 'hostelId', required: false, description: 'Filter by hostel ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking statistics retrieved successfully' 
  })
  async getBookingStatistics(@Query('hostelId') hostelId?: string) {
    return await this.bookingsService.getBookingStatistics(hostelId);
  }

  @Get('reports')
  @Roles(UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Generate booking reports' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Report generated successfully' 
  })
  async generateReport(@Query() filterDto: BookingReportFilterDto) {
    return await this.bookingsService.generateReport(filterDto);
  }

  @Get(':id')
  @Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking retrieved successfully',
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Booking not found' 
  })
  async getBookingById(@Param('id', ParseUUIDPipe) id: string): Promise<Booking> {
    return await this.bookingsService.getBookingById(id);
  }

  @Get(':id/payments')
  @Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get booking payments' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking payments retrieved successfully',
  })
  async getBookingPayments(@Param('id', ParseUUIDPipe) id: string): Promise<Payment[]> {
    return await this.bookingsService.getBookingPayments(id);
  }

  @Post('create-with-deposit')
@Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
@ApiOperation({ summary: 'Create booking with automatic deposit deduction' })
@ApiResponse({ 
  status: HttpStatus.CREATED, 
  description: 'Booking created successfully with deposit deduction',
})
@ApiResponse({ 
  status: HttpStatus.BAD_REQUEST, 
  description: 'Insufficient deposit balance or invalid data' 
})
@ApiResponse({ 
  status: HttpStatus.CONFLICT, 
  description: 'Room not available or already booked' 
})
@UsePipes(new ValidationPipe({ transform: true }))
async createBookingWithDeposit(
  @Body() createBookingDto: CreateBookingDto,
  @Request() req: any
): Promise<{ booking: Booking; message: string; depositDeducted: number }> {
  const userId = req.user.id;
  
  try {
    const booking = await this.bookingsService.createBookingWithDeposit(
      createBookingDto,
      userId
    );

    return {
      booking,
      message: 'Booking created successfully. Deposit fee deducted from your balance.',
      depositDeducted: 70
    };
  } catch (error: any) {
    console.error('Controller: Booking creation failed:', error);
    throw error;
  }
}

  @Put(':id')
  @Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Update booking details' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking updated successfully',
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Booking not found' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Cannot update completed or cancelled booking' 
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBookingDto: UpdateBookingDto
  ): Promise<Booking> {
    return await this.bookingsService.updateBooking(id, updateBookingDto);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Confirm a pending booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking confirmed successfully',
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Only pending bookings can be confirmed' 
  })
  async confirmBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() confirmDto: ConfirmBookingDto
  ): Promise<Booking> {
    return await this.bookingsService.confirmBooking(id, confirmDto);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking cancelled successfully',
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Booking cannot be cancelled' 
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async cancelBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelDto: CancelBookingDto
  ): Promise<Booking> {
    return await this.bookingsService.cancelBooking(id, cancelDto);
  }

  @Patch(':id/checkin')
  @Roles(UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Check in a student' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Student checked in successfully',
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Booking cannot be checked in or payment incomplete' 
  })
  async checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() checkInDto: CheckInDto
  ): Promise<Booking> {
    return await this.bookingsService.checkIn(id, checkInDto);
  }

  @Patch(':id/checkout')
  @Roles(UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Check out a student' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Student checked out successfully',
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Booking cannot be checked out' 
  })
  async checkOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() checkOutDto: CheckOutDto
  ): Promise<Booking> {
    return await this.bookingsService.checkOut(id, checkOutDto);
  }

  @Post(':id/room-payments')
  @Roles(UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Record room balance payment for booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Room payment recorded successfully'
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid payment amount or booking cancelled' 
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async recordRoomPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() paymentDto: PaymentDto,
    @Request() req: any
  ): Promise<{ payment: Payment; booking: Booking; message: string }> {
    const receivedBy = req.user?.id;
    const result = await this.bookingsService.recordRoomPayment(id, paymentDto, receivedBy);
    
    return {
      payment: result.payment,
      booking: result.booking,
      message: 'Room payment recorded successfully'
    };
  }

  @Post(':id/payments')
  @Roles(UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Record a payment for booking (legacy endpoint)' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Payment recorded successfully'
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() paymentDto: PaymentDto,
    @Request() req: any
  ): Promise<{ payment: Payment; booking: Booking; message: string }> {
    const receivedBy = req.user?.id;
    const result = await this.bookingsService.recordPayment(id, paymentDto, receivedBy);
    
    return {
      payment: result.payment,
      booking: result.booking,
      message: 'Payment recorded successfully'
    };
  }

  @Delete(':id')
  @Roles(UserRole.super_admin)
  @ApiOperation({ summary: 'Delete a booking (Admin only)' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking deleted successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Cannot delete checked-in booking or booking with payments' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Booking not found' 
  })
  async deleteBooking(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.bookingsService.deleteBooking(id);
    return { message: 'Booking deleted successfully' };
  }

  @Get('hostel/:hostelId/calendar')
  @Roles(UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get booking calendar for a hostel' })
  @ApiParam({ name: 'hostelId', description: 'Hostel ID' })
  @ApiQuery({ name: 'month', required: false, description: 'Month (YYYY-MM)' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking calendar retrieved successfully' 
  })
  async getBookingCalendar(
    @Param('hostelId', ParseUUIDPipe) hostelId: string,
    @Query('month') month?: string
  ) {
    const startDate = month ? new Date(`${month}-01`) : new Date();
    startDate.setDate(1);
    
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);

    const bookings = await this.bookingsService.getBookings({
      hostelId,
      checkInFrom: startDate.toISOString().split('T')[0],
      checkInTo: endDate.toISOString().split('T')[0],
      limit: 1000
    });

    // Group bookings by date
    const calendar: Record<string, any[]> = {};
    
    bookings.bookings.forEach(booking => {
      const checkInDate = new Date(booking.checkInDate).toISOString().split('T')[0];
      if (!calendar[checkInDate]) {
        calendar[checkInDate] = [];
      }
      calendar[checkInDate].push({
        id: booking.id,
        studentName: booking.studentName,
        roomNumber: booking.room?.roomNumber,
        status: booking.status,
        checkOutDate: booking.checkOutDate,
        paymentStatus: booking.paymentStatus,
        amountDue: booking.amountDue
      });
    });

    return {
      month: month || startDate.toISOString().substring(0, 7),
      calendar,
      totalBookings: bookings.bookings.length
    };
  }

  @Get('hostel/:hostelId/availability')
  @Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Check room availability for dates' })
  @ApiParam({ name: 'hostelId', description: 'Hostel ID' })
  @ApiQuery({ name: 'checkIn', description: 'Check-in date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'checkOut', description: 'Check-out date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'roomTypeId', required: false, description: 'Filter by room type' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Room availability retrieved successfully' 
  })
  async checkAvailability(
    @Param('hostelId', ParseUUIDPipe) hostelId: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
    @Query('roomTypeId') roomTypeId?: string
  ) {
    return await this.bookingsService.checkAvailability(
      hostelId,
      checkIn,
      checkOut,
      roomTypeId
    );
  }

  @Post('bulk-checkin')
  @Roles(UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Bulk check-in multiple bookings' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Bulk check-in completed' 
  })
  async bulkCheckIn(
    @Body() bulkCheckInDto: { bookingIds: string[], notes?: string }
  ) {
    const results = {
      successful: [] as string[],
      failed: [] as { id: string, error: string }[]
    };

    for (const bookingId of bulkCheckInDto.bookingIds) {
      try {
        await this.bookingsService.checkIn(bookingId, { notes: bulkCheckInDto.notes });
        results.successful.push(bookingId);
      } catch (error) {
        results.failed.push({ id: bookingId, error: error.message });
      }
    }

    return results;
  }

  @Post('bulk-checkout')
  @Roles(UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Bulk check-out multiple bookings' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Bulk check-out completed' 
  })
  async bulkCheckOut(
    @Body() bulkCheckOutDto: { bookingIds: string[], notes?: string }
  ) {
    const results = {
      successful: [] as string[],
      failed: [] as { id: string, error: string }[]
    };

    for (const bookingId of bulkCheckOutDto.bookingIds) {
      try {
        await this.bookingsService.checkOut(bookingId, { notes: bulkCheckOutDto.notes });
        results.successful.push(bookingId);
      } catch (error) {
        results.failed.push({ id: bookingId, error: error.message });
      }
    }

    return results;
  }

  @Patch('overdue/mark')
  @Roles(UserRole.super_admin)
  @ApiOperation({ summary: 'Mark overdue bookings (System operation)' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Overdue bookings marked successfully' 
  })
  async markOverdueBookings(): Promise<{ message: string }> {
    await this.bookingsService.markOverdueBookings();
    return { message: 'Overdue bookings marked successfully' };
  }

  // Paystack webhook endpoint
  @Post('webhook/paystack')
  @ApiOperation({ summary: 'Handle Paystack webhook events' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Webhook processed successfully' 
  })
  async handlePaystackWebhook(
    @Body() payload: any,
    @Request() req: any
  ) {
    // Verify webhook signature (recommended for production)
    // const signature = req.headers['x-paystack-signature'];
    
    const { event, data } = payload;

    switch (event) {
      case 'charge.success':
        // Handle successful payment
        console.log('Payment successful:', data);
        // You might want to update booking status or send notifications
        break;
        
      case 'charge.failed':
        // Handle failed payment
        console.log('Payment failed:', data);
        break;
        
      default:
        console.log('Unhandled webhook event:', event);
    }

    return { status: 'success' };
  }

  // Payment status check endpoint
  @Get(':id/payment-status')
  @Roles(UserRole.student, UserRole.hostel_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Check payment status for a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Payment status retrieved successfully' 
  })
  async getPaymentStatus(@Param('id', ParseUUIDPipe) id: string) {
    const booking = await this.bookingsService.getBookingById(id);
    const payments = await this.bookingsService.getBookingPayments(id);
    
    const totalBookingCost = this.bookingsService.getTotalBookingCost(Number(booking.totalAmount));
    
    return {
      bookingId: booking.id,
      paymentStatus: booking.paymentStatus,
      totalAmount: totalBookingCost,
      roomAmount: Number(booking.totalAmount),
      bookingFee: this.bookingsService.getBookingFee(),
      amountPaid: Number(booking.amountPaid),
      amountDue: Number(booking.amountDue),
      payments: payments.map(payment => ({
        id: payment.id,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        transactionRef: payment.transactionRef,
        paymentDate: payment.paymentDate,
        notes: payment.notes
      })),
      paymentProgress: booking.getPaymentProgress(),
      isFullyPaid: booking.paymentStatus === 'paid' && booking.amountDue <= 0
    };
  }
}