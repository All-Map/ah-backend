import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';

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
}