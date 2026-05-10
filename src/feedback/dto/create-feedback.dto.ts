import { IsString, IsNotEmpty, IsOptional, Length, IsEnum } from 'class-validator';
import { FeedbackCategory } from '../feedback.types';

export class CreateFeedbackDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 2000)
  message: string;

  @IsOptional()
  @IsEnum(FeedbackCategory)
  category?: FeedbackCategory;
}
