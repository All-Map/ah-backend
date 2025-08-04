import { PartialType } from '@nestjs/mapped-types';
import { CreateHostelDto } from './create-hostel.dto';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateLocationDto {
  @IsNumber()
  @IsOptional()
  lng?: number;

  @IsNumber()
  @IsOptional()
  lat?: number;
}

class UpdateAmenitiesDto {
  @IsBoolean()
  @IsOptional()
  wifi?: boolean;

  @IsBoolean()
  @IsOptional()
  laundry?: boolean;

  @IsBoolean()
  @IsOptional()
  cafeteria?: boolean;

  @IsBoolean()
  @IsOptional()
  parking?: boolean;

  @IsBoolean()
  @IsOptional()
  security?: boolean;
}

export class UpdateHostelDto extends PartialType(CreateHostelDto) {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ValidateNested()
  @Type(() => UpdateLocationDto)
  @IsOptional()
//   location?: UpdateLocationDto;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  schoolId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

//   @ValidateNested()
//   @Type(() => UpdateAmenitiesDto)
//   @IsOptional()
//   amenities?: UpdateAmenitiesDto;
}