import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}