import { 
  IsArray, 
  IsBoolean, 
  IsNumber, 
  IsOptional, 
  IsString, 
  ValidateNested, 
  IsEnum,
  ValidateIf,
  Min,
  Max
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum PaymentMethod {
  BANK = 'bank',
  MOMO = 'momo',
  BOTH = 'both'
}

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

  @IsBoolean()
  @IsOptional()
  gym?: boolean;

  @IsBoolean()
  @IsOptional()
  studyRoom?: boolean;

  @IsBoolean()
  @IsOptional()
  kitchen?: boolean;

  @IsBoolean()
  @IsOptional()
  ac?: boolean;

  @IsBoolean()
  @IsOptional()
  generator?: boolean;
}

class UpdateBankDetailsDto {
  @IsString()
  @IsOptional()
  bank_name?: string;

  @IsString()
  @IsOptional()
  account_name?: string;

  @IsString()
  @IsOptional()
  account_number?: string;

  @IsString()
  @IsOptional()
  branch?: string;
}

class UpdateMomoDetailsDto {
  @IsString()
  @IsOptional()
  provider?: string; // MTN, Vodafone, AirtelTigo

  @IsString()
  @IsOptional()
  number?: string;

  @IsString()
  @IsOptional()
  name?: string;
}

export class UpdateHostelDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  SecondaryNumber?: string;

  @IsString()
  @IsOptional()
  adminId?: string;

  @ValidateNested()
  @Type(() => UpdateLocationDto)
  @IsOptional()
  location?: UpdateLocationDto;

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

  @ValidateNested()
  @Type(() => UpdateAmenitiesDto)
  @IsOptional()
  amenities?: UpdateAmenitiesDto;

  // Pricing and payment fields
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => value ? parseFloat(value) : undefined)
  base_price?: number;

  @IsEnum(PaymentMethod)
  @IsOptional()
  payment_method?: PaymentMethod;

  @ValidateIf(o => o.payment_method === PaymentMethod.BANK || o.payment_method === PaymentMethod.BOTH)
  @ValidateNested()
  @Type(() => UpdateBankDetailsDto)
  @IsOptional()
  bank_details?: UpdateBankDetailsDto;

  @ValidateIf(o => o.payment_method === PaymentMethod.MOMO || o.payment_method === PaymentMethod.BOTH)
  @ValidateNested()
  @Type(() => UpdateMomoDetailsDto)
  @IsOptional()
  momo_details?: UpdateMomoDetailsDto;

  // Additional hostel information
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value) : undefined)
  max_occupancy?: number;

  @IsString()
  @IsOptional()
  house_rules?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  nearby_facilities?: string[];

  @IsString()
  @IsOptional()
  check_in_time?: string;

  @IsString()
  @IsOptional()
  check_out_time?: string;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(5)
  @IsOptional()
  @Transform(({ value }) => value ? parseFloat(value) : undefined)
  rating?: number;

  @IsBoolean()
  @IsOptional()
  is_verified?: boolean;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}