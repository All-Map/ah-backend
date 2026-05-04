import { Module } from '@nestjs/common';
import { HostelsService } from './hostels.service';
import { HostelsController } from './hostels.controller';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [RoomsModule],
  controllers: [HostelsController],
  providers: [HostelsService, CloudinaryService],
  exports: [HostelsService],
})
export class HostelsModule {}