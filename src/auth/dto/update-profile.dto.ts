import { IsOptional, IsString, IsEnum, IsBoolean, IsEmail } from 'class-validator';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

export class UpdateProfileDto {
  // Personal Information
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: string;

  // Terms and Conditions
  @IsOptional()
  @IsBoolean()
  terms_accepted?: boolean;

  @IsOptional()
  terms_accepted_at?: Date;

  // Emergency Contact Information
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
  @IsEmail()
  emergency_contact_email?: string;
}