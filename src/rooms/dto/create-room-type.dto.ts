import { 
  IsString, IsNotEmpty, IsNumber, IsArray, IsOptional, IsPositive, 
} from 'class-validator';

export class CreateRoomTypeDto {
  @IsString()
  @IsNotEmpty()
  hostelId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsPositive()
  pricePerSemester: number;

  @IsNumber()
  @IsPositive()
  pricePerMonth: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  pricePerWeek?: number;

  @IsNumber()
  @IsPositive()
  capacity: number;

  @IsArray()
  @IsOptional()
  amenities: string[] = [];

  @IsNumber()
  @IsPositive()
  @IsOptional()
  total_rooms: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  available_rooms: number;

  @IsArray()
  @IsOptional()
  images: string[] = [];
}