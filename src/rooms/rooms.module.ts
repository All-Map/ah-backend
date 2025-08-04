import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { AuthModule } from '../auth/auth.module';
import { Room } from 'src/entities/room.entity';
import { Hostel } from 'src/entities/hostel.entity';
import { RoomType } from 'src/entities/room-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, Hostel, RoomType]),
    AuthModule, // For authentication guards and services
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService, TypeOrmModule], // Export service for use in other modules
})
export class RoomsModule {}