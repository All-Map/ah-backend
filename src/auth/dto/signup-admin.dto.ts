import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export enum IdCardType {
  NATIONAL_ID = 'national_id',
  DRIVERS_LICENSE = 'drivers_license',
  PASSPORT = 'passport',
  VOTERS_ID = 'voters_id',
  OTHER = 'other'
}

export class SignupAdminDto {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsPhoneNumber('GH') // Ghana country code
  mobile_number: string;

  @IsPhoneNumber('GH')
  @IsOptional()
  alternate_phone?: string;

  @IsEnum(IdCardType)
  id_card_type: IdCardType;

  @IsString()
  @IsNotEmpty()
  hostel_name: string;

  @IsString()
  @IsNotEmpty()
  hostel_address: string;
}