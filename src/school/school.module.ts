import { Module } from "@nestjs/common";
import { SupabaseService } from "src/supabase/supabase.service";
import { SchoolController } from "./school.controller";

@Module({
  controllers: [SchoolController],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SchoolModule {}