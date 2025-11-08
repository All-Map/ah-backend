// booking.dto.ts - Updated CreateBookingDto
import { IsUUID, IsString, IsEmail, IsEnum, IsDateString, IsNumber, IsOptional, IsArray, ValidateNested, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingType } from 'src/entities/booking.entity';

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

  @ApiProperty({ description: 'Student ID (can be any unique identifier)' })
  @IsString()
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

  @ApiProperty({ description: 'Paystack payment reference' })
  @IsString()
  paymentReference: string;

  @ApiProperty({ description: 'Booking fee amount paid (should be 70 GHS)' })
  @IsNumber()
  @Min(70)
  @Max(70)
  bookingFeeAmount: number;

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

  @ApiPropertyOptional({ description: 'Payment verification status', default: false })
  @IsOptional()
  @IsBoolean()
  paymentVerified?: boolean;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Paystack payment reference' })
  @IsString()
  reference: string;

  @ApiProperty({ description: 'Expected amount in GHS' })
  @IsNumber()
  @Min(0.01)
  expectedAmount: number;
}