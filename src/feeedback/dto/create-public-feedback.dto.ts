import { IsString, IsEmail, IsNotEmpty, IsOptional, Length, IsEnum } from 'class-validator';
import { PublicFeedbackCategory } from 'src/entities/public-feedback.entity';

export class CreatePublicFeedbackDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  @Length(5, 255)
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(5, 150)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 2000)
  message: string;

  @IsOptional()
  @IsEnum(PublicFeedbackCategory)
  category?: PublicFeedbackCategory;

  @IsOptional()
  ipAddress?: string;

  @IsOptional()
  userAgent?: string;
}

export class UpdatePublicFeedbackStatusDto {
  @IsEnum(['pending', 'reviewed', 'resolved', 'archived'])
  status: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  adminNotes?: string;
}

export class PublicFeedbackQueryDto {
  @IsOptional()
  @IsEnum(['pending', 'reviewed', 'resolved', 'archived'])
  status?: string;

  @IsOptional()
  @IsEnum(['general', 'bug', 'feature', 'feedback', 'support'])
  category?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;

  @IsOptional()
  sortBy?: string = 'created_at';

  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}