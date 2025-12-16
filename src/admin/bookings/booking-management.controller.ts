import {
  Controller,
  Get,
  Post,
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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { BookingManagementService } from './booking-management.service';
import { BookingStatus, PaymentStatus } from '../../entities/booking.entity';

@ApiTags('Admin Bookings')
@Controller('admin/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BookingManagementController {
  constructor(private readonly bookingService: BookingManagementService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSTEL_ADMIN)
  @ApiOperation({ summary: 'Get all bookings with filtering' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bookings retrieved successfully',
  })
  async getBookings(
    @Query('hostelId') hostelId?: string,
    @Query('roomId') roomId?: string,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('bookingType') bookingType?: string,
    @Query('checkInFrom') checkInFrom?: string,
    @Query('checkInTo') checkInTo?: string,
    @Query('search') search?: string,
    @Query('overdueOnly') overdueOnly?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    return await this.bookingService.getBookings({
      hostelId,
      roomId,
      studentId,
      status: status as any,
      paymentStatus: paymentStatus as PaymentStatus,
      bookingType: bookingType as any,
      checkInFrom,
      checkInTo,
      search,
      overdueOnly,
      page,
      limit,
      sortBy,
      sortOrder,
    });
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSTEL_ADMIN)
  @ApiOperation({ summary: 'Get booking statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Booking statistics retrieved successfully',
  })
  async getBookingStats() {
    return await this.bookingService.getBookingStats();
  }

  @Get('upcoming/checkins')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSTEL_ADMIN)
  @ApiOperation({ summary: 'Get upcoming check-ins' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to look ahead', default: 7 })
  async getUpcomingCheckIns(@Query('days') days: number = 7) {
    return await this.bookingService.getUpcomingCheckIns(days);
  }

  @Get('upcoming/checkouts')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSTEL_ADMIN)
  @ApiOperation({ summary: 'Get upcoming check-outs' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to look ahead', default: 7 })
  async getUpcomingCheckOuts(@Query('days') days: number = 7) {
    return await this.bookingService.getUpcomingCheckOuts(days);
  }

  @Get('overdue')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSTEL_ADMIN)
  @ApiOperation({ summary: 'Get overdue bookings' })
  async getOverdueBookings() {
    return await this.bookingService.getOverdueBookings();
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSTEL_ADMIN)
  @ApiOperation({ summary: 'Get booking by ID with full details' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Booking retrieved successfully',
  })
  async getBookingById(@Param('id', ParseUUIDPipe) id: string) {
    return await this.bookingService.getBookingById(id);
  }

  @Get(':id/payments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSTEL_ADMIN)
  @ApiOperation({ summary: 'Get booking payments' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  async getBookingPayments(@Param('id', ParseUUIDPipe) id: string) {
    return await this.bookingService.getBookingPayments(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSTEL_ADMIN)
  @ApiOperation({ summary: 'Update booking status' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  async updateBookingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: BookingStatus,
    @Body('notes') notes?: string,
  ) {
    return await this.bookingService.updateBookingStatus(id, status, notes);
  }

  @Patch(':id/payment-status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSTEL_ADMIN)
  @ApiOperation({ summary: 'Update booking payment status' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  async updatePaymentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('paymentStatus') paymentStatus: PaymentStatus,
  ) {
    return await this.bookingService.updatePaymentStatus(id, paymentStatus);
  }

  @Post(':id/payments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSTEL_ADMIN)
  @ApiOperation({ summary: 'Add payment to booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: {
      amount: number;
      paymentMethod: string;
      transactionRef: string;
      notes?: string;
    },
  ) {
    return await this.bookingService.addPaymentToBooking(id, data);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Booking deleted successfully',
  })
  async deleteBooking(@Param('id', ParseUUIDPipe) id: string) {
    return await this.bookingService.updateBookingStatus(id, BookingStatus.CANCELLED, 'Admin deletion');
  }

  @Get('export/csv')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSTEL_ADMIN)
  @ApiOperation({ summary: 'Export bookings to CSV' })
  async exportBookings(
    @Res() res: Response,
    @Query('hostelId') hostelId?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('checkInFrom') checkInFrom?: string,
    @Query('checkInTo') checkInTo?: string,
    @Query('search') search?: string,
  ) {
    const csv = await this.bookingService.exportBookings({
      hostelId,
      status: status as any,
      paymentStatus: paymentStatus as PaymentStatus,
      checkInFrom,
      checkInTo,
      search,
    });

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename=bookings-${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(csv);
  }
}