// bookings.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { Room } from '../entities/room.entity';
import { Hostel } from '../entities/hostel.entity';
import { RoomType } from '../entities/room-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      Payment,
      Room,
      Hostel,
      RoomType
    ])
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService]
})
export class BookingsModule {}