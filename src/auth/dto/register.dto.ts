import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password_hash: string;

  @IsEnum(['student', 'hostel_admin', 'super_admin'])
  role: string;

  @IsOptional()
  @IsString()
  school_id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: string;

  @IsOptional()
  @IsBoolean()
  terms_accepted?: boolean;

  @IsOptional()
  terms_accepted_at?: Date;

  @IsOptional()
  @IsString()
  emergency_contact_name?: string;

  @IsOptional()
  @IsString()
  emergency_contact_phone?: string;

  @IsOptional()
  @IsString()
  emergency_contact_relationship?: string;

  @IsOptional()
  @IsString()
  emergency_contact_email?: string;
}