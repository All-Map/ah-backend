import { IsString, IsUUID, IsOptional, IsPhoneNumber } from 'class-validator';

export class OnboardingDto {
  @IsUUID()
  school_id: string;

  @IsString()
  emergency_contact_name: string;

  @IsString()
  emergency_contact_phone: string;

  @IsString()
  emergency_contact_relationship: string;

  @IsOptional()
  @IsString()
  emergency_contact_email?: string;
}