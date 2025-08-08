import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { SupabaseService } from 'src/supabase/supabase.service';

@Module({
  providers: [ProfileService, SupabaseService],
  exports: [ProfileService],
})
export class ProfileModule {}