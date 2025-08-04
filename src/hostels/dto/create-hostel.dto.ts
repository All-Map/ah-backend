// create-hostel.dto.ts
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, isString, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class LocationDto {
  @IsNumber()
  lng: number;

  @IsNumber()
  lat: number;
}

class AmenitiesDto {
  @IsBoolean()
  wifi: boolean;

  @IsBoolean()
  laundry: boolean;

  @IsBoolean()
  cafeteria: boolean;

  @IsBoolean()
  parking: boolean;

  @IsBoolean()
  security: boolean;
}

export class CreateHostelDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  SecondaryNumber: string;

  @IsString()
  @IsNotEmpty()
  adminId: string;

  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  schoolId: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ValidateNested()
  @Type(() => AmenitiesDto)
  amenities: AmenitiesDto;
}

// update-hostel.dto.ts
import { PartialType } from '@nestjs/swagger';
// import { CreateHostelDto } from './create-hostel.dto';

export class UpdateHostelDto extends PartialType(CreateHostelDto) {}