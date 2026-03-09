import { Module } from "@nestjs/common";
import { PublicController } from "./public.controller";
import { HostelsModule } from "src/hostels/hostels.module";
import { HostelsService } from "src/hostels/hostels.service";
import { SupabaseService } from "src/supabase/supabase.service";
import { CloudinaryService } from "src/cloudinary/cloudinary.service";
import { RoomsService } from "src/rooms/rooms.service";
import { RoomsModule } from "src/rooms/rooms.module";

@Module({
    imports: [HostelsModule, RoomsModule],
    controllers: [PublicController],
    providers: [HostelsService, SupabaseService, CloudinaryService, RoomsService],
})
export class PublicModule {}