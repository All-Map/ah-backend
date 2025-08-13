// booking.dto.ts
import { IsUUID, IsString, IsEmail, IsPhoneNumber, IsEnum, IsDateString, IsNumber, IsOptional, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, BookingType, PaymentStatus } from 'src/entities/booking.entity';

class EmergencyContactDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  relationship: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CreateBookingDto {
  @ApiProperty({ description: 'Hostel ID' })
  @IsUUID()
  hostelId: string;

  @ApiProperty({ description: 'Room ID' })
  @IsUUID()
  roomId: string;

  @ApiProperty({ description: 'Student ID' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ description: 'Student full name' })
  @IsString()
  studentName: string;

  @ApiProperty({ description: 'Student email' })
  @IsEmail()
  studentEmail: string;

  @ApiProperty({ description: 'Student phone number' })
  @IsString()
  studentPhone: string;

  @ApiProperty({ enum: BookingType, description: 'Type of booking' })
  @IsEnum(BookingType)
  bookingType: BookingType;

  @ApiProperty({ description: 'Check-in date (YYYY-MM-DD)' })
  @IsDateString()
  checkInDate: string;

  @ApiProperty({ description: 'Check-out date (YYYY-MM-DD)' })
  @IsDateString()
  checkOutDate: string;

  @ApiPropertyOptional({ description: 'Special requests from student' })
  @IsOptional()
  @IsString()
  specialRequests?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [EmergencyContactDto], description: 'Emergency contacts' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  emergencyContacts?: EmergencyContactDto[];
}

export class UpdateBookingDto {
  @ApiPropertyOptional({ description: 'Student full name' })
  @IsOptional()
  @IsString()
  studentName?: string;

  @ApiPropertyOptional({ description: 'Student email' })
  @IsOptional()
  @IsEmail()
  studentEmail?: string;

  @ApiPropertyOptional({ description: 'Student phone number' })
  @IsOptional()
  @IsString()
  studentPhone?: string;

  @ApiPropertyOptional({ description: 'Check-in date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  checkInDate?: string;

  @ApiPropertyOptional({ description: 'Check-out date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  checkOutDate?: string;

  @ApiPropertyOptional({ description: 'Special requests from student' })
  @IsOptional()
  @IsString()
  specialRequests?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [EmergencyContactDto], description: 'Emergency contacts' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  emergencyContacts?: EmergencyContactDto[];
}

export class BookingFilterDto {
  @ApiPropertyOptional({ description: 'Hostel ID' })
  @IsOptional()
  @IsUUID()
  hostelId?: string;

  @ApiPropertyOptional({ description: 'Room ID' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ description: 'Student ID' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ enum: BookingStatus, description: 'Booking status' })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ enum: BookingType, description: 'Booking type' })
  @IsOptional()
  @IsEnum(BookingType)
  bookingType?: BookingType;

  @ApiPropertyOptional({ enum: PaymentStatus, description: 'Payment status' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Check-in date from (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  checkInFrom?: string;

  @ApiPropertyOptional({ description: 'Check-in date to (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  checkInTo?: string;

  @ApiPropertyOptional({ description: 'Search term (student name, email, phone)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'checkInDate' | 'checkOutDate' | 'studentName' | 'totalAmount';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}

export class ConfirmBookingDto {
  @ApiPropertyOptional({ description: 'Confirmation notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelBookingDto {
  @ApiProperty({ description: 'Reason for cancellation' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckInDto {
  @ApiPropertyOptional({ description: 'Check-in notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckOutDto {
  @ApiPropertyOptional({ description: 'Check-out notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Room condition notes' })
  @IsOptional()
  @IsString()
  roomCondition?: string;
}

export class PaymentDto {
  @ApiProperty({ description: 'Payment amount' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Payment method' })
  @IsString()
  paymentMethod: string;

  @ApiProperty({ description: 'Transaction reference' })
  @IsString()
  transactionRef: string;

  @ApiPropertyOptional({ description: 'Payment notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ExtendBookingDto {
  @ApiProperty({ description: 'New check-out date (YYYY-MM-DD)' })
  @IsDateString()
  newCheckOutDate: string;

  @ApiPropertyOptional({ description: 'Extension reason' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BookingReportFilterDto {
  @ApiPropertyOptional({ description: 'Hostel ID' })
  @IsOptional()
  @IsUUID()
  hostelId?: string;

  @ApiPropertyOptional({ description: 'Report start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Report end date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Report type' })
  @IsOptional()
  @IsString()
  reportType?: 'revenue' | 'occupancy' | 'bookings' | 'payments';
}