import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingManagementController } from './booking-management.controller';
import { BookingManagementService } from './booking-management.service';
import { Booking } from '../../entities/booking.entity';
import { User } from '../../entities/user.entity';
import { Hostel } from '../../entities/hostel.entity';
import { Room } from '../../entities/room.entity';
import { RoomType } from '../../entities/room-type.entity';
import { Payment } from '../../entities/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, User, Hostel, Room, RoomType, Payment]),
  ],
  controllers: [BookingManagementController],
  providers: [BookingManagementService],
  exports: [BookingManagementService],
})
export class BookingManagementModule {}