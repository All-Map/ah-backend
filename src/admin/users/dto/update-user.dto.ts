import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, IsEnum, IsPhoneNumber } from 'class-validator';
import { Gender } from '../../../entities/user.entity';

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiProperty({ required: false, enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergency_contact_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergency_contact_phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergency_contact_relationship?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergency_contact_email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  school_id?: string;
}