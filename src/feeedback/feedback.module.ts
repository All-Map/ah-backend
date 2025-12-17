import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { SupabaseService } from '../supabase/supabase.service';
import { FeedbackService } from './feedback.service';

@Module({
  controllers: [FeedbackController],
  providers: [SupabaseService, FeedbackService]
})
export class FeedbackModule {}