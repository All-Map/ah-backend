import { IsEnum, IsOptional } from 'class-validator';
import { BookingStatus } from '../../entities/booking.entity';

export class UpdateBookingDto {
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;
}