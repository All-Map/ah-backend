import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class RoomAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  hostelId: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}