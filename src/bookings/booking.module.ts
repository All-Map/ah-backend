import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { Room } from '../entities/room.entity';
import { Hostel } from '../entities/hostel.entity';
import { RoomType } from '../entities/room-type.entity';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/entities/user.entity';
import { SupabaseService } from 'src/supabase/supabase.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/mail/mail.service';
import { PaystackService } from 'src/paystack/paystack.service';
import { School } from 'src/entities/school.entity';
import { DepositsModule } from 'src/deposits/deposits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      Payment,
      Room,
      Hostel,
      RoomType,
      User,
      School,
    ]),
    forwardRef(() => DepositsModule), 
  ],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    AuthService,
    SupabaseService,
    JwtService,
    MailService,
    PaystackService,
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
