import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { UserGender, UserRole } from '@prisma/client';

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

  @ApiProperty({ required: false, enum: UserGender })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @ApiProperty({ enum: UserRole, default: UserRole.student })
  @IsEnum(UserRole)
  role: UserRole = UserRole.student;

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