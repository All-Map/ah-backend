import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReviewsController } from "./review.controller";
import { ReviewsService } from "./review.service";
import { HostelsService } from "src/hostels/hostels.service";
import { SupabaseModule } from "src/supabase/supabase.module";
import { Review } from "src/entities/review.entity";
import { Booking } from "src/entities/booking.entity";
import { Hostel } from "src/entities/hostel.entity";
import { User } from "src/entities/user.entity";
import { CloudinaryService } from "src/cloudinary/cloudinary.service";
import { RoomsService } from "src/rooms/rooms.service";
import { RoomType } from "src/entities/room-type.entity";
import { Room } from "src/entities/room.entity";

@Module({
  imports: [
    SupabaseModule,
    TypeOrmModule.forFeature([Review, Booking, Hostel, User, RoomType, Room])
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, HostelsService, CloudinaryService, RoomsService],
})
export class ReviewsModule {}