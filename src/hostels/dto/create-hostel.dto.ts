import { 
  IsArray, 
  IsBoolean, 
  IsNotEmpty, 
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

class BankDetailsDto {
  @IsString()
  @IsNotEmpty()
  bank_name: string;

  @IsString()
  @IsNotEmpty()
  account_name: string;

  @IsString()
  @IsNotEmpty()
  account_number: string;

  @IsString()
  @IsNotEmpty()
  branch: string;
}

export class MomoDetailsDto {
  @IsString()
  @IsNotEmpty()
  provider: string; // MTN, Vodafone, AirtelTigo

  @IsString()
  @IsNotEmpty()
  number: string;

  @IsString()
  @IsNotEmpty()
  name: string;
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
  @IsOptional()
  schoolId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ValidateNested()
  @Type(() => AmenitiesDto)
  amenities: AmenitiesDto;

  // New pricing and payment fields
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  base_price: number;

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @ValidateIf(o => o.payment_method === PaymentMethod.BANK || o.payment_method === PaymentMethod.BOTH)
  @ValidateNested()
  @Type(() => BankDetailsDto)
  bank_details?: BankDetailsDto;

  @ValidateIf(o => o.payment_method === PaymentMethod.MOMO || o.payment_method === PaymentMethod.BOTH)
  @ValidateNested()
  @Type(() => MomoDetailsDto)
  momo_details?: MomoDetailsDto;

  // Additional hostel information
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
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
  @Transform(({ value }) => parseFloat(value))
  rating?: number;
}