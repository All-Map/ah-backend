import { 
  IsString, IsNotEmpty, IsNumber, IsArray, IsOptional, IsPositive, 
  IsEnum, ArrayMinSize, IsIn
} from 'class-validator';

export enum RoomGender {
  MALE = 'male',
  FEMALE = 'female',
  MIXED = 'mixed'
}

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

  @IsEnum(RoomGender)
  @IsOptional()
  gender: RoomGender = RoomGender.MIXED;

  // New field for allowed genders array
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn(['male', 'female', 'mixed', 'other'], { each: true })
  @IsOptional()
  allowedGenders?: string[] = ['mixed'];

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