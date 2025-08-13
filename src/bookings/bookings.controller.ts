// bookings.controller.ts
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
  Request
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
  BookingReportFilterDto
} from './dto/booking.dto';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('create')
  @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Booking created successfully',
    type: Booking 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data or room not available' 
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'Room already booked for selected dates' 
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async createBooking(@Body() createBookingDto: CreateBookingDto): Promise<Booking> {
    return await this.bookingsService.createBooking(createBookingDto);
  }

  @Get()
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all bookings with filtering and pagination' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Bookings retrieved successfully' 
  })
  async getBookings(@Query() filterDto: BookingFilterDto) {
    return await this.bookingsService.getBookings(filterDto);
  }

  @Get('search')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Search bookings' })
  @ApiQuery({ name: 'q', description: 'Search term' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Search results retrieved successfully',
    type: [Booking] 
  })
  async searchBookings(
    @Query('q') searchTerm: string,
    @Query() filters: BookingFilterDto
  ): Promise<Booking[]> {
    return await this.bookingsService.searchBookings(searchTerm, filters);
  }

  @Get('student/:studentId')
  @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get bookings by student ID' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Student bookings retrieved successfully',
    type: [Booking] 
  })
  async getBookingsByStudent(
    @Param('studentId', ParseUUIDPipe) studentId: string
  ): Promise<Booking[]> {
    return await this.bookingsService.getBookingsByStudent(studentId);
  }

  @Get('hostel/:hostelId')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get bookings by hostel ID' })
  @ApiParam({ name: 'hostelId', description: 'Hostel ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Hostel bookings retrieved successfully',
    type: [Booking] 
  })
  async getBookingsByHostel(
    @Param('hostelId', ParseUUIDPipe) hostelId: string,
    @Query() filterDto: Partial<BookingFilterDto>
  ): Promise<Booking[]> {
    return await this.bookingsService.getBookingsByHostel(hostelId, filterDto);
  }

  @Get('statistics')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
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
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate booking reports' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Report generated successfully' 
  })
  async generateReport(@Query() filterDto: BookingReportFilterDto) {
    return await this.bookingsService.generateReport(filterDto);
  }

  @Get(':id')
  @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking retrieved successfully',
    type: Booking 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Booking not found' 
  })
  async getBookingById(@Param('id', ParseUUIDPipe) id: string): Promise<Booking> {
    return await this.bookingsService.getBookingById(id);
  }

  @Get(':id/payments')
  @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get booking payments' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking payments retrieved successfully',
    type: [Payment] 
  })
  async getBookingPayments(@Param('id', ParseUUIDPipe) id: string): Promise<Payment[]> {
    return await this.bookingsService.getBookingPayments(id);
  }

  @Put(':id')
  @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update booking details' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking updated successfully',
    type: Booking 
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
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Confirm a pending booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking confirmed successfully',
    type: Booking 
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
  @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking cancelled successfully',
    type: Booking 
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
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Check in a student' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Student checked in successfully',
    type: Booking 
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
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Check out a student' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Student checked out successfully',
    type: Booking 
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
@Post(':id/payments')
@Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
@ApiOperation({ summary: 'Record a payment for booking' })
@ApiParam({ name: 'id', description: 'Booking ID' })
@ApiResponse({ 
  status: HttpStatus.CREATED, 
  description: 'Payment recorded successfully'
})
@ApiResponse({ 
  status: HttpStatus.BAD_REQUEST, 
  description: 'Invalid payment amount or booking cancelled' 
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

  // @Patch(':id/extend')
  // @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  // @ApiOperation({ summary: 'Extend booking checkout date' })
  // @ApiParam({ name: 'id', description: 'Booking ID' })
  // @ApiResponse({ 
  //   status: HttpStatus.OK, 
  //   description: 'Booking extended successfully',
  //   type: Booking 
  // })
  // @ApiResponse({ 
  //   status: HttpStatus.BAD_REQUEST, 
  //   description: 'Only checked-in bookings can be extended' 
  // })
  // @ApiResponse({ 
  //   status: HttpStatus.CONFLICT, 
  //   description: 'Room already booked for extension period' 
  // })
  // @UsePipes(new ValidationPipe({ transform: true }))
  // async extendBooking(
  //   @Param('id', ParseUUIDPipe) id: string,
  //   @Body() extendDto: ExtendBookingDto
  // ): Promise<Booking> {
  //   return await this.bookingsService.extendBooking(id, extendDto);
  // }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
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

  // Utility endpoints for booking management

  @Get('hostel/:hostelId/calendar')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
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
        checkOutDate: booking.checkOutDate
      });
    });

    return {
      month: month || startDate.toISOString().substring(0, 7),
      calendar,
      totalBookings: bookings.bookings.length
    };
  }

  @Get('hostel/:hostelId/availability')
  @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
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
    // Get all rooms for the hostel
    let rooms = await this.bookingsService['roomRepository'].find({
      where: { hostelId, ...(roomTypeId && { roomTypeId }) },
      relations: ['roomType']
    });

    // Get conflicting bookings
    const conflictingBookings = await this.bookingsService.getBookings({
      hostelId,
      checkInFrom: checkIn,
      checkInTo: checkOut,
      limit: 1000
    });

    const bookedRoomIds = new Set(
      conflictingBookings.bookings
        .filter(booking => ['confirmed', 'checked_in'].includes(booking.status))
        .map(booking => booking.roomId)
    );

    const availableRooms = rooms.filter(room => 
      !bookedRoomIds.has(room.id) && room.isAvailable()
    );

    return {
      checkInDate: checkIn,
      checkOutDate: checkOut,
      totalRooms: rooms.length,
      availableRooms: availableRooms.length,
      bookedRooms: bookedRoomIds.size,
      rooms: availableRooms.map(room => ({
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        maxOccupancy: room.maxOccupancy,
        currentOccupancy: room.currentOccupancy,
        roomType: {
          id: room.roomType.id,
          name: room.roomType.name,
          pricePerSemester: room.roomType.pricePerSemester,
          pricePerMonth: room.roomType.pricePerMonth,
          pricePerWeek: room.roomType.pricePerWeek,
          capacity: room.roomType.capacity,
          amenities: room.roomType.amenities
        }
      }))
    };
  }

  @Post('bulk-checkin')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
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
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
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
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark overdue bookings (System operation)' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Overdue bookings marked successfully' 
  })
  async markOverdueBookings(): Promise<{ message: string }> {
    await this.bookingsService.markOverdueBookings();
    return { message: 'Overdue bookings marked successfully' };
  }

//   @Get('student/:studentId')
// @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
// @ApiOperation({ summary: 'Get bookings by student ID' })
// @ApiParam({ name: 'studentId', description: 'Student ID' })
// @ApiResponse({ 
//   status: HttpStatus.OK, 
//   description: 'Student bookings retrieved successfully',
//   type: [Booking] 
// })
// async getBookingsByStudent(
//   @Param('studentId') studentId: string // Removed ParseUUIDPipe
// ): Promise<Booking[]> {
//   return await this.bookingsService.getBookingsByStudent(studentId);
// }
}