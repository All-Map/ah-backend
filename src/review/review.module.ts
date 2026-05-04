import { Module } from '@nestjs/common';
import { ReviewsController } from './review.controller';
import { ReviewsService } from './review.service';
import { HostelsModule } from 'src/hostels/hostels.module';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { RoomsModule } from 'src/rooms/rooms.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [SupabaseModule, PrismaModule, HostelsModule, RoomsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, CloudinaryService],
})
export class ReviewsModule {}
