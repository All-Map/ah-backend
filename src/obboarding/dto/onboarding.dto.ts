import { IsString, IsUUID, IsOptional, IsPhoneNumber, IsNumber } from 'class-validator';

export class OnboardingDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsUUID()
  school_id?: string;

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

  @IsOptional()
  @IsNumber()
  last_onboarding_step?: number;
}