import { IsOptional, IsString, IsEnum, IsBoolean, IsPhoneNumber } from 'class-validator';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

export class UpdateProfileDto {
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
  @IsPhoneNumber()
  emergency_contact_phone?: string;

  @IsOptional()
  @IsString()
  emergency_contact_relationship?: string;

  @IsOptional()
  @IsString()
  emergency_contact_email?: string;
}