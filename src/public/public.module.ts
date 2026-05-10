import { Module } from "@nestjs/common";
import { PublicController } from "./public.controller";
import { HostelsModule } from "src/hostels/hostels.module";
import { HostelsService } from "src/hostels/hostels.service";
import { CloudinaryService } from "src/cloudinary/cloudinary.service";
import { RoomsService } from "src/rooms/rooms.service";
import { RoomsModule } from "src/rooms/rooms.module";
import { SerpApiModule } from "src/serpapi/serpapi.module";

@Module({
    imports: [HostelsModule, RoomsModule, SerpApiModule],
    controllers: [PublicController],
    providers: [HostelsService, CloudinaryService, RoomsService],
})
export class PublicModule {}