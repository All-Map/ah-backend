import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { Gender, UserRole } from '../../../entities/user.entity';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ enum: UserRole, default: UserRole.STUDENT })
  @IsEnum(UserRole)
  role: UserRole = UserRole.STUDENT;

  @ApiProperty({ default: true })
  @IsBoolean()
  is_verified: boolean = true;

  @ApiProperty({ default: true })
  @IsBoolean()
  terms_accepted: boolean = true;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  school_id?: string;
}